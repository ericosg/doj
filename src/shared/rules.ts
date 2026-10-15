// Combat rules shared by the browser (to run the fight) and the server (to brief Jev).
// Everything is deterministic so the server can tell Jev the exact outcome of each move.

export type HeroClass = "warrior" | "wizard";
export type BossForm = "druid" | "bear" | "wolf";
export type ClassId = HeroClass | BossForm;

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
  | "mend"
  // The Hollow Druid (boss only)
  | "thorn_lash"
  | "entangle"
  | "moonfire"
  | "rejuvenate"
  | "swipe"
  | "thick_hide"
  | "roar"
  | "maul"
  | "bite"
  | "rend"
  | "frenzy"
  | "pounce"
  | "shift_druid"
  | "shift_bear"
  | "shift_wolf";

export type DotKind = "burn" | "bleed";

export interface Move {
  id: MoveId;
  name: string;
  mp: number;
  damage?: number; // per hit
  hits?: number; // damage is applied this many times (block soaks each hit in turn)
  block?: number;
  heal?: number;
  burn?: { perTurn: number; turns: number; kind: DotKind };
  empower?: boolean; // next damaging move deals double
  weaken?: boolean; // target's next damaging move deals half
  cleanse?: boolean; // removes the user's burn/bleed and weakness
  shift?: BossForm; // changes the user's form (boss only)
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
  playable: boolean;
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
    burn: { perTurn: 4, turns: 3, kind: "burn" },
    text: "Deal 14 damage. Burn: target takes 4 damage at the start of its next 3 turns.",
  },
  frost_ward: { id: "frost_ward", name: "Frost Ward", mp: 10, block: 14, text: "Gain 14 block." },
  thunder: { id: "thunder", name: "Thunder", mp: 22, damage: 24, text: "Deal 24 damage." },
  mend: { id: "mend", name: "Mend", mp: 14, heal: 22, text: "Restore 22 HP." },

  // Druid form: a caster that wears the opponent down and heals.
  thorn_lash: { id: "thorn_lash", name: "Thorn Lash", mp: 0, damage: 7, text: "Deal 7 damage." },
  entangle: { id: "entangle", name: "Entangle", mp: 8, damage: 6, weaken: true, text: "Deal 6 damage. Target's next attack deals half damage." },
  moonfire: {
    id: "moonfire",
    name: "Moonfire",
    mp: 12,
    damage: 10,
    burn: { perTurn: 4, turns: 3, kind: "burn" },
    text: "Deal 10 damage. Burn: target takes 4 damage at the start of its next 3 turns.",
  },
  rejuvenate: { id: "rejuvenate", name: "Rejuvenate", mp: 14, heal: 24, text: "Restore 24 HP." },
  // Bear form: soaks damage and hits hard.
  swipe: { id: "swipe", name: "Swipe", mp: 0, damage: 9, text: "Deal 9 damage." },
  thick_hide: { id: "thick_hide", name: "Thick Hide", mp: 9, block: 14, text: "Gain 14 block." },
  roar: { id: "roar", name: "Roar", mp: 6, block: 8, weaken: true, text: "Gain 8 block. Target's next attack deals half damage." },
  maul: { id: "maul", name: "Maul", mp: 14, damage: 20, text: "Deal 20 damage." },
  // Wolf form: fast, many hits, bleeding.
  bite: { id: "bite", name: "Bite", mp: 0, damage: 7, text: "Deal 7 damage." },
  rend: {
    id: "rend",
    name: "Rend",
    mp: 10,
    damage: 6,
    burn: { perTurn: 5, turns: 3, kind: "bleed" },
    text: "Deal 6 damage. Bleed: target takes 5 damage at the start of its next 3 turns.",
  },
  frenzy: { id: "frenzy", name: "Frenzy", mp: 8, damage: 6, hits: 2, text: "Hit twice for 6 damage each." },
  pounce: { id: "pounce", name: "Pounce", mp: 12, damage: 16, text: "Deal 16 damage." },
  // Shifting is a free action: the boss gets the entry bonus, then still acts this turn in the new form.
  shift_druid: { id: "shift_druid", name: "Shift: Druid", mp: 0, shift: "druid", heal: 8, text: "Free action: take Druid form and restore 8 HP, then act this turn in Druid form." },
  shift_bear: { id: "shift_bear", name: "Shift: Bear", mp: 0, shift: "bear", block: 8, text: "Free action: take Bear form and gain 8 block, then act this turn in Bear form." },
  shift_wolf: { id: "shift_wolf", name: "Shift: Wolf", mp: 0, shift: "wolf", cleanse: true, text: "Free action: take Wolf form and shed all burns, bleeds and weakness, then act this turn in Wolf form." },
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
    playable: true,
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
    playable: true,
  },
  // Boss forms share the boss's HP and MP pools; maxHp/maxMp here are unused.
  druid: {
    id: "druid",
    name: "Druid",
    maxHp: 0,
    maxMp: 0,
    mpRegen: 6,
    moves: ["thorn_lash", "entangle", "moonfire", "rejuvenate", "shift_bear", "shift_wolf"],
    summary: "Caster form (+6 MP per turn). Moonfire burns, Entangle halves the opponent's next hit, Rejuvenate heals 24.",
    playable: false,
  },
  bear: {
    id: "bear",
    name: "Bear",
    maxHp: 0,
    maxMp: 0,
    mpRegen: 4,
    moves: ["swipe", "thick_hide", "roar", "maul", "shift_druid", "shift_wolf"],
    summary: "Tank form (+4 MP per turn). Thick Hide blocks 14, Roar blocks and halves the opponent's next hit, Maul deals 20.",
    playable: false,
  },
  wolf: {
    id: "wolf",
    name: "Wolf",
    maxHp: 0,
    maxMp: 0,
    mpRegen: 5,
    moves: ["bite", "rend", "frenzy", "pounce", "shift_druid", "shift_bear"],
    summary: "Hunter form (+5 MP per turn). Rend bleeds 15 over 3 turns, Frenzy hits twice, Pounce deals 16. No defence.",
    playable: false,
  },
};

export const HERO_CLASSES: HeroClass[] = ["warrior", "wizard"];

/** After shifting, the boss's next chance to shift is the turn after next. */
export const SHIFT_COOLDOWN = 2;
export const BOSS_FORMS: BossForm[] = ["druid", "bear", "wolf"];

export interface Fighter {
  cls: ClassId;
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  block: number;
  burn: { perTurn: number; turns: number; kind: DotKind } | null;
  empowered: boolean;
  weakened: boolean;
  bonusDamage: number; // flat bonus added to each damaging move (dungeon scaling)
  shiftCooldown: number; // turns until the boss may shift again (0 = now)
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
    shiftCooldown: 0,
  };
}

export const BOSS = { name: "The Hollow Druid", maxHp: 130, maxMp: 36, bonusDamage: 0 };

export function makeBoss(form: BossForm, room: number): Fighter {
  return { ...makeFighter(form, BOSS.name, { bonusDamage: BOSS.bonusDamage }), hp: BOSS.maxHp, maxHp: BOSS.maxHp, mp: BOSS.maxMp, maxMp: BOSS.maxMp };
}

export function isBossForm(c: ClassId): c is BossForm {
  return !CLASSES[c].playable;
}

export function canAfford(f: Fighter, id: MoveId): boolean {
  return f.mp >= MOVES[id].mp;
}

export function availableMoves(f: Fighter): MoveId[] {
  return CLASSES[f.cls].moves.filter((m) => canAfford(f, m) && !(MOVES[m].shift && f.shiftCooldown > 0));
}

/** Damage of one hit before the target's block, after attacker modifiers. */
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
  | { kind: "burn"; target: "foe"; dot: DotKind }
  | { kind: "empower"; target: "self" }
  | { kind: "weaken"; target: "foe" }
  | { kind: "cleanse"; target: "self" }
  | { kind: "shift"; target: "self"; form: BossForm };

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
  if (move.shift) attacker.shiftCooldown = SHIFT_COOLDOWN;

  if (move.shift) {
    attacker.cls = move.shift;
    events.push({ kind: "shift", target: "self", form: move.shift });
  }
  if (move.damage) {
    const dmg = rawDamage(attacker, move);
    for (let i = 0; i < (move.hits ?? 1) && target.hp > 0; i++) events.push({ kind: "damage", target: "foe", ...hit(target, dmg) });
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
    events.push({ kind: "burn", target: "foe", dot: move.burn.kind });
  }
  if (move.empower) {
    attacker.empowered = true;
    events.push({ kind: "empower", target: "self" });
  }
  if (move.weaken) {
    target.weakened = true;
    events.push({ kind: "weaken", target: "foe" });
  }
  if (move.cleanse) {
    attacker.burn = null;
    attacker.weakened = false;
    events.push({ kind: "cleanse", target: "self" });
  }
  return events;
}

/** Start-of-turn upkeep: block expires, burn ticks, MP regenerates. Returns burn damage taken. */
export function startTurn(f: Fighter): number {
  f.block = 0;
  if (f.shiftCooldown > 0) f.shiftCooldown--;
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
    const dmg = Math.max(0, rawDamage(a, MOVES[id]) * (MOVES[id].hits ?? 1) - target.block);
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
  { name: "The Hollow Throne", flavor: "Something waits on the empty throne, in no fixed shape." },
];

/** The last room holds the boss instead of a champion. */
export const BOSS_ROOM = ROOMS.length - 1;

export const ENEMY_NAMES: Record<HeroClass, string[]> = {
  warrior: ["Gatewarden Brusk", "Sir Hollowmere", "Bonecrusher Vael", "Ashen Knight Orm"],
  wizard: ["Drowned Seer Ilsa", "Echo Witch Mirra", "Ossuary Lich Teth", "Cinder Magus Kael"],
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
  f.shiftCooldown = 0;
  return f.hp - before;
}
