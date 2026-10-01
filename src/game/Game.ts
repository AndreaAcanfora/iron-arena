import * as THREE from 'three';
import { AssetManager } from '../assets/AssetManager';
import { Arena } from '../arena/Arena';
import { EMBER_KEEP } from '../arena/arenas/emberKeep';
import { FightCamera } from '../camera/FightCamera';
import { getFighter } from '../characters/fighters';
import { EventBus } from '../core/EventBus';
import { HitboxDebug } from '../debug/HitboxDebug';
import { InputManager } from '../input/InputManager';
import { KeyboardInputSource } from '../input/InputSource';
import { PLAYER1_KEYS, PLAYER2_KEYS } from '../input/KeyBindings';
import { Renderer } from '../render/Renderer';
import type { GameEvents } from './GameEvents';
import { GameLoop } from './GameLoop';
import { Match } from './Match';

/** Composition root: creates every system and wires them together. */
export class Game {
  private readonly renderer: Renderer;
  private readonly scene = new THREE.Scene();
  private readonly assets = new AssetManager();
  private readonly fightCamera = new FightCamera();
  private readonly loop: GameLoop;
  private readonly input = new InputManager();
  readonly events = new EventBus<GameEvents>();
  private readonly hitboxDebug = new HitboxDebug();
  private arena: Arena | null = null;
  match: Match | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new Renderer({ canvas: this.canvas });
    this.renderer.attachCamera(this.fightCamera.camera);
    this.loop = new GameLoop({
      fixedUpdate: () => this.fixedUpdate(),
      render: (dt, alpha) => this.render(dt, alpha),
    });
    this.scene.add(this.hitboxDebug.root);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F1') {
        e.preventDefault();
        this.hitboxDebug.toggle();
      }
    });
  }

  async init(onProgress: (loaded: number, total: number) => void): Promise<void> {
    await this.assets.loadAll(onProgress);
    this.arena = new Arena(EMBER_KEEP, this.assets);
    this.arena.build(this.scene, this.renderer.webgl);
    this.startMatch('brakk', 'vesna');
    this.loop.start();
  }

  private startMatch(p1: string, p2: string): void {
    this.match?.dispose();
    const arena = this.arena;
    if (!arena) return;
    this.match = new Match(
      {
        fighters: [getFighter(p1), getFighter(p2)],
        inputs: [new KeyboardInputSource(this.input, PLAYER1_KEYS), new KeyboardInputSource(this.input, PLAYER2_KEYS)],
        stageHalfWidth: arena.halfWidth,
        startGap: 4,
      },
      this.events,
      this.assets,
      this.scene,
    );
    this.match.resetPositions();
    this.match.setInputEnabled(true);
    for (const f of this.match.fighters) f.toNeutral();
    this.match.render(0, 1);
    this.fightCamera.snap(this.match.focusA, this.match.focusB);
  }

  private fixedUpdate(): void {
    this.match?.fixedUpdate();
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
    this.renderer.render(this.scene, this.fightCamera.camera);
  }
}
