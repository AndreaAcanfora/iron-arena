import { Game } from './game/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('Missing #scene canvas');

const game = new Game(canvas);
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
