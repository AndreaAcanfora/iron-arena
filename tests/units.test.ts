import { describe, expect, it, vi } from 'vitest';
import { ROSTER } from '../src/characters/fighters';
import { attackPhase, MoveList, totalFrames } from '../src/combat/AttackSystem';
import { ComboSystem } from '../src/combat/ComboSystem';
import { overlaps, WorldShape } from '../src/combat/Hitbox';
import type { AttackDefinition, ComboDefinition } from '../src/combat/types';
import { EventBus } from '../src/core/EventBus';

const move = (over: Partial<AttackDefinition>): AttackDefinition =>
  ({ id: 'x', name: 'x', input: 'light', stance: 'standing', animation: 'jab', startup: 3, active: 2, recovery: 4,
     damage: 1, hitStun: 1, blockStun: 1, knockback: 0, height: 'mid', hitStop: 0, shake: 0, sound: 'punch',
     hitbox: { kind: 'sphere', x: 0, y: 0, r: 1 }, ...over }) as AttackDefinition;

describe('frame data', () => {
  it('phases follow startup / active / recovery, counted from frame 1', () => {
    const a = move({});
    expect([1, 3, 4, 5, 6, 9, 10].map((f) => attackPhase(a, f))).toEqual([
      'startup', 'startup', 'active', 'active', 'recovery', 'recovery', 'done',
    ]);
    expect(totalFrames(a)).toBe(9);
  });

  it('MoveList: first move per stance/button wins, crouching falls back to standing', () => {
    const list = new MoveList([
      move({ id: 'jab' }),
      move({ id: 'combo-only' }),
      move({ id: 'heavy', input: 'heavy' }),
      move({ id: 'low', stance: 'crouching' }),
    ]);
    expect(list.find('standing', 'light')?.id).toBe('jab');
    expect(list.get('combo-only')?.id).toBe('combo-only');
    expect(list.find('crouching', 'light')?.id).toBe('low');
    expect(list.find('crouching', 'heavy')?.id).toBe('heavy');
    expect(list.find('air', 'heavy')).toBeUndefined();
  });
});

describe('ComboSystem', () => {
  const combos: ComboDefinition[] = [
    { id: 'c1', name: 'ONE', inputs: ['light', 'light', 'kick'], finisher: 'f1', damageMultiplier: 1.1 },
    { id: 'c2', name: 'TWO', inputs: ['light', 'kick', 'heavy'], finisher: 'f2', damageMultiplier: 1.2 },
  ];

  it('walks a prefix and returns the finisher on the last input', () => {
    const c = new ComboSystem(combos);
    c.begin('light');
    expect(c.tryContinue('light')).toEqual({ finisherId: null, damageMultiplier: 1, comboName: null });
    expect(c.tryContinue('kick')).toEqual({ finisherId: 'f1', damageMultiplier: 1.1, comboName: 'ONE' });
    expect(c.length).toBe(3);
  });

  it('branches on the second input', () => {
    const c = new ComboSystem(combos);
    c.begin('light');
    expect(c.tryContinue('kick')).toEqual({ finisherId: null, damageMultiplier: 1, comboName: null });
    expect(c.tryContinue('heavy')?.comboName).toBe('TWO');
  });

  it('rejects inputs that continue no combo, and nothing before begin()', () => {
    const c = new ComboSystem(combos);
    expect(c.tryContinue('light')).toBeNull();
    c.begin('heavy');
    expect(c.tryContinue('light')).toBeNull();
    c.begin('light');
    c.tryContinue('light');
    c.tryContinue('kick');
    expect(c.tryContinue('light')).toBeNull();
  });
});

describe('collision shapes', () => {
  const shape = (def: Parameters<WorldShape['set']>[0], x = 0, y = 0, facing = 1) => new WorldShape().set(def, x, y, facing);

  it('places fighter-local shapes by facing', () => {
    expect(shape({ kind: 'sphere', x: 1, y: 2, r: 0.5 }, 10, 0, -1)).toMatchObject({ x: 9, y: 2, halfW: 0.5 });
  });

  it('box/box, sphere/sphere and sphere/box overlaps, touching counts', () => {
    const box = shape({ kind: 'box', x: 0, y: 0, halfW: 1, halfH: 1 });
    expect(overlaps(box, shape({ kind: 'box', x: 2, y: 0, halfW: 1, halfH: 1 }))).toBe(true);
    expect(overlaps(box, shape({ kind: 'box', x: 2.01, y: 0, halfW: 1, halfH: 1 }))).toBe(false);
    expect(overlaps(shape({ kind: 'sphere', x: 0, y: 0, r: 1 }), shape({ kind: 'sphere', x: 1.2, y: 1.2, r: 0.7 }))).toBe(true);
    expect(overlaps(shape({ kind: 'sphere', x: 0, y: 0, r: 1 }), shape({ kind: 'sphere', x: 1.5, y: 1.5, r: 0.7 }))).toBe(false);
    // Sphere near a box corner: inside the bounding square but outside the radius.
    const corner = shape({ kind: 'sphere', x: 1.8, y: 1.8, r: 1 });
    expect(overlaps(corner, box)).toBe(false);
    expect(overlaps(box, corner)).toBe(false);
    expect(overlaps(shape({ kind: 'sphere', x: 1.5, y: 0, r: 0.6 }), box)).toBe(true);
  });
});

describe('EventBus', () => {
  it('delivers to listeners until they unsubscribe', () => {
    const bus = new EventBus<{ ping: number }>();
    const fn = vi.fn();
    const off = bus.on('ping', fn);
    bus.emit('ping', 1);
    off();
    bus.emit('ping', 2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });
});

describe.each(ROSTER.map((f) => [f.id, f] as const))('fighter data: %s', (_, f) => {
  const moves = new MoveList(f.attacks);

  it('has unique attack ids prefixed with the fighter id', () => {
    const ids = f.attacks.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith(`${f.id}.`)).toBe(true);
  });

  it('has sane frame data', () => {
    for (const a of f.attacks) {
      expect(a.startup, a.id).toBeGreaterThan(0);
      expect(a.active, a.id).toBeGreaterThan(0);
      expect(a.recovery, a.id).toBeGreaterThanOrEqual(0);
      expect(a.damage, a.id).toBeGreaterThan(0);
      expect(a.chipDamage ?? 0, a.id).toBeLessThan(a.damage);
      expect(f.animations[a.animation], `${a.id} animation ${a.animation}`).toBeDefined();
    }
  });

  it('has a basic attack for every button, standing, crouching and in the air', () => {
    for (const stance of ['standing', 'crouching', 'air'] as const)
      for (const input of ['light', 'heavy', 'kick'] as const) expect(moves.find(stance, input), `${stance} ${input}`).toBeDefined();
  });

  it('combos point at existing finishers and their steps are performable', () => {
    for (const c of f.combos) {
      expect(moves.get(c.finisher), c.id).toBeDefined();
      expect(moves.get(c.finisher)?.input, `${c.id} finisher button`).toBe(c.inputs[c.inputs.length - 1]);
      for (const input of c.inputs.slice(0, -1)) expect(moves.find('standing', input), `${c.id} ${input}`).toBeDefined();
      expect(c.damageMultiplier).toBeGreaterThanOrEqual(1);
    }
  });
});
