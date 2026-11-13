import { describe, expect, it } from 'vitest';
import { BRAKK } from '../src/characters/fighters/brakk';
import { VESNA } from '../src/characters/fighters/vesna';
import { DEFAULT_COMBAT } from '../src/combat/CombatSystem';
import { Action, arena, hold, press } from './arena';

const attack = (id: string) => [...VESNA.attacks, ...BRAKK.attacks].find((x) => x.id === id)!;
const none = { held: 0, pressed: 0 };

describe('strikes', () => {
  it('a jab in range hits once for its damage and puts the victim in hitstun', () => {
    const { a, b, log, run } = arena();
    const states: string[] = [];
    run(30, (t) => (t === 0 ? press(Action.Light) : none), () => {
      states.push(b.state);
      return none;
    });
    expect(log.hit).toHaveLength(1);
    expect(log.hit[0]).toMatchObject({ attacker: 0, victim: 1, damage: attack('vesna.jab').damage, counter: false });
    expect(b.health).toBe(BRAKK.maxHealth - attack('vesna.jab').damage);
    expect(states).toContain('hitstun');
    expect(a.state).toBe('idle');
  });

  it('whiffs when the opponent is out of reach', () => {
    const { b, log, run } = arena({ gap: 3 });
    run(30, (t) => (t === 0 ? press(Action.Light) : none));
    expect(log.hit).toHaveLength(0);
    expect(b.health).toBe(BRAKK.maxHealth);
  });

  it('a hit on an opponent in the startup of an attack is a counter hit', () => {
    const { b, log, run } = arena();
    // Brakk starts a slow heavy first; Vesna's 5-frame jab lands during its startup.
    run(30, (t) => (t === 1 ? press(Action.Light) : none), (t) => (t === 0 ? press(Action.Heavy) : none));
    const counter = log.hit.find((h) => h.attacker === 0)!;
    expect(counter.counter).toBe(true);
    expect(counter.damage).toBe(Math.round(attack('vesna.jab').damage * DEFAULT_COMBAT.counterDamageBonus));
    expect(log.hit.filter((h) => h.attacker === 1)).toHaveLength(0);
    expect(b.health).toBe(BRAKK.maxHealth - counter.damage);
  });

  it('identical attacks on the same frame trade', () => {
    const { a, b, log, run } = arena({ b: VESNA });
    run(30, (t) => (t === 0 ? press(Action.Light) : none), (t) => (t === 0 ? press(Action.Light) : none));
    expect(log.hit.map((h) => h.attacker).sort()).toEqual([0, 1]);
    expect(a.health).toBe(b.health);
  });

  it('a hit that empties the health bar is a KO and disables input', () => {
    const { b, run } = arena();
    b.health = 2;
    run(40, (t) => (t === 0 ? press(Action.Light) : none));
    expect(b.isKO).toBe(true);
    expect(b.health).toBe(0);
    expect(b.inputEnabled).toBe(false);
  });
});

describe('blocking', () => {
  it('a standing guard blocks a jab: no damage, blockstun', () => {
    const { b, log, run } = arena();
    const states: string[] = [];
    run(30, (t) => (t === 0 ? press(Action.Light) : none), () => {
      states.push(b.state);
      return hold(Action.Block);
    });
    expect(log.hit).toHaveLength(0);
    expect(log.block).toHaveLength(1);
    expect(b.health).toBe(BRAKK.maxHealth);
    expect(states).toContain('blockstun');
  });

  it('blocked heavies still deal chip damage', () => {
    const { b, log, run } = arena();
    run(40, (t) => (t === 0 ? press(Action.Heavy) : none), () => hold(Action.Block));
    expect(log.block).toHaveLength(1);
    expect(b.health).toBe(BRAKK.maxHealth - (attack('vesna.straight').chipDamage ?? 0));
  });

  it('a low sweep beats a standing guard and knocks down', () => {
    const { b, log, run } = arena();
    const states: string[] = [];
    run(40, (t) => (t === 0 ? press(Action.Kick, Action.Down) : hold(Action.Down)), () => {
      states.push(b.state);
      return hold(Action.Block);
    });
    expect(log.hit).toHaveLength(1);
    expect(log.hit[0]!.attack.id).toBe('vesna.sweep');
    expect(states).toContain('launched');
  });

  it('a crouching guard blocks the sweep', () => {
    const { b, log, run } = arena();
    run(40, (t) => (t === 0 ? press(Action.Kick, Action.Down) : hold(Action.Down)), () => hold(Action.Block | Action.Down));
    expect(log.hit).toHaveLength(0);
    expect(log.block).toHaveLength(1);
    expect(b.health).toBe(BRAKK.maxHealth);
  });
});

describe('combos', () => {
  it('light, light, kick chains into VIPER SPIN with scaled damage', () => {
    const { log, run } = arena();
    const presses: Record<number, number> = { 0: Action.Light, 10: Action.Light, 20: Action.Kick };
    run(80, (t) => (presses[t] ? press(presses[t]!) : none));
    expect(log.hit).toHaveLength(3);
    const last = log.hit[2]!;
    expect(last.finisherName).toBe('VIPER SPIN');
    expect(last.attack.id).toBe('vesna.comboSpin');
    expect(last.comboCount).toBe(3);
    const scaling = Math.max(DEFAULT_COMBAT.comboScalingMin, 1 - DEFAULT_COMBAT.comboScalingStep * 2);
    expect(last.damage).toBe(Math.round(attack('vesna.comboSpin').damage * 1.15 * scaling));
  });

  it('an input that continues no combo does not chain', () => {
    const { log, run } = arena();
    // heavy → light is not a combo prefix: the light is dropped while the heavy recovers.
    const presses: Record<number, number> = { 0: Action.Heavy, 18: Action.Light };
    run(80, (t) => (presses[t] ? press(presses[t]!) : none));
    expect(log.hit.map((h) => h.attack.id)).toEqual(['vesna.straight']);
  });
});

describe('grabs', () => {
  it('a grab goes through a guard and throws after the hold', () => {
    const { b, log, run } = arena({ gap: 0.9 });
    run(60, (t) => (t === 0 ? press(Action.Grab) : none), () => hold(Action.Block));
    expect(log.throw).toHaveLength(1);
    expect(b.health).toBe(BRAKK.maxHealth - VESNA.grab.damage);
  });

  it('simultaneous grabs tech: nobody is thrown', () => {
    // Mirror match, so both grabs become active on the same tick.
    const { a, b, log, run } = arena({ b: VESNA, gap: 0.9 });
    run(60, (t) => (t === 0 ? press(Action.Grab) : none), (t) => (t === 0 ? press(Action.Grab) : none));
    expect(log.grabTech).toHaveLength(1);
    expect(log.throw).toHaveLength(0);
    expect([a.health, b.health]).toEqual([VESNA.maxHealth, VESNA.maxHealth]);
  });
});

describe('movement', () => {
  it('walking into a cornered opponent never lets the bodies overlap or leave the stage', () => {
    const { a, b, run } = arena({ gap: 3 });
    let minGap = Infinity;
    // Vesna walks forward; Brakk (facing left) holds Right = walks back into the wall.
    for (let t = 0; t < 400; t++) {
      run(1, () => hold(Action.Right), () => hold(Action.Right));
      minGap = Math.min(minGap, b.x - a.x);
    }
    expect(b.x).toBeCloseTo(8, 5);
    expect(minGap).toBeGreaterThanOrEqual(VESNA.pushHalfWidth + BRAKK.pushHalfWidth - 1e-6);
  });

  it('a backdash is strike-invulnerable at the start', () => {
    const { log, run } = arena();
    // Brakk double-taps back (Right) and the jab arrives during the invulnerable frames.
    run(30, (t) => (t === 3 ? press(Action.Light) : none), (t) => (t === 0 || t === 2 ? press(Action.Right) : none));
    expect(log.hit).toHaveLength(0);
  });
});
