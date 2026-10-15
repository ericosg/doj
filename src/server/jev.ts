// Jev decisions for the enemy. Code computes every number; Jev only makes the judgment call.
import {
  BOSS_FORMS,
  CLASSES,
  HERO_CLASSES,
  MOVES,
  ROOMS,
  applyMove,
  availableMoves,
  cloneFighter,
  hpStatus,
  maxThreat,
  rawDamage,
  type BossForm,
  type ClassId,
  type Fighter,
  type HeroClass,
  type MoveId,
} from "../shared/rules";

export interface JevDecision<T extends string> {
  choice: T;
  probabilities: Record<T, number>;
  confidence: number;
  latencyMs: number;
  model: string;
  inputTokens: number;
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export function jevAvailable(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY);
}

// Direct HTTP rather than @typesafe-ai/sdk: SDK 0.7.0 targets Node and its response buffering
// fails under Bun's fetch with "Body already used".
async function systemOne(body: { state: Json; questions: Record<string, Json> }): Promise<any> {
  const url = `${process.env.TYPESAFE_BASE_URL ?? "https://api.typesafe.ai"}/v1/systemone`;
  const init = {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.TYPESAFE_MODEL ?? "jev-1.14.0", ...body }),
    signal: AbortSignal.timeout(15_000),
  };
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    // 429 rate limited / 529 overloaded: back off and retry, as the API docs ask.
    if ((res.status === 429 || res.status === 529) && attempt < 3) {
      await Bun.sleep(250 * 2 ** attempt);
      continue;
    }
    if (!res.ok) throw new Error(`TypeSafe API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }
}

// jev-1.13 leans toward the first Choice option, so present options in random order.
function shuffled<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

async function ask<T extends string>(state: { [key: string]: Json }, instructions: string, criteria: Record<T, string>): Promise<JevDecision<T>> {
  const t0 = performance.now();
  const res = await systemOne({ state, questions: { pick: { type: "choice", instructions, criteria } } });
  const answer = res.answers.pick;
  const decision: JevDecision<T> = {
    choice: answer.choice,
    probabilities: answer.probabilities,
    confidence: answer.confidence,
    latencyMs: Math.round(performance.now() - t0),
    model: res.model,
    inputTokens: res.usage?.input_tokens ?? 0,
  };
  console.log(`[jev] ${decision.choice} conf=${decision.confidence.toFixed(2)} ${decision.latencyMs}ms`, decision.probabilities);
  return decision;
}

function describe(f: Fighter) {
  const boss = !CLASSES[f.cls].playable;
  return {
    ...(boss ? { form: `${CLASSES[f.cls].name} (${CLASSES[f.cls].summary})` } : { class: CLASSES[f.cls].name }),
    hp: `${f.hp}/${f.maxHp}`,
    condition: hpStatus(f),
    mp: `${f.mp}/${f.maxMp}`,
    block: f.block,
    damage_over_time: f.burn ? `takes ${f.burn.perTurn} ${f.burn.kind} damage at the start of each of its next ${f.burn.turns} turns` : "none",
    empowered: f.empowered ? "yes - its next attack deals double damage" : "no",
    weakened: f.weakened ? "yes - its next attack deals half damage" : "no",
  };
}

function sample<T extends string>(probs: Record<T, number>): T {
  const entries = Object.entries(probs) as [T, number][];
  let r = Math.random() * entries.reduce((sum, [, p]) => sum + p, 0);
  for (const [k, p] of entries) if ((r -= p) <= 0) return k;
  return entries[entries.length - 1]![0];
}

// ---- Which class should the enemy champion be? ---------------------------

export interface ClassRequest {
  room: number;
  player: Fighter;
  playerFavoriteMoves: MoveId[];
}

export async function pickClass(req: ClassRequest) {
  const room = ROOMS[req.room]!;
  const state = {
    encounter: `Room ${req.room + 1} of ${ROOMS.length}: ${room.name}. A one-on-one turn-based duel to the death.`,
    player: {
      ...describe(req.player),
      abilities: CLASSES[req.player.cls].moves.map((m) => `${MOVES[m].name} (${MOVES[m].mp} MP): ${MOVES[m].text}`),
      moves_used_most_so_far: req.playerFavoriteMoves.map((m) => MOVES[m].name),
    },
  };
  const criteria = Object.fromEntries(
    shuffled(HERO_CLASSES.map((c) => CLASSES[c])).map((c) => [
      c.id,
      `${c.name}: ${c.summary} Abilities: ${c.moves.map((m) => `${MOVES[m].name} (${MOVES[m].mp} MP) - ${MOVES[m].text}`).join(" ")}`,
    ]),
  ) as Record<HeroClass, string>;
  const decision = await ask<HeroClass>(
    state,
    "The dungeon sends one champion to duel `player`. Which champion class has the best chance of defeating `player`, given the player's class, current HP, and the moves the player relies on?",
    criteria,
  );
  // The matchup is a preference call that Jev often rates near 50/50. Taking the argmax would field
  // the same class every time, so draw from Jev's distribution instead.
  decision.choice = sample(decision.probabilities);
  return decision;
}

// ---- Which move should the enemy make this turn? -------------------------

export interface MoveRequest {
  enemy: Fighter;
  player: Fighter;
  turn: number;
  playerRecentMoves: MoveId[];
}

/** Plain-language projection of what a move does right now, computed exactly in code. */
function projectMove(enemy: Fighter, player: Fighter, id: MoveId): string {
  const move = MOVES[id];
  const e = cloneFighter(enemy);
  const p = cloneFighter(player);
  const threatBefore = maxThreat(player, enemy);
  applyMove(e, p, id);
  const parts = [`${move.name} (costs ${move.mp} MP, enemy MP ${enemy.mp} -> ${e.mp}): ${move.text}`];

  if (move.damage) {
    const dealt = player.hp - p.hp;
    parts.push(`Right now it deals ${dealt} damage${move.hits ? ` in total over ${move.hits} hits` : ""}: player HP ${player.hp} -> ${p.hp}.`);
    if (p.hp <= 0) parts.push("THIS DEFEATS THE PLAYER AND WINS THE FIGHT.");
  }
  if (move.heal) parts.push(`Enemy HP ${enemy.hp} -> ${e.hp} of ${e.maxHp}.`);
  if (move.burn) {
    const total = move.burn.perTurn * move.burn.turns;
    const kind = move.burn.kind;
    parts.push(player.burn ? `Replaces the player's current ${player.burn.kind} with ${total} ${kind} damage over ${move.burn.turns} turns.` : `Adds ${total} ${kind} damage over the player's next ${move.burn.turns} turns.`);
  }
  if (move.cleanse && (enemy.burn || enemy.weakened)) {
    parts.push(`Removes the enemy's ${[enemy.burn && `${enemy.burn.kind} (${enemy.burn.perTurn * enemy.burn.turns} damage still to come)`, enemy.weakened && "weakness"].filter(Boolean).join(" and ")}.`);
  }
  if (move.shift) {
    const best = bestAttack(e, false);
    parts.push(
      `Costs no MP and does not use up the turn: right after shifting, the enemy still acts this turn in ${CLASSES[move.shift].name} form, where its best attack right now would deal ${best.damage} damage before block (${best.name}).` +
        ` ${CLASSES[move.shift].name} form: ${CLASSES[move.shift].summary} The enemy cannot shift again until the turn after next.`,
    );
  }
  if (move.block || move.weaken) {
    const after = maxThreat(p, e);
    if (threatBefore.damage > 0) {
      parts.push(
        `The player's strongest next attack would deal ${after.damage} damage to the enemy instead of ${threatBefore.damage}` +
          (after.damage >= e.hp ? " - still enough to defeat the enemy." : enemy.hp <= threatBefore.damage ? " - this prevents a defeat." : "."),
      );
    }
  }
  if (move.empower) parts.push(`Next turn the enemy's best attack would deal ${bestAttack(e, true).damage} damage before block.`);
  return parts.join(" ");
}

/** Strongest single attack `f` could make now, or next turn after MP regen. */
function bestAttack(f: Fighter, nextTurn: boolean): { damage: number; name: string } {
  const next = cloneFighter(f);
  if (nextTurn) next.mp = Math.min(next.maxMp, next.mp + CLASSES[next.cls].mpRegen);
  let best = { damage: 0, name: "none" };
  for (const m of availableMoves(next)) {
    const dmg = rawDamage(next, MOVES[m]) * (MOVES[m].hits ?? 1);
    if (dmg > best.damage) best = { damage: dmg, name: MOVES[m].name };
  }
  return best;
}

// ---- Which form should the boss open the fight in? ------------------------

export async function pickBossForm(req: { player: Fighter; playerFavoriteMoves: MoveId[] }) {
  const state = {
    encounter: `The final room. The Hollow Druid, a shapeshifting boss with a single large HP pool, duels \`player\` to the death. It can shift between forms during the fight as a free action, at most every other turn.`,
    player: {
      ...describe(req.player),
      abilities: CLASSES[req.player.cls].moves.map((m) => `${MOVES[m].name} (${MOVES[m].mp} MP): ${MOVES[m].text}`),
      moves_used_most_so_far: req.playerFavoriteMoves.map((m) => MOVES[m].name),
    },
  };
  const criteria = Object.fromEntries(
    shuffled(BOSS_FORMS).map((f) => [
      f,
      `${CLASSES[f].name} form: ${CLASSES[f].summary} Moves: ${CLASSES[f].moves.filter((m) => !MOVES[m].shift).map((m) => `${MOVES[m].name} (${MOVES[m].mp} MP) - ${MOVES[m].text}`).join(" ")}`,
    ]),
  ) as Record<BossForm, string>;
  const decision = await ask<BossForm>(
    state,
    "Which form should the Hollow Druid start the fight in to have the best chance of defeating `player`, given the player's class, HP, and the moves the player relies on?",
    criteria,
  );
  // Like the champion class, this is a preference call: draw from Jev's distribution for variety.
  decision.choice = sample(decision.probabilities);
  return decision;
}

export function pickMove(req: MoveRequest) {
  const { enemy, player } = req;
  const options = availableMoves(enemy);
  const threat = maxThreat(player, enemy);
  const state = {
    situation:
      `Turn ${req.turn} of a one-on-one turn-based duel. You control \`enemy\`. The duel ends when either side reaches 0 HP. Block absorbs damage and expires at the start of its owner's next turn.` +
      (CLASSES[enemy.cls].playable ? "" : " `enemy` is a shapeshifter: each form has different moves. Shifting is a free action, so after shifting the enemy still acts this turn in its new form."),
    enemy: describe(enemy),
    player: describe(player),
    danger: {
      player_strongest_next_attack: threat.move ? `${MOVES[threat.move].name} for ${threat.damage} damage after the enemy's current block` : "none",
      player_can_defeat_enemy_next_turn: threat.damage >= enemy.hp ? "yes" : "no",
    },
    player_recent_moves: req.playerRecentMoves.map((m) => MOVES[m].name),
  };
  const criteria = Object.fromEntries(shuffled(options).map((m) => [m, projectMove(enemy, player, m)])) as Record<MoveId, string>;
  return ask<MoveId>(
    state,
    "Which move should `enemy` use this turn to give `enemy` the best chance of defeating `player` before `player` defeats `enemy`?",
    criteria,
  );
}
