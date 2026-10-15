// Combat rules shared by the browser (to run the fight) and the server (to brief Jev).
// Everything is deterministic so the server can tell Jev the exact outcome of each move.

export type ClassId = "warrior" | "wizard";

export type MoveId =
  | "slash"
  | "guard"
  | "heavy_blow"
  | "war_cry"
  | "shield_bash"
  | "staff_strike"
  | "fireball"
  | "frost_ward"
  | "thunder"
  | "mend";

export interface Move {
  id: MoveId;
  name: string;
  mp: number;
  damage?: number;
  block?: number;
  heal?: number;
  burn?: { perTurn: number; turns: number };
  empower?: boolean; // next damaging move deals double
  weaken?: boolean; // target's next damaging move deals half
  text: string;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  maxHp: number;
  maxMp: number;
  mpRegen: number;
  moves: MoveId[];
  summary: string;
}

export const MOVES: Record<MoveId, Move> = {
  slash: { id: "slash", name: "Slash", mp: 0, damage: 9, text: "Deal 9 damage." },
  guard: { id: "guard", name: "Guard", mp: 0, block: 10, text: "Gain 10 block." },
  heavy_blow: { id: "heavy_blow", name: "Heavy Blow", mp: 10, damage: 18, text: "Deal 18 damage." },
  war_cry: { id: "war_cry", name: "War Cry", mp: 5, empower: true, text: "Your next attack deals double damage." },
  shield_bash: {
    id: "shield_bash",
    name: "Shield Bash",
    mp: 10,
    damage: 6,
    block: 6,
    weaken: true,
    text: "Deal 6 damage, gain 6 block. Target's next attack deals half damage.",
  },
  staff_strike: { id: "staff_strike", name: "Staff Strike", mp: 0, damage: 6, text: "Deal 6 damage." },
  fireball: {
    id: "fireball",
    name: "Fireball",
    mp: 12,
    damage: 14,
    burn: { perTurn: 4, turns: 3 },
    text: "Deal 14 damage. Burn: target takes 4 damage at the start of its next 3 turns.",
  },
  frost_ward: { id: "frost_ward", name: "Frost Ward", mp: 10, block: 14, text: "Gain 14 block." },
  thunder: { id: "thunder", name: "Thunder", mp: 22, damage: 24, text: "Deal 24 damage." },
  mend: { id: "mend", name: "Mend", mp: 14, heal: 22, text: "Restore 22 HP." },
};

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: {
    id: "warrior",
    name: "Warrior",
    maxHp: 80,
    maxMp: 20,
    mpRegen: 3,
    moves: ["slash", "guard", "heavy_blow", "war_cry", "shield_bash"],
    summary:
      "High HP (80), small MP pool (20, +3 per turn). Steady free damage and free block. Cannot heal. War Cry doubles the next hit; Shield Bash halves the opponent's next hit.",
  },
  wizard: {
    id: "wizard",
    name: "Wizard",
    maxHp: 64,
    maxMp: 36,
    mpRegen: 5,
    moves: ["staff_strike", "fireball", "frost_ward", "thunder", "mend"],
    summary:
      "Low HP (64), large MP pool (36, +5 per turn). Weak free attack; strong spells cost MP. Fireball burns over time, Thunder hits hardest, Mend heals.",
  },
};

export interface Fighter {
  cls: ClassId;
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  block: number;
  burn: { perTurn: number; turns: number } | null;
  empowered: boolean;
  weakened: boolean;
  bonusDamage: number; // flat bonus added to each damaging move (dungeon scaling)
}

export function makeFighter(cls: ClassId, name: string, opts: { hpMult?: number; bonusDamage?: number } = {}): Fighter {
  const def = CLASSES[cls];
  const maxHp = Math.round(def.maxHp * (opts.hpMult ?? 1));
  return {
    cls,
    name,
    hp: maxHp,
    maxHp,
    mp: def.maxMp,
    maxMp: def.maxMp,
    block: 0,
    burn: null,
    empowered: false,
    weakened: false,
    bonusDamage: opts.bonusDamage ?? 0,
  };
}

export function canAfford(f: Fighter, id: MoveId): boolean {
  return f.mp >= MOVES[id].mp;
}

export function availableMoves(f: Fighter): MoveId[] {
  return CLASSES[f.cls].moves.filter((m) => canAfford(f, m));
}

/** Damage a move would deal before the target's block, after attacker modifiers. */
export function rawDamage(attacker: Fighter, move: Move): number {
  if (!move.damage) return 0;
  let dmg = move.damage + attacker.bonusDamage;
  if (attacker.empowered) dmg *= 2;
  if (attacker.weakened) dmg = Math.floor(dmg / 2);
  return dmg;
}

export type BattleEvent =
  | { kind: "damage"; target: "self" | "foe"; amount: number; blocked: number }
  | { kind: "block"; target: "self"; amount: number }
  | { kind: "heal"; target: "self"; amount: number }
  | { kind: "burn"; target: "foe" }
  | { kind: "empower"; target: "self" }
  | { kind: "weaken"; target: "foe" };

function hit(target: Fighter, amount: number): { amount: number; blocked: number } {
  const blocked = Math.min(target.block, amount);
  target.block -= blocked;
  const dealt = amount - blocked;
  target.hp = Math.max(0, target.hp - dealt);
  return { amount: dealt, blocked };
}

/** Applies a move in place. Caller must have checked affordability. */
export function applyMove(attacker: Fighter, target: Fighter, id: MoveId): BattleEvent[] {
  const move = MOVES[id];
  const events: BattleEvent[] = [];
  attacker.mp -= move.mp;

  if (move.damage) {
    const r = hit(target, rawDamage(attacker, move));
    events.push({ kind: "damage", target: "foe", ...r });
    attacker.empowered = false;
    attacker.weakened = false;
  }
  if (move.block) {
    attacker.block += move.block;
    events.push({ kind: "block", target: "self", amount: move.block });
  }
  if (move.heal) {
    const before = attacker.hp;
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + move.heal);
    events.push({ kind: "heal", target: "self", amount: attacker.hp - before });
  }
  if (move.burn) {
    target.burn = { ...move.burn };
    events.push({ kind: "burn", target: "foe" });
  }
  if (move.empower) {
    attacker.empowered = true;
    events.push({ kind: "empower", target: "self" });
  }
  if (move.weaken) {
    target.weakened = true;
    events.push({ kind: "weaken", target: "foe" });
  }
  return events;
}

/** Start-of-turn upkeep: block expires, burn ticks, MP regenerates. Returns burn damage taken. */
export function startTurn(f: Fighter): number {
  f.block = 0;
  f.mp = Math.min(f.maxMp, f.mp + CLASSES[f.cls].mpRegen);
  if (!f.burn) return 0;
  const dmg = Math.min(f.hp, f.burn.perTurn);
  f.hp -= dmg;
  f.burn.turns -= 1;
  if (f.burn.turns <= 0) f.burn = null;
  return dmg;
}

export function cloneFighter(f: Fighter): Fighter {
  return { ...f, burn: f.burn ? { ...f.burn } : null };
}

export function hpStatus(f: Fighter): "healthy" | "wounded" | "badly wounded" | "near death" {
  const r = f.hp / f.maxHp;
  if (r > 0.7) return "healthy";
  if (r > 0.4) return "wounded";
  if (r > 0.2) return "badly wounded";
  return "near death";
}

/** Most damage `attacker` could deal to `target` with one move on their next turn (after their upkeep). */
export function maxThreat(attacker: Fighter, target: Fighter): { damage: number; move: MoveId | null } {
  const a = cloneFighter(attacker);
  a.mp = Math.min(a.maxMp, a.mp + CLASSES[a.cls].mpRegen);
  let best = { damage: 0, move: null as MoveId | null };
  for (const id of availableMoves(a)) {
    const dmg = Math.max(0, rawDamage(a, MOVES[id]) - target.block);
    if (dmg > best.damage) best = { damage: dmg, move: id };
  }
  return best;
}

// ---- Dungeon -------------------------------------------------------------

export interface Room {
  name: string;
  flavor: string;
}

export const ROOMS: Room[] = [
  { name: "The Sunken Gate", flavor: "Water drips from rusted portcullis teeth." },
  { name: "Hall of Echoes", flavor: "Every step answers back a heartbeat late." },
  { name: "The Ossuary", flavor: "Skulls watch from niches carved in the walls." },
  { name: "Forge of Ash", flavor: "Cold anvils, and embers that never die." },
  { name: "The Hollow Throne", flavor: "Something waits where the king once sat." },
];

export const ENEMY_NAMES: Record<ClassId, string[]> = {
  warrior: ["Gatewarden Brusk", "Sir Hollowmere", "Bonecrusher Vael", "Ashen Knight Orm", "The Hollow King"],
  wizard: ["Drowned Seer Ilsa", "Echo Witch Mirra", "Ossuary Lich Teth", "Cinder Magus Kael", "The Hollow Queen"],
};

/** Enemy scaling for room index 0..4. */
export function enemyScaling(room: number): { hpMult: number; bonusDamage: number } {
  return { hpMult: 1 + REST.enemyHpPerRoom * room, bonusDamage: Math.floor(room * REST.enemyDamagePerRoom) };
}

export const REST = { maxHp: 6, bonusDamage: 1, healFraction: 1, enemyHpPerRoom: 0.08, enemyDamagePerRoom: 0.5 };

/** Between rooms: grow a little stronger, heal, refill MP, clear statuses. Returns HP healed. */
export function restAfterVictory(f: Fighter): number {
  f.maxHp += REST.maxHp;
  f.bonusDamage += REST.bonusDamage;
  const before = f.hp;
  f.hp = Math.min(f.maxHp, f.hp + REST.maxHp + Math.round(f.maxHp * REST.healFraction));
  f.mp = f.maxMp;
  f.block = 0;
  f.burn = null;
  f.empowered = false;
  f.weakened = false;
  return f.hp - before;
}
