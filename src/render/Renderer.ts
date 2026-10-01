import * as THREE from 'three';

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  maxPixelRatio?: number;
}

/** Owns the WebGLRenderer and keeps it sized to the window. */
export class Renderer {
  readonly webgl: THREE.WebGLRenderer;
  private readonly cameras = new Set<THREE.PerspectiveCamera>();

  constructor({ canvas, maxPixelRatio = 2 }: RendererOptions) {
    this.webgl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    this.webgl.outputColorSpace = THREE.SRGBColorSpace;
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.05;
    this.webgl.shadowMap.enabled = true;
    this.webgl.shadowMap.type = THREE.PCFShadowMap;
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  attachCamera(camera: THREE.PerspectiveCamera): void {
    this.cameras.add(camera);
    this.resize();
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.webgl.render(scene, camera);
  }

  private readonly resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.webgl.setSize(w, h, false);
    for (const cam of this.cameras) {
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
  };

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.webgl.dispose();
  }
}
