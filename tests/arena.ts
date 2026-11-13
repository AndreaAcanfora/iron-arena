// Headless arena: two Fighters and the CombatSystem stepped tick by tick,
// exactly like Match.fixedUpdate but without three.js, assets or a renderer.
import { Fighter } from '../src/characters/Fighter';
import type { FighterConfig } from '../src/characters/FighterConfig';
import { BRAKK } from '../src/characters/fighters/brakk';
import { VESNA } from '../src/characters/fighters/vesna';
import { CombatSystem } from '../src/combat/CombatSystem';
import { EventBus } from '../src/core/EventBus';
import type { GameEvents } from '../src/game/GameEvents';
import type { InputFrame } from '../src/input/Actions';

export { Action } from '../src/input/Actions';

export const STAGE_HALF_WIDTH = 8;

/** Pressed this tick (and held). */
export const press = (bits: number, held = 0): InputFrame => ({ held: bits | held, pressed: bits });
/** Held, not newly pressed. */
export const hold = (bits: number): InputFrame => ({ held: bits, pressed: 0 });
const idle = (): InputFrame => ({ held: 0, pressed: 0 });

type Script = (tick: number) => InputFrame;

export function arena(opts: { a?: FighterConfig; b?: FighterConfig; gap?: number } = {}) {
  const events = new EventBus<GameEvents>();
  const log = {
    hit: [] as GameEvents['hit'][],
    block: [] as GameEvents['block'][],
    throw: [] as GameEvents['throw'][],
    grabTech: [] as GameEvents['grabTech'][],
  };
  events.on('hit', (e) => log.hit.push(e));
  events.on('block', (e) => log.block.push(e));
  events.on('throw', (e) => log.throw.push(e));
  events.on('grabTech', (e) => log.grabTech.push(e));

  const ctx = { events, stageHalfWidth: STAGE_HALF_WIDTH };
  const a = new Fighter(0, opts.a ?? VESNA, ctx);
  const b = new Fighter(1, opts.b ?? BRAKK, ctx);
  const gap = opts.gap ?? 1.1;
  a.reset(-gap / 2, 1);
  b.reset(gap / 2, -1);
  for (const f of [a, b]) {
    f.inputEnabled = true;
    f.toNeutral();
  }
  const combat = new CombatSystem(events, () => STAGE_HALF_WIDTH);
  let t = 0;

  /** Run `ticks` simulation steps with per-tick input scripts for each side. */
  function run(ticks: number, scriptA: Script = idle, scriptB: Script = idle): void {
    for (let i = 0; i < ticks; i++, t++) {
      a.update(scriptA(i), b);
      b.update(scriptB(i), a);
      combat.step(a, b);
    }
  }

  return { a, b, log, run, events };
}
