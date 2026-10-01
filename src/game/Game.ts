import * as THREE from 'three';
import { AssetManager } from '../assets/AssetManager';
import { Arena } from '../arena/Arena';
import { EMBER_KEEP } from '../arena/arenas/emberKeep';
import { FightCamera } from '../camera/FightCamera';
import type { FighterConfig } from '../characters/FighterConfig';
import { ROSTER } from '../characters/fighters';
import { EventBus } from '../core/EventBus';
import { HitboxDebug } from '../debug/HitboxDebug';
import { InputManager } from '../input/InputManager';
import { KeyboardInputSource, NullInputSource } from '../input/InputSource';
import { PLAYER1_KEYS, PLAYER2_KEYS } from '../input/KeyBindings';
import { Renderer } from '../render/Renderer';
import { GameUI } from '../ui/GameUI';
import type { GameEvents } from './GameEvents';
import { GameLoop } from './GameLoop';
import { GameStateMachine } from './GameState';
import { Match } from './Match';
import { DEFAULT_RULES, type MatchRules } from './MatchRules';
import { RoundController } from './RoundController';

const START_GAP = 3.6;

/** Composition root: creates every system, wires them through the event bus and runs the state machine. */
export class Game {
  readonly events = new EventBus<GameEvents>();
  private readonly renderer: Renderer;
  private readonly scene = new THREE.Scene();
  private readonly assets = new AssetManager();
  private readonly fightCamera = new FightCamera();
  private readonly loop: GameLoop;
  private readonly input = new InputManager();
  private readonly hitboxDebug = new HitboxDebug();
  private readonly states = new GameStateMachine();
  private readonly ui: GameUI;
  private readonly rules: MatchRules = DEFAULT_RULES;
  private readonly projectTmp = new THREE.Vector3();
  private arena: Arena | null = null;
  match: Match | null = null;
  round: RoundController | null = null;
  private lineup: [FighterConfig, FighterConfig];
  private resultDelay = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    uiRoot: HTMLElement,
  ) {
    const [first, second] = ROSTER;
    if (!first) throw new Error('Empty roster');
    this.lineup = [first, second ?? first];

    this.renderer = new Renderer({ canvas: this.canvas });
    this.renderer.attachCamera(this.fightCamera.camera);
    this.loop = new GameLoop({
      fixedUpdate: () => this.fixedUpdate(),
      render: (dt, alpha) => this.render(dt, alpha),
    });
    this.scene.add(this.hitboxDebug.root);

    this.ui = new GameUI(uiRoot, this.events, (x, y) => this.project(x, y), ROSTER, {
      onStart: (p1, p2) => {
        this.lineup = [p1, p2];
        this.states.go('match');
      },
      onNavigate: () => undefined,
      onRematch: () => this.states.go('match'),
      onMenu: () => this.states.go('menu'),
    });

    this.states.onEnter('menu', () => this.enterMenu());
    this.states.onEnter('match', () => this.enterMatch());
    this.states.onEnter('result', () => this.enterResult());

    this.events.on('roundEnd', () => {
      if (this.round) this.ui.setWins(this.round.wins);
    });
    this.events.on('matchEnd', () => {
      this.resultDelay = 0.6;
    });
    this.events.on('hit', (e) => this.fightCamera.shake.add(e.attack.shake));
    this.events.on('throw', () => this.fightCamera.shake.add(0.5));
    this.events.on('ko', () => this.fightCamera.shake.add(0.8));

    window.addEventListener('keydown', (e) => {
      if (e.code === 'F1') {
        e.preventDefault();
        this.hitboxDebug.toggle();
      }
      if (e.code === 'Escape' && this.states.is('match')) this.states.go('menu');
    });
  }

  async init(): Promise<void> {
    await this.assets.loadAll((loaded, total) => this.ui.setLoading(loaded / total));
    this.arena = new Arena(EMBER_KEEP, this.assets);
    this.arena.build(this.scene, this.renderer.webgl);
    // Compile shaders up-front to avoid a hitch on the first frame of the fight.
    this.createMatch(false);
    this.renderer.webgl.compile(this.scene, this.fightCamera.camera);
    this.ui.hideLoading();
    this.states.go('menu');
    this.loop.start();
  }

  // ------------------------------------------------------------- states

  private enterMenu(): void {
    this.ui.showHud(false);
    this.ui.hideResult();
    this.createMatch(false);
    this.ui.showMenu(true);
  }

  private enterMatch(): void {
    this.ui.showMenu(false);
    this.ui.hideResult();
    this.createMatch(true);
    this.ui.setupMatch(this.lineup, this.rules.roundsToWin);
    this.ui.showHud(true);
    this.round?.start();
  }

  private enterResult(): void {
    const winner = this.round?.matchWinner ?? null;
    this.ui.showResult(winner, this.lineup);
  }

  /** Builds a match for the current lineup. Without `playable`, it's the idle menu backdrop. */
  private createMatch(playable: boolean): void {
    const arena = this.arena;
    if (!arena) return;
    this.match?.dispose();
    this.match = new Match(
      {
        fighters: this.lineup,
        inputs: playable
          ? [new KeyboardInputSource(this.input, PLAYER1_KEYS), new KeyboardInputSource(this.input, PLAYER2_KEYS)]
          : [new NullInputSource(), new NullInputSource()],
        stageHalfWidth: arena.halfWidth,
        startGap: START_GAP,
      },
      this.events,
      this.assets,
      this.scene,
    );
    this.round = playable ? new RoundController(this.match, this.rules, this.events) : null;
    this.match.resetPositions();
    this.match.render(0, 1);
    this.fightCamera.snap(this.match.focusA, this.match.focusB);
    this.loop.timeScale = 1;
  }

  // ------------------------------------------------------------- loop

  private fixedUpdate(): void {
    const match = this.match;
    if (match) {
      match.fixedUpdate();
      this.round?.update();
      this.loop.timeScale = this.round?.timeScale ?? 1;
    }
    this.input.endTick();
  }

  private render(dt: number, alpha: number): void {
    this.arena?.update(dt);
    const match = this.match;
    if (match) {
      match.render(dt, alpha);
      this.fightCamera.update(dt, match.focusA, match.focusB);
      this.hitboxDebug.update(match.fighters);
    }
    if (this.resultDelay > 0) {
      this.resultDelay -= dt;
      if (this.resultDelay <= 0 && this.states.is('match')) this.states.go('result');
    }
    this.ui.update(dt);
    this.renderer.render(this.scene, this.fightCamera.camera);
  }

  private project(x: number, y: number): { x: number; y: number } {
    const v = this.projectTmp.set(x, y, 0).project(this.fightCamera.camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
  }
}
