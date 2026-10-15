import Phaser from "phaser";
import { CLASSES, MOVES, type ClassId } from "../../shared/rules";
import { jevOnline } from "../ai";
import { newRun, skipToBoss } from "../run";
import { makeTextures, spriteKey } from "../sprites";
import { isMuted, playMusic, sfx } from "../sfx";
import { drawWindow, text } from "../ui";
import { drawDungeon } from "./backdrop";

export class TitleScene extends Phaser.Scene {
  private pick: ClassId = "warrior";
  private starting = false;
  private cards: Record<ClassId, { frame: Phaser.GameObjects.Graphics; sprite: Phaser.GameObjects.Image }> = {} as never;

  constructor() {
    super("title");
  }

  create() {
    this.starting = false;
    makeTextures(this);
    const W = this.scale.width;
    drawDungeon(this, 4, 330);
    text(this, W / 2, 40, "DUNGEON OF JEV", 36, "#ffd84a").setOrigin(0.5, 0);
    text(this, W / 2, 92, "Four champions, then the Hollow Druid. Every foe is played by Jev.", 10, "#d0d8ff").setOrigin(0.5, 0);
    playMusic("title");
    const status = text(this, W / 2, 112, "Checking Jev...", 10, "#a0a0b0").setOrigin(0.5, 0);
    jevOnline().then((on) =>
      status.setText(on ? "Jev is online and waiting for you." : "Jev is unavailable right now - foes will use a simple fallback AI.").setColor(on ? "#80ffa0" : "#ff8080"),
    );

    (["warrior", "wizard"] as ClassId[]).forEach((cls, i) => this.card(cls, 110 + i * 390, 140));
    text(this, W / 2, 510, "LEFT/RIGHT to choose  -  ENTER to descend", 12, "#ffffff").setOrigin(0.5, 0);
    const sound = text(this, W - 12, 8, "", 8, "#8080a0").setOrigin(1, 0);
    const showSound = () => sound.setText(`M: sound ${isMuted() ? "off" : "on"}`);
    showSound();
    this.select("warrior");

    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "d", "A", "D"].includes(e.key)) (this.select(this.pick === "warrior" ? "wizard" : "warrior"), sfx.move());
      else if (["Enter", " ", "z", "Z"].includes(e.key)) this.start();
      else if (e.key === "m" || e.key === "M") this.time.delayedCall(0, showSound);
    });
  }

  private card(cls: ClassId, x: number, y: number) {
    const def = CLASSES[cls];
    const w = 350;
    const h = 362;
    drawWindow(this, x, y, w, h);
    const frame = this.add.graphics();
    const sprite = this.add.image(x + 70, y + 92, spriteKey(cls, "hero")).setScale(5);
    text(this, x + 140, y + 24, def.name.toUpperCase(), 18, "#ffd84a");
    text(this, x + 140, y + 56, `HP ${def.maxHp}\nMP ${def.maxMp}  (+${def.mpRegen}/turn)`, 11, "#d0e8ff");
    def.moves.forEach((m, j) => {
      const mv = MOVES[m];
      text(this, x + 22, y + 160 + j * 39, mv.name, 11, "#ffffff");
      text(this, x + w - 22, y + 160 + j * 39, mv.mp ? `${mv.mp} MP` : "free", 11, "#a0e0ff").setOrigin(1, 0);
      text(this, x + 22, y + 175 + j * 39, mv.text, 7, "#b0b8d8", { wordWrap: { width: w - 44 }, lineSpacing: 3 });
    });
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on("pointerover", () => this.pick !== cls && (this.select(cls), sfx.move()));
    zone.on("pointerdown", () => (this.select(cls), this.start()));
    this.cards[cls] = { frame, sprite };
    this.tweens.add({ targets: sprite, y: sprite.y - 4, duration: 700 + 200 * Number(cls === "wizard"), yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    frame.setData("rect", [x, y, w, h]);
  }

  private select(cls: ClassId) {
    this.pick = cls;
    for (const [c, { frame, sprite }] of Object.entries(this.cards) as [ClassId, (typeof this.cards)[ClassId]][]) {
      const [x, y, w, h] = frame.getData("rect") as number[];
      frame.clear();
      if (c === cls) frame.lineStyle(4, 0xffd84a, 1).strokeRoundedRect(x! - 4, y! - 4, w! + 8, h! + 8, 8);
      sprite.setAlpha(c === cls ? 1 : 0.55);
    }
  }

  private start() {
    if (this.starting) return;
    this.starting = true;
    sfx.confirm();
    newRun(this.pick);
    if (location.hash === "#boss") skipToBoss();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("map"));
  }
}
