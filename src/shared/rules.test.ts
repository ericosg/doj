import { expect, test } from "bun:test";
import { CLASSES, MOVES, applyMove, availableMoves, makeFighter, maxThreat, restAfterVictory, startTurn } from "./rules";

const SLASH = MOVES.slash.damage!;
const GUARD = MOVES.guard.block!;
const HEAVY = MOVES.heavy_blow.damage!;

test("block absorbs damage before HP", () => {
  const a = makeFighter("warrior", "A");
  const b = makeFighter("warrior", "B");
  applyMove(b, a, "guard");
  const [ev] = applyMove(a, b, "slash");
  expect(ev).toEqual({ kind: "damage", target: "foe", amount: Math.max(0, SLASH - GUARD), blocked: Math.min(SLASH, GUARD) });
  applyMove(a, b, "guard");
  applyMove(b, a, "heavy_blow");
  expect(a.hp).toBe(a.maxHp - Math.max(0, HEAVY - GUARD));
});

test("war cry doubles the next hit only, shield bash halves the target's next hit", () => {
  const a = makeFighter("warrior", "A");
  const b = makeFighter("warrior", "B");
  applyMove(a, b, "war_cry");
  applyMove(a, b, "slash");
  expect(b.hp).toBe(b.maxHp - 2 * SLASH);
  applyMove(a, b, "slash");
  expect(b.hp).toBe(b.maxHp - 3 * SLASH);
  applyMove(a, b, "shield_bash");
  a.block = 0;
  applyMove(b, a, "heavy_blow");
  expect(a.hp).toBe(a.maxHp - Math.floor(HEAVY / 2));
  expect(b.weakened).toBe(false);
});

test("burn ticks at start of turn, block expires, MP regenerates", () => {
  const w = makeFighter("wizard", "W");
  const x = makeFighter("warrior", "X");
  applyMove(w, x, "fireball");
  const { perTurn, turns } = MOVES.fireball.burn!;
  x.block = 5;
  x.mp = 0;
  expect(startTurn(x)).toBe(perTurn);
  expect(x.block).toBe(0);
  expect(x.mp).toBe(CLASSES.warrior.mpRegen);
  for (let i = 1; i < turns; i++) startTurn(x);
  expect(x.burn).toBeNull();
  expect(x.hp).toBe(x.maxHp - MOVES.fireball.damage! - perTurn * turns);
});

test("only affordable moves are offered; free moves always are", () => {
  const w = makeFighter("wizard", "W");
  w.mp = 0;
  expect(availableMoves(w)).toEqual(["staff_strike"]);
});

test("threat includes bonus damage and next-turn MP regen", () => {
  const boss = makeFighter("wizard", "Boss", { bonusDamage: 2 });
  const hero = makeFighter("warrior", "Hero");
  boss.mp = MOVES.thunder.mp - CLASSES.wizard.mpRegen; // regen brings Thunder into reach
  expect(maxThreat(boss, hero)).toEqual({ damage: MOVES.thunder.damage! + 2, move: "thunder" });
});

test("resting clears statuses, refills MP, and never overheals", () => {
  const p = makeFighter("wizard", "P");
  Object.assign(p, { hp: 1, mp: 0, block: 9, empowered: true, weakened: true, burn: { perTurn: 4, turns: 2 } });
  restAfterVictory(p);
  expect(p.hp).toBeLessThanOrEqual(p.maxHp);
  expect(p.hp).toBeGreaterThan(1);
  expect(p).toMatchObject({ mp: p.maxMp, block: 0, empowered: false, weakened: false, burn: null });
});
