import Phaser from "phaser";
import {
  BOSS,
  BOSS_ROOM,
  CLASSES,
  ENEMY_NAMES,
  MOVES,
  ROOMS,
  applyMove,
  canAfford,
  enemyScaling,
  isBossForm,
  makeBoss,
  makeFighter,
  startTurn,
  type BattleEvent,
  type BossForm,
  type Fighter,
  type MoveId,
} from "../../shared/rules";
import { chooseBossForm, chooseEnemyClass, chooseEnemyMove, type Decision } from "../ai";
import { playMusic, sfx } from "../sfx";
import { favoriteMoves, rest, run } from "../run";
import { spriteKey } from "../sprites";
import { Bar, Menu, drawWindow, text } from "../ui";
import { drawDungeon } from "./backdrop";

const FLOOR = 300;

interface Side {
  f: Fighter;
  sprite: Phaser.GameObjects.Image;
  hp: Bar;
  mp: Bar;
  info: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  dir: 1 | -1; // direction it lunges toward its opponent
  homeX: number;
  scale: number;
}

export class BattleScene extends Phaser.Scene {
  private hero!: Side;
  private foe!: Side;
  private message!: Phaser.GameObjects.Text;
  private menu: Menu<MoveId> | null = null;
  private jevPanel: Phaser.GameObjects.GameObject[] = [];
  private turn = 0;
  private playerRecent: MoveId[] = [];

  constructor() {
    super("battle");
  }

  create() {
    this.turn = 0;
    this.playerRecent = [];
    this.menu = null;
    this.jevPanel = [];
    const W = this.scale.width;
    this.cameras.main.fadeIn(250);
    playMusic(run.room === BOSS_ROOM ? "boss" : "battle");
    drawDungeon(this, run.room, FLOOR);

    drawWindow(this, 10, 8, W - 20, 52);
    this.message = text(this, 30, 26, "", 11, "#ffffff", { wordWrap: { width: W - 60 } });

    drawWindow(this, 10, 360, 318, 172);
    drawWindow(this, 334, 360, 292, 172);
    drawWindow(this, 632, 360, 318, 172);

    this.hero = this.makeSide(run.player, 790, 650, "hero", -1);
    this.renderJev(null, "Waiting for the champion...");
    this.say(`Room ${run.room + 1}: ${ROOMS[run.room]!.name}`);
    void this.intro();
  }

  // ---- Layout -------------------------------------------------------------

  private makeSide(f: Fighter, spriteX: number, panelX: number, side: "hero" | "foe", dir: 1 | -1): Side {
    const scale = isBossForm(f.cls) ? 7 : 6;
    const sprite = this.add.image(spriteX, FLOOR + 6, spriteKey(f.cls, side)).setOrigin(0.5, 1).setScale(scale).setFlipX(side === "hero");
    this.add.ellipse(spriteX, FLOOR + 6, scale === 7 ? 170 : 110, 18, 0x000000, 0.35).setDepth(-1);
    const info = text(this, panelX + 20, 378, "", 11, "#ffffff");
    text(this, panelX + 20, 418, "HP", 9, "#a0a0c0");
    text(this, panelX + 20, 444, "MP", 9, "#a0a0c0");
    const hp = new Bar(this, panelX + 52, 418, 200, 10, 0x40e070);
    const mp = new Bar(this, panelX + 52, 444, 200, 10, 0x4aa0ff);
    const status = text(this, panelX + 20, 470, "", 9, "#ffd84a", { wordWrap: { width: 280 } });
    const s: Side = { f, sprite, hp, mp, info, status, dir, homeX: spriteX, scale };
    this.breathe(s);
    this.refresh(s, false);
    return s;
  }

  /** Idle animation. Restart it after any other tween that changes the sprite's scale. */
  private breathe(s: Side) {
    this.tweens.killTweensOf(s.sprite);
    s.sprite.setScale(s.scale);
    this.tweens.add({ targets: s.sprite, scaleY: s.scale * 1.02, duration: 900 + Math.random() * 300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private refresh(s: Side, animate = true) {
    const f = s.f;
    s.info.setText(`${f.name}\n${CLASSES[f.cls].name}${isBossForm(f.cls) ? " form" : ""}`);
    s.hp.set(f.hp, f.maxHp, animate);
    s.mp.set(f.mp, f.maxMp, animate);
    const tags = [
      `HP ${f.hp}/${f.maxHp}  MP ${f.mp}/${f.maxMp}`,
      [f.block && `BLOCK ${f.block}`, f.burn && `${f.burn.kind.toUpperCase()} ${f.burn.perTurn}x${f.burn.turns}`, f.empowered && "EMPOWERED", f.weakened && "WEAKENED"].filter(Boolean).join("  "),
    ];
    s.status.setText(tags.join("\n"));
  }

  private say(s: string) {
    this.message.setText(s);
  }

  // ---- Jev's mind ---------------------------------------------------------

  private renderJev(decision: Decision<string> | null, title: string, labels: (k: string) => string = (k) => k) {
    this.jevPanel.forEach((o) => o.destroy());
    const x = 10;
    const y = 70;
    const w = 300;
    const objs: Phaser.GameObjects.GameObject[] = [drawWindow(this, x, y, w, 220)];
    objs.push(text(this, x + 18, y + 16, "JEV'S MIND", 12, "#ffd84a"));
    objs.push(text(this, x + 18, y + 38, title, 8, "#c0c8f0", { wordWrap: { width: w - 36 } }));

    if (decision?.source === "fallback") {
      objs.push(text(this, x + 18, y + 70, `Picked: ${labels(decision.choice)}`, 10, "#ffffa0"));
      objs.push(text(this, x + 18, y + 100, `Jev is unavailable, so a\nsimple rule-based AI chose\nthis.\n\n${(decision.error ?? "").slice(0, 34)}`, 8, "#ff9090", { wordWrap: { width: w - 36 } }));
    } else if (decision) {
      const rows = Object.entries(decision.probabilities as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const g = this.add.graphics();
      objs.push(g);
      rows.forEach(([k, p], i) => {
        const ry = y + 66 + i * 24;
        const chosen = k === decision.choice;
        objs.push(text(this, x + 18, ry, labels(k), 9, chosen ? "#ffffa0" : "#ffffff"));
        g.fillStyle(0x000000, 0.6).fillRect(x + 150, ry + 1, 100, 9);
        g.fillStyle(chosen ? 0xffd84a : 0x6a80d0, 1).fillRect(x + 150, ry + 1, Math.max(1, Math.round(100 * p)), 9);
        objs.push(text(this, x + w - 16, ry, `${Math.round(p * 100)}%`, 8, "#d0d8ff").setOrigin(1, 0));
      });
      const footer = `confidence ${decision.confidence?.toFixed(2)}  ${decision.latencyMs}ms\n${decision.model ?? ""}`;
      objs.push(text(this, x + 18, y + 190, footer, 7, "#90a0d0"));
    } else {
      const dots = text(this, x + 18, y + 80, "...", 14, "#ffffff");
      this.tweens.add({ targets: dots, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });
      objs.push(dots);
    }
    this.jevPanel = objs;
  }

  // ---- Flow ---------------------------------------------------------------

  private wait(ms: number) {
    return new Promise<void>((r) => this.time.delayedCall(ms, r));
  }

  private async intro() {
    if (run.room === BOSS_ROOM) return this.bossIntro();
    const p = run.player;
    this.say(`${ROOMS[run.room]!.name}. Jev is choosing a champion to face ${p.name}...`);
    const [d] = await Promise.all([chooseEnemyClass(run.room, p, favoriteMoves()), this.wait(700)]);
    const enemy = makeFighter(d.choice, ENEMY_NAMES[d.choice][run.room]!, enemyScaling(run.room));
    this.foe = this.makeSide(enemy, 450, 10, "foe", 1);
    this.foe.sprite.setAlpha(0);
    this.tweens.add({ targets: this.foe.sprite, alpha: 1, duration: 500 });
    this.cameras.main.flash(200, 255, 255, 255);
    this.renderJev(d, `Champion vs your ${CLASSES[p.cls].name} (drawn from Jev's odds)`, (k) => CLASSES[k as keyof typeof CLASSES].name);
    sfx.appear();
    this.say(`${enemy.name} the ${CLASSES[enemy.cls].name} blocks the way!`);
    await this.wait(1200);
    void this.playerTurn();
  }

  private async bossIntro() {
    const p = run.player;
    this.say("The throne is empty. Something in the dark is deciding what to become...");
    const [d] = await Promise.all([chooseBossForm(p, favoriteMoves()), this.wait(1400)]);
    const boss = makeBoss(d.choice, run.room);
    this.foe = this.makeSide(boss, 450, 10, "foe", 1);
    this.tweens.killTweensOf(this.foe.sprite);
    this.foe.sprite.setAlpha(0).setScale(this.foe.scale * 0.3);
    sfx.bossAppear();
    this.cameras.main.shake(900, 0.006);
    await this.tween({ targets: this.foe.sprite, alpha: 1, scaleX: this.foe.scale, scaleY: this.foe.scale, duration: 900, ease: "Back.easeOut" });
    this.breathe(this.foe);
    this.formCry(d.choice);
    this.renderJev(d, `Opening form vs your ${CLASSES[p.cls].name} (drawn from Jev's odds)`, (k) => CLASSES[k as BossForm].name);
    this.say(`${BOSS.name} rises in ${CLASSES[d.choice].name} form! It can change shape at will.`);
    await this.wait(1600);
    void this.playerTurn();
  }

  private formCry(form: BossForm) {
    if (form === "bear") sfx.roar();
    else if (form === "wolf") sfx.howl();
    else sfx.chime();
  }

  private async shiftForm(s: Side, form: BossForm) {
    sfx.shift();
    this.cameras.main.flash(200, 120, 255, 120);
    for (let i = 0; i < 24; i++) {
      const leaf = this.add.image(s.homeX, s.sprite.y - 70, "spark").setTint(i % 2 ? 0x6ac04a : 0xb0ff70).setScale(3);
      const a = (i / 24) * Math.PI * 2;
      this.tweens.add({ targets: leaf, x: leaf.x + Math.cos(a) * 110, y: leaf.y + Math.sin(a) * 80, angle: 180, alpha: 0, duration: 700, onComplete: () => leaf.destroy() });
    }
    this.tweens.killTweensOf(s.sprite);
    await this.tween({ targets: s.sprite, scaleX: 0, duration: 220, ease: "Quad.easeIn" });
    s.sprite.setTexture(spriteKey(form, "foe"));
    await this.tween({ targets: s.sprite, scaleX: s.scale, duration: 260, ease: "Back.easeOut" });
    this.breathe(s);
    this.formCry(form);
  }

  private async upkeep(s: Side): Promise<boolean> {
    const burned = startTurn(s.f);
    this.refresh(s);
    if (burned > 0) {
      const kind = s.f.burn?.kind ?? "burn";
      this.say(`${s.f.name} ${kind === "bleed" ? "bleeds" : "burns"} for ${burned} damage!`);
      kind === "bleed" ? sfx.bleed() : sfx.burn();
      this.float(s, `${burned}`, "#ff9a40");
      this.hurt(s);
      await this.wait(700);
    }
    return s.f.hp > 0;
  }

  private async playerTurn() {
    this.turn++;
    if (!(await this.upkeep(this.hero))) return this.defeat();
    this.say(`Turn ${this.turn}. What will ${this.hero.f.name} do?`);
    this.menu?.destroy();
    const items = CLASSES[this.hero.f.cls].moves.map((m) => ({
      label: MOVES[m].name,
      right: MOVES[m].mp ? `${MOVES[m].mp}` : "-",
      enabled: canAfford(this.hero.f, m),
      value: m,
    }));
    this.menu = new Menu<MoveId>(
      this,
      380,
      380,
      220,
      items,
      async (m) => {
        this.playerRecent.push(m);
        run.moveCounts[m] = (run.moveCounts[m] ?? 0) + 1;
        await this.act(this.hero, this.foe, m);
        if (this.foe.f.hp <= 0) return this.victory();
        void this.enemyTurn();
      },
      (m) => this.say(`${MOVES[m].name}${MOVES[m].mp ? ` (${MOVES[m].mp} MP)` : ""}: ${MOVES[m].text}`),
    );
    this.menu.setActive(true);
  }

  private async enemyTurn() {
    if (!(await this.upkeep(this.foe))) return this.victory();
    const e = this.foe.f;
    // A shift is a free action, so the boss may decide twice in one turn.
    for (let decision = 0; decision < 2; decision++) {
      this.say(decision ? `${e.name} acts again in ${CLASSES[e.cls].name} form...` : `${e.name} is thinking...`);
      this.renderJev(null, `Choosing ${e.name}'s move, turn ${this.turn}`);
      const [d] = await Promise.all([chooseEnemyMove(e, this.hero.f, this.turn, this.playerRecent.slice(-3)), this.wait(600)]);
      this.renderJev(d, `${e.name}'s move, turn ${this.turn}${isBossForm(e.cls) ? ` (${CLASSES[e.cls].name} form)` : ""}`, (k) => MOVES[k as MoveId].name);
      await this.act(this.foe, this.hero, d.choice);
      if (this.hero.f.hp <= 0) return this.defeat();
      if (!MOVES[d.choice].shift) break;
    }
    void this.playerTurn();
  }

  // ---- Actions & effects --------------------------------------------------

  private async act(user: Side, target: Side, id: MoveId) {
    const move = MOVES[id];
    if (move.shift) {
      this.say(`${user.f.name} shifts into ${CLASSES[move.shift].name} form!`);
      await this.shiftForm(user, move.shift);
    } else {
      this.say(`${user.f.name} uses ${move.name}!`);
      await this.animate(user, target, id);
    }
    const events = applyMove(user.f, target.f, id);
    let hits = 0;
    for (const ev of events) this.showEvent(user, target, ev, ev.kind === "damage" ? hits++ : 0);
    this.refresh(user);
    this.refresh(target);
    await this.wait(750);
  }

  private showEvent(user: Side, target: Side, ev: BattleEvent, hitIndex = 0) {
    switch (ev.kind) {
      case "damage": {
        // Second and later hits of a multi-hit move land a beat later.
        const show = () => {
          this.float(target, ev.amount > 0 ? `${ev.amount}` : "0", "#ffffff", hitIndex * -26);
          if (ev.blocked) this.float(target, `${ev.blocked} blocked`, "#80c0ff", 28);
          if (ev.amount > 0) (this.hurt(target), sfx.hit(ev.amount >= 18));
          else sfx.blocked();
        };
        hitIndex ? this.time.delayedCall(hitIndex * 220, show) : show();
        break;
      }
      case "block":
        this.float(user, `+${ev.amount} BLOCK`, "#80c0ff");
        this.shimmer(user, 0x60a0ff);
        sfx.block();
        break;
      case "heal":
        this.float(user, `+${ev.amount}`, "#60ff90");
        this.shimmer(user, 0x60ff90);
        sfx.heal();
        break;
      case "burn":
        this.float(target, ev.dot.toUpperCase(), ev.dot === "bleed" ? "#ff5060" : "#ff9a40", 28);
        this.time.delayedCall(150, () => (ev.dot === "bleed" ? sfx.bleed() : sfx.burn()));
        break;
      case "empower":
        this.float(user, "EMPOWERED", "#ffd84a");
        this.shimmer(user, 0xffd84a);
        sfx.empower();
        break;
      case "weaken":
        this.float(target, "WEAKENED", "#c080ff", 28);
        this.time.delayedCall(120, sfx.weaken);
        break;
      case "cleanse":
        this.float(user, "CLEANSED", "#c0ffff", 28);
        this.shimmer(user, 0xc0ffff);
        sfx.cleanse();
        break;
      case "shift":
        this.float(user, `${CLASSES[ev.form].name.toUpperCase()} FORM`, "#b0ff70", -30);
        break;
    }
  }

  private async animate(user: Side, target: Side, id: MoveId) {
    const s = user.sprite;
    const move = MOVES[id];
    if (id === "roar") sfx.roar();
    if (!move.damage) return this.wait(200);
    if (id === "fireball" || id === "moonfire" || id === "thunder") {
      // Spell: raise staff, then a projectile or bolt.
      await this.tween({ targets: s, y: s.y - 14, duration: 150, yoyo: true });
      if (id !== "thunder") {
        const [outer, inner] = id === "fireball" ? [0xff8020, 0xffff80] : [0x9080ff, 0xf0f0ff];
        sfx.fire();
        const ball = this.add.circle(s.x + user.dir * 50, s.y - 80, 14, outer);
        const core = this.add.circle(ball.x, ball.y, 7, inner);
        await this.tween({ targets: [ball, core], x: target.sprite.x, y: target.sprite.y - 70, duration: 380, ease: "Quad.easeIn" });
        this.burst(target.sprite.x, target.sprite.y - 70, outer);
        ball.destroy();
        core.destroy();
      } else {
        const g = this.add.graphics().lineStyle(5, 0xffffa0, 1);
        let px = target.sprite.x;
        let py = 0;
        g.beginPath().moveTo(px, py);
        while (py < target.sprite.y - 60) {
          px += Phaser.Math.Between(-20, 20);
          py += 30;
          g.lineTo(px, py);
        }
        g.strokePath();
        sfx.thunder();
        this.cameras.main.flash(120, 255, 255, 200);
        await this.wait(160);
        g.destroy();
      }
      return;
    }
    // Melee: lunge at the target and back.
    const home = user.homeX;
    const reach = target.homeX - user.dir * (user.scale === 7 ? 150 : 110);
    await this.tween({ targets: s, x: reach, duration: 180, ease: "Quad.easeIn" });
    sfx.slash();
    this.slashFx(target);
    this.tween({ targets: s, x: home, duration: 260, ease: "Quad.easeOut" });
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((resolve) => this.tweens.add({ ...cfg, onComplete: () => resolve() }));
  }

  private hurt(s: Side) {
    s.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(90, () => s.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
    const x = s.homeX;
    this.tweens.add({ targets: s.sprite, x: x + 8, duration: 40, yoyo: true, repeat: 3, onComplete: () => (s.sprite.x = x) });
    this.cameras.main.shake(120, 0.004);
  }

  private slashFx(target: Side) {
    const g = this.add.graphics().lineStyle(4, 0xffffff, 1);
    const cx = target.sprite.x;
    const cy = target.sprite.y - 70;
    g.lineBetween(cx - 40, cy - 40, cx + 40, cy + 40);
    this.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
  }

  private burst(x: number, y: number, color: number) {
    for (let i = 0; i < 14; i++) {
      const p = this.add.image(x, y, "spark").setTint(color).setScale(2);
      const a = (i / 14) * Math.PI * 2;
      this.tweens.add({ targets: p, x: x + Math.cos(a) * 60, y: y + Math.sin(a) * 60, alpha: 0, duration: 450, onComplete: () => p.destroy() });
    }
  }

  private shimmer(s: Side, color: number) {
    for (let i = 0; i < 10; i++) {
      const p = this.add.image(s.homeX + Phaser.Math.Between(-50, 50), s.sprite.y - Phaser.Math.Between(0, 40), "spark").setTint(color).setScale(2);
      this.tweens.add({ targets: p, y: p.y - 80, alpha: 0, delay: i * 40, duration: 700, onComplete: () => p.destroy() });
    }
  }

  private float(s: Side, label: string, color: string, offset = 0) {
    const t = text(this, s.homeX, s.sprite.y - 150 + offset, label, 16, color).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: t, y: t.y - 36, alpha: { from: 1, to: 0 }, delay: 300, duration: 900, onComplete: () => t.destroy() });
  }

  // ---- Endings ------------------------------------------------------------

  private async victory() {
    this.menu?.destroy();
    const name = this.foe.f.name;
    this.say(`${name} is defeated!`);
    sfx.victory();
    this.burst(this.foe.sprite.x, this.foe.sprite.y - 60, 0xffffff);
    if (isBossForm(this.foe.f.cls)) {
      this.cameras.main.shake(800, 0.01);
      this.cameras.main.flash(600, 255, 255, 255);
    }
    await this.tween({ targets: this.foe.sprite, alpha: 0, scaleX: 0, duration: 600 });
    run.defeated[run.room] = name;
    run.room++;
    await this.wait(900);
    if (run.room >= ROOMS.length) return this.scene.start("end", { won: true });
    rest();
    this.scene.start("map");
  }

  private async defeat() {
    this.menu?.destroy();
    this.say(`${this.hero.f.name} has fallen...`);
    await this.tween({ targets: this.hero.sprite, angle: 90, alpha: 0.4, duration: 600 });
    await this.wait(1200);
    this.scene.start("end", { won: false, killer: this.foe?.f.name });
  }
}
