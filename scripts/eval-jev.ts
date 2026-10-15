// Runs Jev on hand-built battle situations where a sensible answer is clear, several times each
// (options are shuffled per call, so this also checks order sensitivity). Usage: bun scripts/eval-jev.ts
import { pickClass, pickMove } from "../src/server/jev";
import { makeBoss, makeFighter, type BossForm, type Fighter, type MoveId } from "../src/shared/rules";

const f = (cls: "warrior" | "wizard", o: Partial<Fighter> = {}) => ({ ...makeFighter(cls, cls === "warrior" ? "Brusk" : "Ilsa"), ...o });

const boss = (form: BossForm, o: Partial<Fighter> = {}) => ({ ...makeBoss(form, 4), ...o });

const cases: { name: string; enemy: Fighter; player: Fighter; good: MoveId[] }[] = [
  { name: "boss bear: lethal maul available", enemy: boss("bear"), player: f("warrior", { hp: 18 }), good: ["maul"] },
  { name: "boss wolf at 14 HP and bleeding: shift out to heal or defend", enemy: boss("wolf", { hp: 14, burn: { perTurn: 5, turns: 3, kind: "bleed" } }), player: f("wizard", { hp: 60 }), good: ["shift_bear", "shift_druid"] },
  { name: "boss druid about to die, no block: get defensive", enemy: boss("druid", { hp: 15, mp: 4 }), player: f("warrior", { hp: 90, mp: 20 }), good: ["shift_bear", "shift_druid"] },
  { name: "lethal slash available", enemy: f("warrior"), player: f("wizard", { hp: 7 }), good: ["slash", "heavy_blow"] },
  { name: "lethal thunder available", enemy: f("wizard"), player: f("warrior", { hp: 25 }), good: ["thunder"] },
  { name: "wizard about to die, can heal/ward", enemy: f("wizard", { hp: 9, mp: 30 }), player: f("warrior", { hp: 70, mp: 20 }), good: ["mend", "frost_ward"] },
  { name: "warrior empowered, should cash in", enemy: f("warrior", { empowered: true, mp: 12 }), player: f("wizard", { hp: 50 }), good: ["heavy_blow"] },
  { name: "player has huge block, don't attack into it", enemy: f("wizard", { mp: 40 }), player: f("warrior", { block: 28, hp: 80 }), good: ["fireball", "frost_ward", "mend"] },
  { name: "opening move, wizard full mp", enemy: f("wizard"), player: f("warrior"), good: ["fireball", "thunder"] },
];

const N = 3;
for (const c of cases) {
  const picks: string[] = [];
  for (let i = 0; i < N; i++) {
    const d = await pickMove({ enemy: c.enemy, player: c.player, turn: 3, playerRecentMoves: [] });
    picks.push(`${d.choice}(${d.confidence.toFixed(2)})`);
  }
  const ok = picks.every((p) => c.good.includes(p.split("(")[0] as MoveId));
  console.log(`${ok ? "OK  " : "MISS"} ${c.name}: ${picks.join(", ")}  [good: ${c.good.join("/")}]`);
}
for (const cls of ["warrior", "wizard"] as const) {
  const d = await pickClass({ room: 0, player: f(cls), playerFavoriteMoves: [] });
  console.log(`class vs ${cls}: ${d.choice}`, d.probabilities);
}
