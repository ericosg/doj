import Phaser from "phaser";
import { ROOMS } from "../../shared/rules";
import { run } from "../run";
import { spriteKey } from "../sprites";
import { drawWindow, text } from "../ui";

/** The dungeon path: one node per room, each room is a fight. */
export class MapScene extends Phaser.Scene {
  constructor() {
    super("map");
  }

  create() {
    const W = this.scale.width;
    this.cameras.main.setBackgroundColor("#08060e").fadeIn(300);
    text(this, W / 2, 30, "THE DESCENT", 22, "#ffd84a").setOrigin(0.5, 0);

    const y = 210;
    const xs = ROOMS.map((_, i) => 120 + i * 180);
    const g = this.add.graphics();
    g.lineStyle(4, 0x404060).lineBetween(xs[0]!, y, xs[xs.length - 1]!, y);
    ROOMS.forEach((room, i) => {
      const cleared = i < run.room;
      const current = i === run.room;
      const color = cleared ? 0x406040 : current ? 0xffd84a : 0x303048;
      g.fillStyle(0x000000).fillCircle(xs[i]!, y, 26);
      g.fillStyle(color).fillCircle(xs[i]!, y, 22);
      text(this, xs[i]!, y, cleared ? "X" : i === ROOMS.length - 1 ? "!" : String(i + 1), 14, current ? "#000000" : "#ffffff").setOrigin(0.5).setShadow(0, 0);
      text(this, xs[i]!, y + 40, room.name.replace("The ", "").replace(" ", "\n"), 9, current ? "#ffffff" : "#8080a0", { align: "center" }).setOrigin(0.5, 0);
      if (cleared && run.defeated[i]) text(this, xs[i]!, y - 52, run.defeated[i]!.split(" ").slice(-1)[0]!, 8, "#70a070").setOrigin(0.5, 0);
    });
    const hero = this.add.image(xs[run.room]!, y - 70, spriteKey(run.player.cls, "hero")).setScale(2.5).setFlipX(true);
    this.tweens.add({ targets: hero, y: hero.y - 6, duration: 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    drawWindow(this, 160, 330, W - 320, 170);
    const room = ROOMS[run.room]!;
    const p = run.player;
    const lines = [
      ...(run.restMessage ? [run.restMessage, ""] : []),
      `Room ${run.room + 1}: ${room.name}`,
      room.flavor,
      "",
      `${p.name} the ${p.cls === "warrior" ? "Warrior" : "Wizard"}   HP ${p.hp}/${p.maxHp}   MP ${p.mp}/${p.maxMp}`,
    ];
    text(this, 190, 352, lines.join("\n"), 10, "#ffffff", { wordWrap: { width: W - 380 } });
    const prompt = text(this, W / 2, 470, "ENTER to fight", 12, "#ffd84a").setOrigin(0.5, 0);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

    let leaving = false;
    const go = () => {
      if (leaving) return;
      leaving = true;
      this.cameras.main.flash(250, 255, 255, 255);
      this.time.delayedCall(250, () => this.scene.start("battle"));
    };
    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => ["Enter", " ", "z", "Z"].includes(e.key) && go());
    this.input.once("pointerdown", go);
  }
}
