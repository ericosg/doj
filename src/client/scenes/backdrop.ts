import Phaser from "phaser";

const TINTS = [0x2a3a4a, 0x3a3048, 0x3a3a34, 0x4a2a22, 0x2a1a30];

/** Stone wall, floor, and flickering torches, tinted per room. */
export function drawDungeon(scene: Phaser.Scene, room: number, floorY = 300): void {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const base = Phaser.Display.Color.IntegerToColor(TINTS[room % TINTS.length]!);
  const shade = (k: number) => Phaser.Display.Color.GetColor(base.red * k, base.green * k, base.blue * k);

  const g = scene.add.graphics();
  g.fillStyle(shade(0.55)).fillRect(0, 0, W, floorY);
  for (let y = 0, row = 0; y < floorY; y += 24, row++) {
    for (let x = (row % 2) * -24; x < W; x += 48) {
      const k = 0.75 + ((x * 7 + y * 13) % 5) * 0.06;
      g.fillStyle(shade(k)).fillRect(x + 1, y + 1, 46, 22);
    }
  }
  g.fillGradientStyle(0x000000, 0x000000, shade(0.2), shade(0.2), 0.7, 0.7, 1, 1).fillRect(0, 0, W, floorY);
  g.fillGradientStyle(shade(0.5), shade(0.5), shade(0.15), shade(0.15), 1).fillRect(0, floorY, W, H - floorY);
  for (let x = 0; x < W; x += 64) g.lineStyle(1, shade(0.3), 0.6).lineBetween(x, floorY, W / 2 + (x - W / 2) * 2.2, H);

  for (const tx of [120, W - 120]) {
    g.fillStyle(0x3a2a1a).fillRect(tx - 4, 130, 8, 30);
    const flame = scene.add.ellipse(tx, 122, 14, 22, 0xffa030);
    const glow = scene.add.circle(tx, 124, 60, 0xffa040, 0.12);
    scene.tweens.add({ targets: [flame, glow], scaleX: 0.85, scaleY: 1.12, alpha: { from: 1, to: 0.75 }, duration: 140, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }
}
