// Offline balance check: a sensible player bot vs a greedy enemy, full 5-room runs. No API calls.
// Usage: bun scripts/balance-sim.ts
import { ROOMS, applyMove, availableMoves, cloneFighter, enemyScaling, makeFighter, maxThreat, restAfterVictory, startTurn, type ClassId, type Fighter, type MoveId } from "../src/shared/rules";

function greedy(me: Fighter, foe: Fighter, careful: boolean): MoveId {
  const opts = availableMoves(me);
  const after = (m: MoveId) => { const a = cloneFighter(me), b = cloneFighter(foe); applyMove(a, b, m); return { a, b }; };
  const kill = opts.find((m) => after(m).b.hp <= 0);
  if (kill) return kill;
  if (careful) {
    const threat = maxThreat(foe, me).damage;
    if (threat >= me.hp) {
      const save = opts.filter((m) => maxThreat(after(m).b, after(m).a).damage < after(m).a.hp);
      if (save.length) return save.includes("mend") ? "mend" : save[0]!;
    }
    if (me.empowered) return opts.includes("heavy_blow") ? "heavy_blow" : "slash";
    if (opts.includes("war_cry") && me.mp >= 15) return "war_cry";
  }
  if (opts.includes("mend") && me.hp < me.maxHp * 0.4) return "mend";
  return opts.reduce((best, m) => (after(m).b.hp < after(best).b.hp ? m : best), opts[0]!);
}

function fight(p: Fighter, e: Fighter): { won: boolean; turns: number } {
  for (let t = 1; t < 60; t++) {
    startTurn(p); if (p.hp <= 0) return { won: false, turns: t };
    applyMove(p, e, greedy(p, e, true)); if (e.hp <= 0) return { won: true, turns: t };
    startTurn(e); if (e.hp <= 0) return { won: true, turns: t };
    applyMove(e, p, greedy(e, p, false)); if (p.hp <= 0) return { won: false, turns: t };
  }
  return { won: false, turns: 60 };
}

for (const cls of ["warrior", "wizard"] as ClassId[]) {
  const reached = Array(ROOMS.length + 1).fill(0);
  const turns: number[][] = ROOMS.map(() => []);
  const N = 4000;
  for (let i = 0; i < N; i++) {
    const p = makeFighter(cls, "P");
    let r = 0;
    for (; r < ROOMS.length; r++) {
      const ecls: ClassId = Math.random() < 0.5 ? "warrior" : "wizard";
      const res = fight(p, makeFighter(ecls, "E", enemyScaling(r)));
      turns[r]!.push(res.turns);
      if (!res.won) break;
      restAfterVictory(p);
    }
    reached[r]++;
  }
  const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(1);
  console.log(`${cls.padEnd(7)} cleared rooms: ${reached.map((n, i) => `${i}:${((100 * n) / N).toFixed(0)}%`).join(" ")}  | avg turns/room: ${turns.map(avg).join(" ")}`);
}

// Room-1 matchup table: careful player vs greedy enemy (deterministic).
for (const pc of ["warrior", "wizard"] as ClassId[])
  for (const ec of ["warrior", "wizard"] as ClassId[]) {
    const p = makeFighter(pc, "P"), e = makeFighter(ec, "E");
    const r = fight(p, e);
    console.log(`  ${pc} vs ${ec}: ${r.won ? "WIN " : "LOSS"} in ${r.turns} turns (player ${p.hp}/${p.maxHp}, enemy ${e.hp}/${e.maxHp})`);
  }
