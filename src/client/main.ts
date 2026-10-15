import Phaser from "phaser";
import { BattleScene } from "./scenes/BattleScene";
import { EndScene } from "./scenes/EndScene";
import { MapScene } from "./scenes/MapScene";
import { TitleScene } from "./scenes/TitleScene";

// Text renders onto canvases, so wait for the pixel font before the first scene draws.
await document.fonts.load('16px "Press Start 2P"').catch(() => {});

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 540,
  backgroundColor: "#000000",
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TitleScene, MapScene, BattleScene, EndScene],
});

(window as unknown as { game: Phaser.Game }).game = game;
