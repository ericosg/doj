// Final Fantasy style UI: blue gradient windows, a hand cursor menu, and stat bars.
import Phaser from "phaser";
import { sfx } from "./sfx";

export const FONT = '"Press Start 2P", monospace';

export function text(scene: Phaser.Scene, x: number, y: number, s: string, size = 12, color = "#ffffff", extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, lineSpacing: 6, ...extra }).setShadow(2, 2, "#000000", 0, false, true);
}

export function drawWindow(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillGradientStyle(0x3048b8, 0x3048b8, 0x0a1250, 0x0a1250, 0.96);
  g.fillRect(x + 3, y + 3, w - 6, h - 6);
  g.lineStyle(3, 0xf0f0ff, 1);
  g.strokeRoundedRect(x + 1.5, y + 1.5, w - 3, h - 3, 6);
  g.lineStyle(1, 0x7880b0, 1);
  g.strokeRoundedRect(x + 4.5, y + 4.5, w - 9, h - 9, 4);
  return g;
}

export class Bar {
  private g: Phaser.GameObjects.Graphics;
  constructor(
    private scene: Phaser.Scene,
    private x: number,
    private y: number,
    private w: number,
    private h: number,
    private color: number,
  ) {
    this.g = scene.add.graphics();
  }
  private shown = -1;
  set(value: number, max: number, animate = true) {
    const target = max > 0 ? Phaser.Math.Clamp(value / max, 0, 1) : 0;
    const from = this.shown < 0 ? target : this.shown;
    if (!animate || from === target) return this.draw(target);
    this.scene.tweens.addCounter({ from, to: target, duration: 350, onUpdate: (tw) => this.draw(tw.getValue() ?? target) });
  }
  private draw(r: number) {
    this.shown = r;
    const g = this.g.clear();
    g.fillStyle(0x000000, 0.8).fillRect(this.x - 1, this.y - 1, this.w + 2, this.h + 2);
    g.fillStyle(0x30303a, 1).fillRect(this.x, this.y, this.w, this.h);
    const c = this.color === 0x40e070 && r < 0.25 ? 0xe04040 : this.color === 0x40e070 && r < 0.5 ? 0xe0c040 : this.color;
    g.fillStyle(c, 1).fillRect(this.x, this.y, Math.round(this.w * r), this.h);
    g.fillStyle(0xffffff, 0.25).fillRect(this.x, this.y, Math.round(this.w * r), Math.max(1, this.h / 3));
  }
  destroy() {
    this.g.destroy();
  }
}

export interface MenuItem<T> {
  label: string;
  right?: string;
  enabled: boolean;
  value: T;
}

/** Vertical menu with a pointing-hand cursor. Arrow keys / W,S to move, Enter / Z / Space to pick, or mouse. */
export class Menu<T> {
  private texts: Phaser.GameObjects.Text[] = [];
  private rights: Phaser.GameObjects.Text[] = [];
  private hand: Phaser.GameObjects.Image;
  private index = 0;
  private active = false;
  private keyHandler: (e: KeyboardEvent) => void;

  constructor(
    private scene: Phaser.Scene,
    private x: number,
    private y: number,
    private width: number,
    private items: MenuItem<T>[],
    private onPick: (value: T) => void,
    private onHover: (value: T) => void = () => {},
    private rowH = 26,
  ) {
    this.hand = scene.add.image(x - 30, y, "hand").setScale(2).setOrigin(0, 0).setDepth(10);
    items.forEach((it, i) => {
      const t = text(scene, x, y + i * rowH, it.label, 13, it.enabled ? "#ffffff" : "#7a7a90").setInteractive({ useHandCursor: true });
      t.on("pointerover", () => this.active && i !== this.index && (this.select(i), sfx.move()));
      t.on("pointerdown", () => this.active && (this.select(i), this.confirm()));
      this.texts.push(t);
      if (it.right) this.rights.push(text(scene, x + width, y + i * rowH, it.right, 13, it.enabled ? "#a0e0ff" : "#5a5a70").setOrigin(1, 0));
    });
    this.keyHandler = (e) => {
      if (!this.active) return;
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") (this.select((this.index + 1) % items.length), sfx.move());
      else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") (this.select((this.index - 1 + items.length) % items.length), sfx.move());
      else if (e.key === "Enter" || e.key === " " || e.key === "z" || e.key === "Z") this.confirm();
    };
    scene.input.keyboard!.on("keydown", this.keyHandler);
    this.setActive(false);
    this.select(Math.max(0, items.findIndex((it) => it.enabled)));
  }

  private select(i: number) {
    this.index = i;
    this.hand.y = this.y + i * this.rowH - 1;
    this.texts.forEach((t, j) => t.setColor(!this.items[j]!.enabled ? "#7a7a90" : j === i ? "#ffffa0" : "#ffffff"));
    this.onHover(this.items[i]!.value);
  }

  private confirm() {
    const it = this.items[this.index]!;
    if (!it.enabled) {
      sfx.deny();
      this.scene.cameras.main.shake(80, 0.002);
      return;
    }
    sfx.confirm();
    this.setActive(false);
    this.onPick(it.value);
  }

  setActive(on: boolean) {
    this.active = on;
    this.hand.setVisible(on);
    if (on) {
      this.scene.tweens.killTweensOf(this.hand);
      this.hand.x = this.x - 30;
      this.scene.tweens.add({ targets: this.hand, x: this.x - 34, duration: 300, yoyo: true, repeat: -1 });
      this.select(this.items[this.index]!.enabled ? this.index : Math.max(0, this.items.findIndex((it) => it.enabled)));
    }
  }

  destroy() {
    this.scene.input.keyboard?.off("keydown", this.keyHandler);
    [...this.texts, ...this.rights, this.hand].forEach((o) => o.destroy());
  }
}
