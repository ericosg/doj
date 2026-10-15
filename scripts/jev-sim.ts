// Full runs of the careful player bot vs real Jev (class + every move). Costs real API calls.
// Usage: bun scripts/jev-sim.ts [runsPerClass=3] [boss]   ("boss": only the final fight, hero grown by 4 rests)
import { pickBossForm, pickClass, pickMove } from "../src/server/jev";
import { BOSS_ROOM, MOVES, ROOMS, makeBoss, applyMove, availableMoves, cloneFighter, enemyScaling, makeFighter, maxThreat, restAfterVictory, startTurn, type ClassId, type Fighter, type MoveId } from "../src/shared/rules";

function careful(me: Fighter, foe: Fighter): MoveId {
  const opts = availableMoves(me);
  const after = (m: MoveId) => { const a = cloneFighter(me), b = cloneFighter(foe); applyMove(a, b, m); return { a, b }; };
  const kill = opts.find((m) => after(m).b.hp <= 0);
  if (kill) return kill;
  if (maxThreat(foe, me).damage >= me.hp) {
    const save = opts.filter((m) => maxThreat(after(m).b, after(m).a).damage < after(m).a.hp);
    if (save.length) return save.includes("mend") ? "mend" : save[0]!;
  }
  if (me.empowered) return opts.includes("heavy_blow") ? "heavy_blow" : "slash";
  if (opts.includes("war_cry") && me.mp >= 15) return "war_cry";
  if (opts.includes("mend") && me.hp < me.maxHp * 0.4) return "mend";
  return opts.reduce((best, m) => (after(m).b.hp < after(best).b.hp ? m : best), opts[0]!);
}

const runs = Number(process.argv[2] ?? 3);
const bossOnly = process.argv[3] === "boss";
const quiet = console.log;
for (const cls of ["warrior", "wizard"] as ClassId[]) {
  for (let i = 0; i < runs; i++) {
    const p = makeFighter(cls, "P");
    const counts: Partial<Record<MoveId, number>> = {};
    const line: string[] = [];
    let r = 0;
    if (bossOnly) for (; r < BOSS_ROOM; r++) restAfterVictory(p);
    for (; r < ROOMS.length; r++) {
      console.log = () => {};
      const c =
        r === BOSS_ROOM
          ? await pickBossForm({ player: p, playerFavoriteMoves: Object.keys(counts) as MoveId[] })
          : await pickClass({ room: r, player: p, playerFavoriteMoves: Object.keys(counts) as MoveId[] });
      const e = r === BOSS_ROOM ? makeBoss(c.choice as any, r) : makeFighter(c.choice as ClassId, "E", enemyScaling(r));
      const recent: MoveId[] = [];
      const jevMoves: string[] = [];
      let won = false;
      for (let t = 1; t < 40; t++) {
        startTurn(p); if (p.hp <= 0) break;
        const pm = careful(p, e); applyMove(p, e, pm); recent.push(pm); counts[pm] = (counts[pm] ?? 0) + 1;
        if (e.hp <= 0) { won = true; break; }
        startTurn(e); if (e.hp <= 0) { won = true; break; }
        // A shift is a free action: the boss decides again in its new form.
        for (let k = 0; k < 2; k++) {
          const d = await pickMove({ enemy: e, player: p, turn: t, playerRecentMoves: recent.slice(-3) });
          jevMoves.push(d.choice); applyMove(e, p, d.choice);
          if (!MOVES[d.choice].shift) break;
        }
        if (p.hp <= 0) break;
      }
      console.log = quiet;
      line.push(`R${r + 1} vs ${c.choice} ${won ? "won" : "LOST"} hp${p.hp}/${p.maxHp} foe${e.hp}/${e.maxHp} jev:[${jevMoves.join(",")}]`);
      if (!won) break;
      restAfterVictory(p);
    }
    console.log(`${cls} run ${i + 1}: cleared ${r}/5\n   ${line.join("\n   ")}`);
  }
}
