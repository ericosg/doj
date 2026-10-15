// State for one trip through the dungeon.
import { REST, makeFighter, restAfterVictory, type ClassId, type Fighter, type MoveId } from "../shared/rules";

export interface Run {
  player: Fighter;
  room: number; // index of the next room to fight in
  moveCounts: Partial<Record<MoveId, number>>;
  restMessage: string | null;
  defeated: string[];
}

export let run: Run;

export function newRun(cls: ClassId): Run {
  run = { player: makeFighter(cls, cls === "warrior" ? "Aldric" : "Lyra"), room: 0, moveCounts: {}, restMessage: null, defeated: [] };
  return run;
}

export function favoriteMoves(): MoveId[] {
  return (Object.entries(run.moveCounts) as [MoveId, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m]) => m);
}

export function rest(): void {
  const healed = restAfterVictory(run.player);
  run.restMessage = `You rest. +${healed} HP, MP restored. Max HP +${REST.maxHp}, attacks +${REST.bonusDamage}.`;
}
