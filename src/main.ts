import { Game } from './game/Game';
import { isTouchOnlyDevice, showDesktopOnlyScreen } from './ui/DesktopOnlyScreen';
import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
const uiRoot = document.querySelector<HTMLElement>('#ui');
if (!canvas || !uiRoot) throw new Error('Missing #scene canvas or #ui root');

const params = new URLSearchParams(window.location.search);

if (import.meta.env.DEV && params.has('poses')) {
  void import('./debug/PoseViewer').then(({ runPoseViewer }) => runPoseViewer(canvas, params));
} else if (isTouchOnlyDevice() && !params.has('force')) {
  // Skip the asset download and WebGL setup until the player opts in.
  showDesktopOnlyScreen(uiRoot, startGame);
} else {
  startGame();
}

function startGame(): void {
  if (!canvas || !uiRoot) return;
  const game = new Game(canvas, uiRoot);
  if (import.meta.env.DEV) Object.assign(window, { __game: game });
  game.init().catch((err: unknown) => {
    console.error(err);
    uiRoot.textContent = 'Failed to load the game. Check the console for details.';
  });
}
