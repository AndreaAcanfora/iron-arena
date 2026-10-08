import { el } from './dom';

/**
 * The game needs a keyboard (two players share one). Touch-only devices have no
 * fine pointer and no hover, so they get this screen instead of the 3D scene.
 */
export function isTouchOnlyDevice(): boolean {
  return !window.matchMedia('(any-pointer: fine) and (any-hover: hover)').matches;
}

/** Full-screen "desktop only" notice. `onContinue` lets touch users with a keyboard play anyway. */
export function showDesktopOnlyScreen(parent: HTMLElement, onContinue: () => void): void {
  const root = el('div', 'screen menu desktop-only screen--visible', '', parent);
  const title = el('div', 'menu__title', '', root);
  el('div', 'menu__kicker', 'A BRUTAL ARCADE FIGHTER', title);
  el('h1', 'menu__logo menu__logo--small', 'IRON ARENA', title);

  const box = el('div', 'desktop-only__box', '', root);
  el('div', 'desktop-only__heading', 'DESKTOP ONLY', box);
  el(
    'p',
    'desktop-only__text',
    'Iron Arena is a two-player fighter played on a shared keyboard. Open this page on a computer to play.',
    box,
  );

  const anyway = el('button', 'desktop-only__anyway', 'I have a keyboard, play anyway', root);
  anyway.addEventListener('click', () => {
    root.remove();
    onContinue();
  });
}
