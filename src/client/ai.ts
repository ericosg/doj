// Asks the server (and so Jev) for enemy decisions. If Jev can't be reached, a simple
// rule-based fallback keeps the game playable, and the UI labels it as such.
import { BOSS_FORMS, CLASSES, MOVES, applyMove, availableMoves, cloneFighter, type BossForm, type ClassId, type Fighter, type HeroClass, type MoveId } from "../shared/rules";

export interface Decision<T extends string> {
  choice: T;
  probabilities: Partial<Record<T, number>>;
  confidence: number | null;
  latencyMs: number;
  source: "jev" | "fallback";
  model?: string;
  error?: string;
}

async function post<T extends string>(path: string, body: unknown): Promise<Decision<T>> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json: any = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return { ...json, source: "jev" };
}

export async function jevOnline(): Promise<boolean> {
  try {
    return ((await (await fetch("/api/health")).json()) as { jev?: boolean }).jev === true;
  } catch {
    return false;
  }
}

export async function chooseBossForm(player: Fighter, playerFavoriteMoves: MoveId[]): Promise<Decision<BossForm>> {
  try {
    return await post<BossForm>("/api/enemy/form", { player, playerFavoriteMoves });
  } catch (err) {
    const choice = BOSS_FORMS[Math.floor(Math.random() * BOSS_FORMS.length)]!;
    return { choice, probabilities: { [choice]: 1 }, confidence: null, latencyMs: 0, source: "fallback", error: String((err as Error).message ?? err) };
  }
}

export async function chooseEnemyClass(room: number, player: Fighter, playerFavoriteMoves: MoveId[]): Promise<Decision<HeroClass>> {
  try {
    return await post<HeroClass>("/api/enemy/class", { room, player, playerFavoriteMoves });
  } catch (err) {
    const choice: HeroClass = Math.random() < 0.5 ? "warrior" : "wizard";
    return { choice, probabilities: { [choice]: 1 }, confidence: null, latencyMs: 0, source: "fallback", error: String((err as Error).message ?? err) };
  }
}

export async function chooseEnemyMove(enemy: Fighter, player: Fighter, turn: number, playerRecentMoves: MoveId[]): Promise<Decision<MoveId>> {
  const options = availableMoves(enemy);
  try {
    const d = await post<MoveId>("/api/enemy/move", { enemy, player, turn, playerRecentMoves });
    if (!options.includes(d.choice)) throw new Error(`Jev picked unavailable move ${d.choice}`);
    return d;
  } catch (err) {
    return { choice: fallbackMove(enemy, player), probabilities: {}, confidence: null, latencyMs: 0, source: "fallback", error: String((err as Error).message ?? err) };
  }
}

/** Greedy fallback: finish the player if possible, heal when low, otherwise hit hardest. */
function fallbackMove(enemy: Fighter, player: Fighter): MoveId {
  const options = availableMoves(enemy);
  const after = (m: MoveId) => {
    const e = cloneFighter(enemy);
    const p = cloneFighter(player);
    applyMove(e, p, m);
    return { e, p };
  };
  const lethal = options.find((m) => after(m).p.hp <= 0);
  if (lethal) return lethal;
  if (options.includes("mend") && enemy.hp < enemy.maxHp * 0.4) return "mend";
  return options.reduce((best, m) => (player.hp - after(m).p.hp > player.hp - after(best).p.hp ? m : best), options[0]!);
}

export const className = (c: ClassId) => CLASSES[c].name;
export const moveName = (m: MoveId) => MOVES[m].name;
