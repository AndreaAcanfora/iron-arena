import { Game } from './game/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('Missing #scene canvas');

const params = new URLSearchParams(window.location.search);

if (import.meta.env.DEV && params.has('poses')) {
  void import('./debug/PoseViewer').then(({ runPoseViewer }) => runPoseViewer(canvas, params));
} else {
  startGame(canvas);
}

function startGame(canvas: HTMLCanvasElement): void {
  const game = new Game(canvas);
  if (import.meta.env.DEV) Object.assign(window, { __game: game });
  game
  .init((loaded, total) => {
    document.title = `Iron Arena - loading ${Math.round((loaded / total) * 100)}%`;
  })
  .then(() => {
    document.title = 'Iron Arena';
  })
  .catch((err: unknown) => {
    console.error(err);
  });
}
