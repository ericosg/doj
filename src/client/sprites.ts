// Pixel-art sprites drawn from character maps into canvas textures (no image assets needed).
import Phaser from "phaser";
import type { ClassId } from "../shared/rules";

// All maps face right. '.' is transparent; other characters index into a palette.
const MAPS: Record<ClassId | "hand", string[]> = {
  druid: [
    "..T........T........",
    "..TT......TT........",
    "...TT.KKK.T.....LL..",
    "....TKHHHKT....LOOL.",
    "....KHHHHHK....LOOL.",
    "...KHhHHHHHK....LL..",
    "...KHhKSSESK....KN..",
    "...KHhKSSSSK....KN..",
    "...KHhhKSSK.....KN..",
    "..KHRRhKKKRK....KN..",
    "..KRRRRLRRRRK...KN..",
    ".KRRrRRLRRrRRK.SSN..",
    ".KRRrRRRRRrRRKSSKN..",
    ".KRRrRRLRRrRRKKK.N..",
    ".KRRrRRRRRrRK....N..",
    ".KRRrRRLRRrRK....N..",
    "KRRRrRRRRRrRRK...N..",
    "KRRRrRRLRRrRRK...N..",
    "KRRRRRRRRRRRRK...N..",
    "KRLRRLRRLRRLRRK..N..",
    "KKKKKKKKKKKKKKK..N..",
  ],
  bear: [
    "...............KK...KK....",
    "..............KBBK.KBBK...",
    "..............KBBBKBBBBK..",
    ".............KBBBBBBBBBBK.",
    "............KBBBBBBEBBBBK.",
    "............KBBBBBBBBBnnK.",
    "...........KBBBBBBBBBnnNK.",
    "..........KBBBBBBBBBBnnnK.",
    "....KKKKKKBBBBBBBBBKKWKWK.",
    "...KBBBBBBBBBBBBBBBBK.....",
    "..KBBBBBBBBBBBBBBBBBBK....",
    ".KBBBbBBBBBBBBBBBBBBBBK...",
    ".KBBbBBBBBBBBBBBBBBBBBK...",
    "KBBBbBBBBBBBBBBBBBBBBBBK..",
    "KBBBBBBBBBBBBBBBBBBBBBBK..",
    "KBBBBBBBBBBBBBBBBBBBBBBK..",
    ".KBBBBKBBBBBBBBBKBBBBBK...",
    "..KBBBK.KBBBBBK..KBBBK....",
    "..KBBK...KBBBK....KBBK....",
    ".KCCCK..KCCCCK...KCCCK....",
    ".KKKKK..KKKKKK...KKKKK....",
  ],
  wolf: [
    "..................K..K.....",
    ".................KGKKGK....",
    ".................KGGGGGK...",
    "................KGGGEGGGK..",
    "................KGGGGGGGGKK",
    "......KKKKKKKKKKGGGGGGgggNK",
    ".....KGGGGGGGGGGGGGGGKggKK.",
    "KK..KGGGGGGGGGGGGGGGGKWKW..",
    "KGKKGGgGGGGGGGGGGGGGGK.....",
    ".KGGGGgGGGGGGGGGGGGGGK.....",
    "..KKGGgGGGGGGGGGGGGGK......",
    "....KGGGGGGGGGGGGGGGK......",
    "....KGGKKGGGGGGKKGGK.......",
    "....KGK.KGK..KGK.KGK.......",
    "....KGK.KGK..KGK.KGK.......",
    "...KCCK.KCCK.KCCKKCCK......",
    "...KKKK.KKKK.KKKKKKKK......",
  ],
  warrior: [
    "......KKKKK.........",
    ".....KHHHHHK........",
    "....KHHHHHHHK.......",
    "....KhHHHHHHK.......",
    "....KhHKKKKKKK......",
    "....KhKSSSESSK......",
    "....KhKSSSSSSK..KK..",
    ".....KKKSSSSK..KWK..",
    "....KRKKKKKKK.KWK...",
    "...KRRKAAAAAAKKWK...",
    "..KRRKAAAaAAAAKK....",
    "..KRRKAAaAAAAKSGK...",
    "..KRRKAaAAAAKSSGK...",
    "..KRRKAAAAAAAKKK....",
    "..KRKKGGGGGGGK......",
    "..KRKAAAAKAAAK......",
    "...KKAAAAKAAAK......",
    "....KaaaK.KaaK......",
    "....KAAK..KAAK......",
    "....KBBK..KBBK......",
    "...KBBBK..KBBBK.....",
    "...KKKKK..KKKKK.....",
  ],
  wizard: [
    "........KK..........",
    ".......KPPK.........",
    "......KPPYK.........",
    ".....KPPPPK......KK.",
    ".....KPPPPPK....KOOK",
    "....KPPPPPPK....KOOK",
    "..KKKKKKKKKKKK...KK.",
    "....KKSSSSESK....KN.",
    "....KSSSSSSSK....KN.",
    "....KWWWWWWWK....KN.",
    "...KPKWWWWWKPK...KN.",
    "..KPPPKWWWKPPPK..KN.",
    "..KPPpPKWKPPpPKSSKN.",
    "..KPPpPPKPPPpPKSSKN.",
    "..KPPpPPYPPPpPKKKKN.",
    "..KPPpPPPPPPpPK..KN.",
    "..KPPpPPPPPPpPK..KN.",
    ".KPPPpPPPPPPpPPK.KN.",
    ".KPPPpPPPPPPpPPK.KN.",
    ".KPPPPPPPPPPPPPK.KN.",
    "KPPPPPPPPPPPPPPPKKN.",
    "KKKKKKKKKKKKKKKKK.K.",
  ],
  hand: [
    "..KKKK......",
    ".KWWWWKKKKK.",
    "KWWWWWWWWWWK",
    "KWWWWWKKKKK.",
    "KWWWWWWWK...",
    "KWWWWWKK....",
    ".KWWWWWWK...",
    "..KKKKKK....",
  ],
};

type Palette = Record<string, string>;

const PALETTES: Record<string, { map: keyof typeof MAPS; palette: Palette }> = {
  "warrior-hero": {
    map: "warrior",
    palette: { K: "#160e1e", H: "#d4dbea", h: "#7f8aa3", S: "#f2c79a", E: "#160e1e", A: "#3a6fd8", a: "#23449a", R: "#c0303a", G: "#e8c040", B: "#6b4426", W: "#eef4ff" },
  },
  "warrior-foe": {
    map: "warrior",
    palette: { K: "#0c0810", H: "#5a5560", h: "#34303a", S: "#a89c8c", E: "#ff3a3a", A: "#7a1c2a", a: "#480e18", R: "#2a2a2e", G: "#a08030", B: "#3a2418", W: "#b8c0cc" },
  },
  "wizard-hero": {
    map: "wizard",
    palette: { K: "#160e1e", P: "#5146c8", p: "#2d2480", Y: "#ffd84a", S: "#f2c79a", E: "#160e1e", W: "#f0f0f0", O: "#6ef0ff", N: "#8b5a2b" },
  },
  "wizard-foe": {
    map: "wizard",
    palette: { K: "#0c0810", P: "#2f6b3a", p: "#183d20", Y: "#c0ff60", S: "#a8c0a0", E: "#ff3a3a", W: "#7c7c84", O: "#c060ff", N: "#3a2a1a" },
  },
  "druid-foe": {
    map: "druid",
    palette: { K: "#0c0810", T: "#d8c8a0", H: "#3d5a2a", h: "#26381a", S: "#9ab08a", E: "#ffe040", R: "#5a4a2a", r: "#3a2e1a", L: "#6ac04a", O: "#b0ff70", N: "#5a3a1a" },
  },
  "bear-foe": { map: "bear", palette: { K: "#0c0810", B: "#6b4a2e", b: "#4a3220", n: "#a07850", N: "#1a1010", E: "#ff4030", W: "#f0f0e0", C: "#e8e0c0" } },
  "wolf-foe": { map: "wolf", palette: { K: "#0c0810", G: "#7a7a88", g: "#c0c0c8", N: "#1a1010", E: "#ffd030", W: "#f0f0e0", C: "#e8e0c0" } },
  hand: { map: "hand", palette: { K: "#160e1e", W: "#ffffff" } },
};

export function spriteKey(cls: ClassId, side: "hero" | "foe"): string {
  return `${cls}-${side}`;
}

export function makeTextures(scene: Phaser.Scene): void {
  for (const [key, { map, palette }] of Object.entries(PALETTES)) {
    if (scene.textures.exists(key)) continue;
    const rows = MAPS[map];
    const w = Math.max(...rows.map((r) => r.length));
    const tex = scene.textures.createCanvas(key, w, rows.length)!;
    const ctx = tex.context;
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const color = palette[ch];
        if (!color) return;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      });
    });
    tex.refresh();
  }
  if (!scene.textures.exists("spark")) {
    const tex = scene.textures.createCanvas("spark", 4, 4)!;
    tex.context.fillStyle = "#ffffff";
    tex.context.fillRect(0, 0, 4, 4);
    tex.refresh();
  }
}
