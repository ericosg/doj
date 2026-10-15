import Phaser from "phaser";
import { ROOMS } from "../../shared/rules";
import { run } from "../run";
import { spriteKey } from "../sprites";
import { text } from "../ui";

export class EndScene extends Phaser.Scene {
  constructor() {
    super("end");
  }

  create(data: { won: boolean; killer?: string }) {
    const W = this.scale.width;
    this.cameras.main.setBackgroundColor(data.won ? "#1a1408" : "#100408").fadeIn(500);
    text(this, W / 2, 80, data.won ? "THE DUNGEON IS CLEARED" : "GAME OVER", 30, data.won ? "#ffd84a" : "#ff5050").setOrigin(0.5, 0);
    const hero = this.add.image(W / 2, 290, spriteKey(run.player.cls, "hero")).setScale(6).setOrigin(0.5, 1);
    if (!data.won) hero.setAngle(90).setAlpha(0.5).setPosition(W / 2 - 60, 220);
    const lines = data.won
      ? [`${run.player.name} defeated all ${ROOMS.length} of Jev's champions.`]
      : [`${run.player.name} fell in ${ROOMS[run.room]!.name}${data.killer ? ` to ${data.killer}` : ""}.`, `Rooms cleared: ${run.room}/${ROOMS.length}`];
    if (run.defeated.length) lines.push("", "Defeated: " + run.defeated.join(", "));
    text(this, W / 2, 330, lines.join("\n"), 11, "#ffffff", { align: "center", wordWrap: { width: W - 120 } }).setOrigin(0.5, 0);
    const prompt = text(this, W / 2, 480, "ENTER to play again", 12, "#ffd84a").setOrigin(0.5, 0);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    let leaving = false;
    const again = () => {
      if (leaving) return;
      leaving = true;
      this.scene.start("title");
    };
    this.time.delayedCall(600, () => {
      this.input.keyboard!.on("keydown", (e: KeyboardEvent) => ["Enter", " ", "z", "Z"].includes(e.key) && again());
      this.input.once("pointerdown", again);
    });
  }
}
