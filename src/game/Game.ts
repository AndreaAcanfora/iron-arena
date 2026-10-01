import * as THREE from 'three';
import { AssetManager } from '../assets/AssetManager';
import { Arena } from '../arena/Arena';
import { EMBER_KEEP } from '../arena/arenas/emberKeep';
import { FightCamera } from '../camera/FightCamera';
import { Renderer } from '../render/Renderer';
import { GameLoop } from './GameLoop';

/** Composition root: creates every system and wires them together. */
export class Game {
  private readonly renderer: Renderer;
  private readonly scene = new THREE.Scene();
  private readonly assets = new AssetManager();
  private readonly fightCamera = new FightCamera();
  private readonly loop: GameLoop;
  private arena: Arena | null = null;

  // Milestone 1 placeholders that stand in for the fighters.
  private readonly markers: THREE.Mesh[] = [];
  private time = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new Renderer({ canvas: this.canvas });
    this.renderer.attachCamera(this.fightCamera.camera);
    this.loop = new GameLoop({
      fixedUpdate: (dt) => this.fixedUpdate(dt),
      render: (dt, alpha) => this.render(dt, alpha),
    });
  }

  async init(onProgress: (loaded: number, total: number) => void): Promise<void> {
    await this.assets.loadAll(onProgress);
    this.arena = new Arena(EMBER_KEEP, this.assets);
    this.arena.build(this.scene, this.renderer.webgl);

    const geo = new THREE.CapsuleGeometry(0.35, 1.1, 4, 12);
    for (const color of [0xc0392b, 0x2e86c1]) {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
      m.castShadow = true;
      this.scene.add(m);
      this.markers.push(m);
    }
    this.loop.start();
  }

  private fixedUpdate(dt: number): void {
    this.time += dt;
    const [a, b] = this.markers;
    if (!a || !b) return;
    const gap = 2.5 + (Math.sin(this.time * 0.6) * 0.5 + 0.5) * 9;
    a.position.set(-gap / 2 + Math.sin(this.time * 0.3) * 2, 0.9, 0);
    b.position.set(gap / 2 + Math.sin(this.time * 0.3) * 2, 0.9, 0);
  }

  private render(dt: number, _alpha: number): void {
    const [a, b] = this.markers;
    this.arena?.update(dt);
    if (a && b) this.fightCamera.update(dt, a.position, b.position);
    this.renderer.render(this.scene, this.fightCamera.camera);
  }
}
