/**
 * SANDERVERSE UNITE — motor Vanilla HTML5 Canvas
 * Sem Phaser, React, jQuery ou arquivos de áudio externos.
 */
(function () {
  "use strict";

  const WORLD_WIDTH = 2800;
  const WORLD_HEIGHT = 1600;
  const JOY_RADIUS = 45;
  const MATCH_SECONDS = 600;

  const SANDER_STATES = {
    IDLE: [0, 3, 15],
    WALK: [1, 2, 4, 7],
    ATTACK: [6],
    CHANNEL: [5, 12],
    DASH: [8, 9, 11],
    FRENZY: [10]
  };

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const minimapCanvas = document.getElementById("minimapCanvas");
  const minimapCtx = minimapCanvas.getContext("2d");

  const el = {
    overlay: document.getElementById("start-overlay"),
    endOverlay: document.getElementById("end-overlay"),
    endTitle: document.getElementById("end-title"),
    endScore: document.getElementById("end-score"),
    btnStart: document.getElementById("btn-start"),
    btnRestart: document.getElementById("btn-restart"),
    scorePlayer: document.getElementById("score-player"),
    scoreEnemy: document.getElementById("score-enemy"),
    timer: document.getElementById("match-timer"),
    auraMul: document.getElementById("aura-multiplier"),
    announcement: document.getElementById("announcement"),
    countdown: document.getElementById("countdown-3d"),
    joyBase: document.getElementById("joystick-base"),
    joyStick: document.getElementById("joystick-stick"),
    btnAttack: document.getElementById("btn-attack"),
    btnFlash: document.getElementById("btn-action-flash"),
    btnQ: document.getElementById("btn-skill-q"),
    btnW: document.getElementById("btn-skill-w"),
    btnE: document.getElementById("btn-skill-e")
  };

  const walkableLanes = [
    { x1: 180, y1: WORLD_HEIGHT / 2, x2: WORLD_WIDTH - 180, y2: WORLD_HEIGHT / 2 },
    { x1: 280, y1: 260, x2: WORLD_WIDTH - 280, y2: 260 },
    { x1: 280, y1: WORLD_HEIGHT - 260, x2: WORLD_WIDTH - 280, y2: WORLD_HEIGHT - 260 },
    { x1: 820, y1: 260, x2: 820, y2: WORLD_HEIGHT - 260 },
    { x1: WORLD_WIDTH - 820, y1: 260, x2: WORLD_WIDTH - 820, y2: WORLD_HEIGHT - 260 }
  ];

  const goals = {
    player: { x: 220, y: WORLD_HEIGHT / 2, r: 110 },
    enemy: { x: WORLD_WIDTH - 260, y: 360, r: 120 }
  };

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.lastBeat = -1;
    }
    init() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    playTone(freq, type, duration, vol) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol || 0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + duration);
    }
    attack() { this.playTone(420, "triangle", 0.12, 0.18); }
    hit() { this.playTone(180, "sawtooth", 0.08, 0.12); }
    collect() { this.playTone(880, "sine", 0.14, 0.16); this.playTone(1320, "sine", 0.1, 0.08); }
    skill(freq) { this.playTone(freq, "square", 0.16, 0.14); }
    deposit() { this.playTone(523, "sine", 0.2, 0.18); this.playTone(784, "sine", 0.25, 0.12); }
    dash() { this.playTone(240, "sawtooth", 0.1, 0.12); }
    heartbeat() {
      this.playTone(80, "sine", 0.1, 0.28);
      const self = this;
      setTimeout(function () { self.playTone(58, "sine", 0.16, 0.22); }, 140);
    }
  }

  class AssetLoader {
    constructor() {
      this.images = {};
      this.manifest = [
        ["logo_banner", "assets/logo_banner.png"],
        ["map_arena", "assets/map_arena.png"],
        ["sander", "assets/sander.png"],
        ["sheet_sander", "assets/sheet_sander.png"],
        ["polo", "assets/calopsita_polo.png"],
        ["sheet_polo", "assets/sheet_sanderai.png"],
        ["lupe", "assets/calopsita_lupe.png"],
        ["sheet_lupe", "assets/sheet_lupe.png"],
        ["topete", "assets/calopsita_topete.png"],
        ["sheet_topete", "assets/sheet_topete.png"],
        ["aura", "assets/aura_energy.png"],
        ["mini_logo", "assets/mini_logo.png"]
      ];
    }
    loadAll() {
      const self = this;
      this.manifest.forEach(function (item) {
        const img = new Image();
        img.onload = function () { self.images[item[0]] = img; };
        img.onerror = function () { self.images[item[0]] = null; };
        img.src = item[1];
      });
    }
    get(id) {
      return this.images[id] || null;
    }
  }

  function drawSheetFrame(context, img, frameNum, cols, rows, dx, dy, dw, dh, flipX) {
    if (!img) return false;
    const fw = img.width / cols;
    const fh = img.height / rows;
    const col = frameNum % cols;
    const row = Math.floor(frameNum / cols);
    context.save();
    context.translate(dx + dw / 2, dy + dh / 2);
    if (flipX) context.scale(-1, 1);
    context.drawImage(img, col * fw, row * fh, fw, fh, -dw / 2, -dh / 2, dw, dh);
    context.restore();
    return true;
  }

  class Projectile {
    constructor(x, y, vx, vy, kind, dmg, life) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.kind = kind; this.dmg = dmg; this.life = life; this.dead = false; this.r = kind === "tornado" ? 22 : 10;
    }
    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
      const color = this.kind === "tornado" ? "#7af6ff" : this.kind === "diamond" ? "#ffe566" : "#00f2fe";
      fx.trail(this.x, this.y, this.vx, this.vy, color);
    }
    render(context, camX, camY) {
      const sx = this.x - camX;
      const sy = this.y - camY;
      context.save();
      if (this.kind === "bolt") {
        context.strokeStyle = "#00f2fe";
        context.shadowColor = "#00f2fe";
        context.shadowBlur = 12;
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(sx, sy);
        context.lineTo(sx - this.vx * 0.04, sy - this.vy * 0.04);
        context.stroke();
      } else if (this.kind === "tornado") {
        context.strokeStyle = "rgba(0, 242, 254, 0.85)";
        context.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          context.beginPath();
          context.ellipse(sx, sy, 10 + i * 7, 16 + i * 4, performance.now() / 180 + i, 0, Math.PI * 2);
          context.stroke();
        }
      } else if (this.kind === "diamond") {
        context.fillStyle = "rgba(0, 242, 254, 0.35)";
        context.strokeStyle = "#00f2fe";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(sx, sy - 16);
        context.lineTo(sx + 12, sy);
        context.lineTo(sx, sy + 16);
        context.lineTo(sx - 12, sy);
        context.closePath();
        context.fill();
        context.stroke();
      }
      context.restore();
    }
  }

  class Particle {
    constructor() { this.alive = false; }
    spawn(x, y, vx, vy, life, size, color, shape, gravity, drag, decay) {
      this.alive = true;
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.life = life; this.maxLife = life;
      this.size = size; this.color = color;
      this.shape = shape || "circle";
      this.gravity = gravity || 0;
      this.drag = drag == null ? 0.985 : drag;
      this.decay = decay == null ? 1 : decay;
      this.rot = Math.random() * Math.PI * 2;
      this.spin = (Math.random() - 0.5) * 8;
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) { this.alive = false; return; }
      this.vx *= this.drag;
      this.vy = this.vy * this.drag + this.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rot += this.spin * dt;
      this.size *= this.decay;
    }
    render(context, camX, camY) {
      const t = this.life / this.maxLife;
      const sx = this.x - camX;
      const sy = this.y - camY;
      const a = Math.max(0, t);
      const r = Math.max(0.4, this.size * (0.45 + t * 0.55));
      context.globalAlpha = a;
      context.fillStyle = this.color;
      context.strokeStyle = this.color;
      if (this.shape === "spark") {
        context.lineWidth = Math.max(1, r * 0.35);
        context.beginPath();
        context.moveTo(sx - Math.cos(this.rot) * r * 2, sy - Math.sin(this.rot) * r * 2);
        context.lineTo(sx + Math.cos(this.rot) * r * 2, sy + Math.sin(this.rot) * r * 2);
        context.stroke();
      } else if (this.shape === "square") {
        context.save();
        context.translate(sx, sy);
        context.rotate(this.rot);
        context.fillRect(-r, -r, r * 2, r * 2);
        context.restore();
      } else if (this.shape === "star") {
        context.beginPath();
        context.moveTo(sx, sy - r);
        context.lineTo(sx + r * 0.3, sy - r * 0.3);
        context.lineTo(sx + r, sy);
        context.lineTo(sx + r * 0.3, sy + r * 0.3);
        context.lineTo(sx, sy + r);
        context.lineTo(sx - r * 0.3, sy + r * 0.3);
        context.lineTo(sx - r, sy);
        context.lineTo(sx - r * 0.3, sy - r * 0.3);
        context.closePath();
        context.fill();
      } else if (this.shape === "ring") {
        context.lineWidth = 2;
        context.beginPath();
        context.arc(sx, sy, r, 0, Math.PI * 2);
        context.stroke();
      } else {
        context.beginPath();
        context.arc(sx, sy, r, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    }
  }

  class ParticleSystem {
    constructor(limit) {
      this.limit = limit || 420;
      this.pool = [];
      for (let i = 0; i < this.limit; i++) this.pool.push(new Particle());
      this.emitAcc = 0;
    }
    clear() {
      for (let i = 0; i < this.pool.length; i++) this.pool[i].alive = false;
    }
    spawn(x, y, vx, vy, life, size, color, shape, gravity, drag, decay) {
      for (let i = 0; i < this.pool.length; i++) {
        if (!this.pool[i].alive) {
          this.pool[i].spawn(x, y, vx, vy, life, size, color, shape, gravity, drag, decay);
          return this.pool[i];
        }
      }
      const p = this.pool[0];
      p.spawn(x, y, vx, vy, life, size, color, shape, gravity, drag, decay);
      return p;
    }
    burst(x, y, opts) {
      const n = opts.count || 12;
      const speed = opts.speed || 180;
      const life = opts.life || 0.45;
      const size = opts.size || 3.5;
      const colors = opts.colors || ["#00f2fe"];
      const shape = opts.shape || "circle";
      const spread = opts.spread == null ? Math.PI * 2 : opts.spread;
      const angle = opts.angle || 0;
      const gravity = opts.gravity || 0;
      const drag = opts.drag;
      const decay = opts.decay;
      for (let i = 0; i < n; i++) {
        const a = angle + (Math.random() - 0.5) * spread;
        const s = speed * (0.35 + Math.random() * 0.75);
        this.spawn(
          x + (Math.random() - 0.5) * (opts.jitter || 0),
          y + (Math.random() - 0.5) * (opts.jitter || 0),
          Math.cos(a) * s,
          Math.sin(a) * s,
          life * (0.6 + Math.random() * 0.6),
          size * (0.6 + Math.random() * 0.8),
          colors[i % colors.length],
          shape,
          gravity,
          drag,
          decay
        );
      }
    }
    ring(x, y, color, radius) {
      const n = 18;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n;
        this.spawn(x, y, Math.cos(a) * 220, Math.sin(a) * 220, 0.4, 4, color, "spark", 0, 0.96, 0.98);
      }
      this.spawn(x, y, 0, 0, 0.35, radius || 28, color, "ring", 0, 1, 1.08);
    }
    trail(x, y, vx, vy, color) {
      this.spawn(
        x + (Math.random() - 0.5) * 8,
        y + (Math.random() - 0.5) * 8,
        -vx * 0.15 + (Math.random() - 0.5) * 30,
        -vy * 0.15 + (Math.random() - 0.5) * 30,
        0.28,
        3.2,
        color,
        "circle",
        0,
        0.9,
        0.94
      );
    }
    update(dt) {
      for (let i = 0; i < this.pool.length; i++) {
        if (this.pool[i].alive) this.pool[i].update(dt);
      }
    }
    render(context, camX, camY) {
      context.save();
      context.globalCompositeOperation = "lighter";
      for (let i = 0; i < this.pool.length; i++) {
        if (this.pool[i].alive) this.pool[i].render(context, camX, camY);
      }
      context.restore();
    }
  }

  const fx = new ParticleSystem(460);

  class EnergyItem {
    constructor(x, y, kind) {
      this.x = x; this.y = y; this.kind = kind || "aura";
      this.radius = 18; this.floatTimer = Math.random() * 8; this.blink = 0;
    }
    update(dt) {
      this.floatTimer += dt * 3;
      this.blink += dt;
    }
    render(context, camX, camY, assets) {
      const ox = Math.sin(this.floatTimer) * 6;
      const sx = this.x - camX;
      const sy = this.y - camY + ox;
      const img = assets.get(this.kind === "aura" ? "aura" : "mini_logo");
      if (img) {
        context.drawImage(img, sx - 18, sy - 18, 36, 36);
      } else {
        context.beginPath();
        context.arc(sx, sy, this.radius, 0, Math.PI * 2);
        context.fillStyle = this.kind === "aura" ? "#ffd700" : "#00f2fe";
        context.fill();
      }
    }
  }

  class SanderPlayer {
    constructor(x, y) {
      this.x = x; this.y = y; this.radius = 28;
      this.baseSpeed = 240; this.speed = 240;
      this.hp = 1200; this.maxHp = 1200;
      this.auraCount = 0; this.vx = 0; this.vy = 0;
      this.state = "IDLE"; this.facingLeft = false;
      this.frameIndex = 0; this.timer = 0; this.frameInterval = 0.12;
      this.isAttacking = false; this.attackTimer = 0;
      this.isChanneling = false; this.channelTimer = 0;
      this.isDashing = false; this.dashTimer = 0;
      this.invuln = 0;
    }
    buff() { return 1 + this.auraCount * 0.03; }
    update(dt) {
      this.speed = this.baseSpeed * this.buff();
      if (this.invuln > 0) this.invuln -= dt;
      if (this.attackTimer > 0) {
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) this.isAttacking = false;
      }
      if (this.dashTimer > 0) {
        this.dashTimer -= dt;
        if (this.dashTimer <= 0) this.isDashing = false;
      }
      if (this.channelTimer > 0) {
        this.channelTimer -= dt;
        if (this.channelTimer <= 0) this.isChanneling = false;
      }
      if (this.vx < -0.08) this.facingLeft = true;
      if (this.vx > 0.08) this.facingLeft = false;

      if (this.isDashing) this.state = "DASH";
      else if (this.isAttacking) this.state = "ATTACK";
      else if (this.isChanneling) this.state = "CHANNEL";
      else if (state.climax && Math.hypot(this.vx, this.vy) < 0.1) this.state = "FRENZY";
      else if (Math.hypot(this.vx, this.vy) > 0.1) this.state = "WALK";
      else this.state = "IDLE";

      if (!this.isChanneling) {
        const dashMul = this.isDashing ? 2.4 : 1;
        this.x += this.vx * this.speed * dashMul * dt;
        this.y += this.vy * this.speed * dashMul * dt;
        this.x = Math.max(this.radius, Math.min(WORLD_WIDTH - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(WORLD_HEIGHT - this.radius, this.y));
      }

      const frames = SANDER_STATES[this.state] || [0];
      this.timer += dt;
      if (this.timer >= this.frameInterval) {
        this.timer = 0;
        this.frameIndex = (this.frameIndex + 1) % frames.length;
      }
    }
    render(context, camX, camY, assets) {
      const sx = this.x - camX;
      const sy = this.y - camY;
      const frames = SANDER_STATES[this.state] || [0];
      const frameNum = frames[this.frameIndex % frames.length];
      const img = assets.get("sheet_sander");
      const drawn = drawSheetFrame(context, img, frameNum, 4, 4, sx - 40, sy - 58, 80, 112, this.facingLeft);
      if (!drawn) {
        context.beginPath();
        context.arc(sx, sy, this.radius, 0, Math.PI * 2);
        context.fillStyle = "#00f2fe";
        context.fill();
      }
      context.fillStyle = "rgba(0,0,0,0.55)";
      context.fillRect(sx - 28, sy - 72, 56, 6);
      context.fillStyle = this.hp > 400 ? "#2ecc71" : "#ff0055";
      context.fillRect(sx - 28, sy - 72, Math.max(0, this.hp / this.maxHp) * 56, 6);
      if (this.auraCount > 0) {
        context.fillStyle = "#ffd700";
        context.font = "bold 12px sans-serif";
        context.textAlign = "center";
        context.fillText("⚡" + this.auraCount, sx, sy + 46);
      }
    }
  }

  class EnemyBird {
    constructor(x, y, name, sheetKey, portraitKey, color) {
      this.x = x; this.y = y; this.name = name;
      this.sheetKey = sheetKey; this.portraitKey = portraitKey; this.color = color;
      this.radius = 28; this.hp = 700; this.maxHp = 700;
      this.speed = 118; this.vx = 0; this.vy = 0;
      this.timer = 0; this.frame = 0; this.atkCd = 1 + Math.random();
      this.alive = true; this.respawn = 0; this.homeX = x; this.homeY = y;
      this.facingLeft = false;
    }
    update(dt, player) {
      if (!this.alive) {
        this.respawn -= dt;
        if (this.respawn <= 0) {
          this.alive = true;
          this.hp = this.maxHp;
          this.x = this.homeX;
          this.y = this.homeY;
        }
        return;
      }
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 520) {
        this.vx = dx / dist;
        this.vy = dy / dist;
        if (dist < 90) { this.vx = 0; this.vy = 0; }
      } else {
        const hx = this.homeX - this.x;
        const hy = this.homeY - this.y;
        const hd = Math.hypot(hx, hy) || 1;
        this.vx = hd > 20 ? hx / hd * 0.35 : 0;
        this.vy = hd > 20 ? hy / hd * 0.35 : 0;
      }
      if (this.vx < -0.05) this.facingLeft = true;
      if (this.vx > 0.05) this.facingLeft = false;
      this.x += this.vx * this.speed * dt;
      this.y += this.vy * this.speed * dt;
      this.x = Math.max(40, Math.min(WORLD_WIDTH - 40, this.x));
      this.y = Math.max(40, Math.min(WORLD_HEIGHT - 40, this.y));
      this.timer += dt;
      if (this.timer >= 0.14) { this.timer = 0; this.frame = (this.frame + 1) % 16; }
      this.atkCd -= dt;
      if (this.atkCd <= 0 && dist < 100 && player.invuln <= 0) {
        player.hp -= 28;
        player.invuln = 0.35;
        sound.hit();
        this.atkCd = 1.15;
        if (player.hp < 0) player.hp = 0;
        fx.burst(player.x, player.y, {
          count: 10, speed: 220, life: 0.35, size: 3.2,
          colors: ["#ff0055", "#ffd700", this.color], shape: "spark"
        });
      }
    }
    takeHit(dmg) {
      if (!this.alive) return false;
      this.hp -= dmg;
      if (this.hp <= 0) {
        this.alive = false;
        this.respawn = 6;
        return true;
      }
      return false;
    }
    render(context, camX, camY, assets) {
      if (!this.alive) return;
      const sx = this.x - camX;
      const sy = this.y - camY;
      const sheet = assets.get(this.sheetKey);
      const portrait = assets.get(this.portraitKey);
      let drawn = drawSheetFrame(context, sheet, this.frame, 4, 4, sx - 36, sy - 52, 72, 96, this.facingLeft);
      if (!drawn && portrait) {
        context.drawImage(portrait, sx - 28, sy - 50, 56, 84);
        drawn = true;
      }
      if (!drawn) {
        context.beginPath();
        context.arc(sx, sy, this.radius, 0, Math.PI * 2);
        context.fillStyle = this.color;
        context.fill();
      }
      context.fillStyle = "rgba(0,0,0,0.5)";
      context.fillRect(sx - 24, sy - 62, 48, 5);
      context.fillStyle = "#ff3366";
      context.fillRect(sx - 24, sy - 62, Math.max(0, this.hp / this.maxHp) * 48, 5);
      context.fillStyle = "#fff";
      context.font = "10px sans-serif";
      context.textAlign = "center";
      context.fillText(this.name, sx, sy - 68);
    }
  }

  const sound = new SoundEngine();
  const assets = new AssetLoader();
  assets.loadAll();

  const state = {
    running: false,
    climax: false,
    climaxTriggered: false,
    remainingTime: MATCH_SECONDS,
    playerScore: 0,
    enemyScore: 0,
    lastFrameTime: performance.now(),
    lastHudSecond: 600,
    enemyScoreAcc: 0
  };

  let player = new SanderPlayer(380, WORLD_HEIGHT / 2);
  let enemies = [];
  let droppedEnergies = [];
  let projectiles = [];
  let camera = { x: 0, y: 0 };
  let pointerId = null;
  let joyCenter = { x: 0, y: 0 };
  const keys = Object.create(null);
  const cds = { q: 0, w: 0, e: 0, flash: 0, atk: 0 };
  const cdMax = { q: 6, w: 8, e: 10, flash: 3.6, atk: 0.32 };

  function resetMatch() {
    state.running = true;
    state.climax = false;
    state.climaxTriggered = false;
    state.remainingTime = MATCH_SECONDS;
    state.playerScore = 0;
    state.enemyScore = 0;
    state.enemyScoreAcc = 0;
    state.lastHudSecond = 600;
    player = new SanderPlayer(380, WORLD_HEIGHT / 2);
    enemies = [
      new EnemyBird(1680, 420, "Polo", "sheet_polo", "polo", "#8fd3ff"),
      new EnemyBird(1980, 820, "Lupe", "sheet_lupe", "lupe", "#f0e6c8"),
      new EnemyBird(1540, 1180, "Topete", "sheet_topete", "topete", "#ff7ad9")
    ];
    droppedEnergies = [];
    projectiles = [];
    fx.clear();
    cds.q = cds.w = cds.e = cds.flash = cds.atk = 0;
    el.announcement.classList.add("hidden");
    el.countdown.classList.add("hidden");
    el.endOverlay.classList.add("hidden");
    el.timer.classList.remove("danger");
    updateHud(true);
  }

  function updateHud(force) {
    const sec = Math.max(0, Math.ceil(state.remainingTime));
    if (force || sec !== state.lastHudSecond) {
      state.lastHudSecond = sec;
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      el.timer.textContent = m + ":" + (s < 10 ? "0" : "") + s;
    }
    el.scorePlayer.textContent = String(state.playerScore);
    el.scoreEnemy.textContent = String(state.enemyScore);
    el.auraMul.textContent = "x" + player.buff().toFixed(2);
  }

  function setCooldownOverlay(btn, remain, max) {
    const overlay = btn.querySelector(".cooldown-overlay");
    if (!overlay) return;
    const p = remain <= 0 ? 0 : Math.min(1, remain / max);
    overlay.style.height = (p * 100) + "%";
  }

  function spawnDrops(x, y) {
    const n = state.climax ? 2 : 1;
    for (let i = 0; i < n; i++) {
      droppedEnergies.push(new EnergyItem(
        x + (Math.random() - 0.5) * 40,
        y + (Math.random() - 0.5) * 40,
        Math.random() > 0.45 ? "aura" : "logo"
      ));
    }
    fx.burst(x, y, {
      count: 22, speed: 260, life: 0.55, size: 4,
      colors: ["#ffd700", "#ff0055", "#e056fd", "#00f2fe"],
      shape: "star", gravity: 40
    });
  }

  function damageEnemiesAt(x, y, radius, dmg) {
    enemies.forEach(function (en) {
      if (!en.alive) return;
      if (Math.hypot(en.x - x, en.y - y) <= radius + en.radius) {
        sound.hit();
        fx.burst(en.x, en.y, {
          count: 8, speed: 200, life: 0.3, size: 2.8,
          colors: ["#ffffff", "#00f2fe", "#ff0055"], shape: "spark"
        });
        if (en.takeHit(dmg)) spawnDrops(en.x, en.y);
      }
    });
  }

  function fireAttack() {
    if (cds.atk > 0 || player.isChanneling) return;
    cds.atk = cdMax.atk;
    player.isAttacking = true;
    player.attackTimer = 0.28;
    sound.attack();
    const dir = player.facingLeft ? -1 : 1;
    projectiles.push(new Projectile(player.x + dir * 30, player.y - 8, dir * 720, 0, "bolt", 210, 0.55));
    fx.burst(player.x + dir * 28, player.y - 8, {
      count: 12, speed: 280, life: 0.28, size: 3,
      colors: ["#00f2fe", "#ffffff", "#4facfe"],
      shape: "spark", angle: dir > 0 ? 0 : Math.PI, spread: 1.1
    });
    damageEnemiesAt(player.x + dir * 70, player.y, 70, 160);
  }

  function castQ() {
    if (cds.q > 0 || player.isChanneling) return;
    cds.q = cdMax.q;
    sound.skill(300);
    const dir = player.facingLeft ? -1 : 1;
    for (let i = -1; i <= 1; i++) {
      projectiles.push(new Projectile(player.x, player.y, dir * 380, i * 140, "tornado", 260, 1.4));
    }
    fx.ring(player.x, player.y, "#00f2fe", 36);
    fx.burst(player.x, player.y, {
      count: 20, speed: 320, life: 0.5, size: 3.5,
      colors: ["#00f2fe", "#7af6ff", "#4facfe"], shape: "spark",
      angle: dir > 0 ? 0 : Math.PI, spread: 1.6
    });
  }

  function castW() {
    if (cds.w > 0 || player.isChanneling) return;
    cds.w = cdMax.w;
    sound.skill(620);
    player.invuln = 0.8;
    for (let a = 0; a < 8; a++) {
      const ang = (Math.PI * 2 * a) / 8;
      projectiles.push(new Projectile(player.x, player.y, Math.cos(ang) * 280, Math.sin(ang) * 280, "diamond", 180, 0.7));
    }
    fx.ring(player.x, player.y, "#ffd700", 48);
    fx.burst(player.x, player.y, {
      count: 24, speed: 300, life: 0.55, size: 4,
      colors: ["#ffd700", "#00f2fe", "#ffffff"], shape: "square"
    });
    damageEnemiesAt(player.x, player.y, 150, 220);
  }

  function castE() {
    if (cds.e > 0 || player.isChanneling) return;
    cds.e = cdMax.e;
    sound.skill(200);
    fx.burst(player.x, player.y, {
      count: 36, speed: 380, life: 0.7, size: 5,
      colors: ["#ffd700", "#ff9a3c", "#fff4b0", "#00f2fe"],
      shape: "star", gravity: -20
    });
    fx.ring(player.x, player.y, "#ffd700", 70);
    damageEnemiesAt(player.x, player.y, 210, 340);
    projectiles.push(new Projectile(player.x, player.y, 0, 0, "diamond", 0, 0.45));
  }

  function doFlashOrDeposit() {
    if (cds.flash > 0) return;
    const inGoal = Math.hypot(player.x - goals.enemy.x, player.y - goals.enemy.y) < goals.enemy.r + 20;
    if (inGoal && player.auraCount > 0) {
      player.isChanneling = true;
      player.channelTimer = 0.7;
      const pts = player.auraCount * (state.climax ? 2 : 1);
      state.playerScore += pts;
      player.auraCount = 0;
      sound.deposit();
      fx.burst(player.x, player.y, {
        count: 40, speed: 260, life: 0.9, size: 4.5,
        colors: ["#ffd700", "#c084fc", "#00f2fe", "#ffffff"],
        shape: "star", gravity: -80
      });
      fx.ring(player.x, player.y, "#c084fc", 80);
      cds.flash = cdMax.flash;
      return;
    }
    cds.flash = cdMax.flash;
    player.isDashing = true;
    player.dashTimer = 0.22;
    const ang = Math.atan2(player.vy, player.vx);
    const hasDir = Math.hypot(player.vx, player.vy) > 0.1;
    const dash = hasDir ? ang : (player.facingLeft ? Math.PI : 0);
    player.x += Math.cos(dash) * 140;
    player.y += Math.sin(dash) * 140;
    player.x = Math.max(player.radius, Math.min(WORLD_WIDTH - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(WORLD_HEIGHT - player.radius, player.y));
    sound.dash();
    fx.burst(player.x, player.y, {
      count: 16, speed: 240, life: 0.35, size: 3.2,
      colors: ["#ffd700", "#00f2fe"], shape: "spark",
      angle: dash + Math.PI, spread: 1.2
    });
  }

  function applyKeyboardMove() {
    if (pointerId !== null) return;
    let x = 0, y = 0;
    if (keys.ArrowLeft || keys.a || keys.A) x -= 1;
    if (keys.ArrowRight || keys.d || keys.D) x += 1;
    if (keys.ArrowUp || keys.w || keys.W) y -= 1;
    if (keys.ArrowDown || keys.s || keys.S) y += 1;
    const len = Math.hypot(x, y);
    if (len > 0) { player.vx = x / len; player.vy = y / len; }
    else { player.vx = 0; player.vy = 0; }
  }

  function handleJoy(clientX, clientY) {
    const dx = clientX - joyCenter.x;
    const dy = clientY - joyCenter.y;
    const dist = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    const cap = Math.min(dist, JOY_RADIUS);
    el.joyStick.style.transform = "translate(" + (Math.cos(ang) * cap) + "px," + (Math.sin(ang) * cap) + "px)";
    if (cap > 6) {
      player.vx = Math.cos(ang);
      player.vy = Math.sin(ang);
    } else {
      player.vx = 0;
      player.vy = 0;
    }
  }

  function resetJoy() {
    pointerId = null;
    player.vx = 0;
    player.vy = 0;
    el.joyStick.style.transform = "translate(0px,0px)";
  }

  function bindPointer(target, fn) {
    target.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      fn(e);
    });
  }

  el.joyBase.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    pointerId = e.pointerId;
    try { el.joyBase.setPointerCapture(e.pointerId); } catch (err) {}
    const rect = el.joyBase.getBoundingClientRect();
    joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    handleJoy(e.clientX, e.clientY);
  });
  el.joyBase.addEventListener("pointermove", function (e) {
    if (pointerId === e.pointerId) handleJoy(e.clientX, e.clientY);
  });
  function joyUp(e) {
    if (pointerId === e.pointerId) resetJoy();
  }
  el.joyBase.addEventListener("pointerup", joyUp);
  el.joyBase.addEventListener("pointercancel", joyUp);

  bindPointer(el.btnAttack, fireAttack);
  bindPointer(el.btnFlash, doFlashOrDeposit);
  bindPointer(el.btnQ, castQ);
  bindPointer(el.btnW, castW);
  bindPointer(el.btnE, castE);

  window.addEventListener("keydown", function (e) {
    keys[e.key] = true;
    if (!state.running) return;
    if (e.key === "q" || e.key === "Q") castQ();
    if (e.key === "e" || e.key === "E") castE();
    if (e.key === " " || e.key === "j" || e.key === "J") { e.preventDefault(); fireAttack(); }
    if (e.key === "f" || e.key === "F" || e.key === "Shift") doFlashOrDeposit();
    if (e.key === "r" || e.key === "R") castW();
  });
  window.addEventListener("keyup", function (e) { keys[e.key] = false; });

  function lockScreen() {
    const root = document.documentElement;
    const req = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
    if (req) req.call(root).catch(function () {});
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock("landscape").catch(function () {});
    }
  }

  function startGame() {
    sound.init();
    lockScreen();
    el.overlay.classList.add("hidden");
    resetMatch();
  }

  el.btnStart.addEventListener("click", startGame);
  el.btnRestart.addEventListener("click", function () {
    sound.init();
    resetMatch();
  });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  ["gesturestart", "gesturechange", "gestureend"].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false });
  });
  document.addEventListener("dblclick", function (e) { e.preventDefault(); }, { passive: false });

  function updateCamera() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tx = player.x - vw / 2;
    const ty = player.y - vh / 2;
    camera.x += (tx - camera.x) * 0.12;
    camera.y += (ty - camera.y) * 0.12;
    camera.x = Math.max(0, Math.min(WORLD_WIDTH - vw, camera.x));
    camera.y = Math.max(0, Math.min(WORLD_HEIGHT - vh, camera.y));
    if (WORLD_WIDTH < vw) camera.x = (WORLD_WIDTH - vw) / 2;
    if (WORLD_HEIGHT < vh) camera.y = (WORLD_HEIGHT - vh) / 2;
  }

  function drawWorld() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    ctx.clearRect(0, 0, vw, vh);
    const map = assets.get("map_arena");
    if (map) {
      ctx.drawImage(map, -camera.x, -camera.y, WORLD_WIDTH, WORLD_HEIGHT);
      ctx.fillStyle = "rgba(5,5,11,0.18)";
      ctx.fillRect(0, 0, vw, vh);
    } else {
      ctx.fillStyle = "#070814";
      ctx.fillRect(0, 0, vw, vh);
      ctx.strokeStyle = "rgba(0, 242, 254, 0.18)";
      ctx.lineWidth = 46;
      ctx.lineCap = "round";
      walkableLanes.forEach(function (l) {
        ctx.beginPath();
        ctx.moveTo(l.x1 - camera.x, l.y1 - camera.y);
        ctx.lineTo(l.x2 - camera.x, l.y2 - camera.y);
        ctx.stroke();
      });
    }

    function portal(goal, colorA, colorB, label) {
      const sx = goal.x - camera.x;
      const sy = goal.y - camera.y;
      const g = ctx.createRadialGradient(sx, sy, 10, sx, sy, goal.r);
      g.addColorStop(0, colorA);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, goal.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colorB;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, sx, sy + goal.r + 16);
    }
    portal(goals.player, "rgba(255,140,0,0.35)", "#ff8c00", "BASE SANDER");
    portal(goals.enemy, "rgba(160,80,255,0.4)", "#c084fc", "GOAL ZONE");
  }

  function renderMinimap() {
    const mw = minimapCanvas.width;
    const mh = minimapCanvas.height;
    const sx = mw / WORLD_WIDTH;
    const sy = mh / WORLD_HEIGHT;
    minimapCtx.clearRect(0, 0, mw, mh);
    minimapCtx.fillStyle = "rgba(6,10,22,0.35)";
    minimapCtx.fillRect(0, 0, mw, mh);
    minimapCtx.lineWidth = 3;
    minimapCtx.strokeStyle = "rgba(255,255,255,0.22)";
    walkableLanes.forEach(function (l) {
      minimapCtx.beginPath();
      minimapCtx.moveTo(l.x1 * sx, l.y1 * sy);
      minimapCtx.lineTo(l.x2 * sx, l.y2 * sy);
      minimapCtx.stroke();
    });
    minimapCtx.strokeStyle = "#ff8c00";
    minimapCtx.beginPath();
    minimapCtx.arc(goals.player.x * sx, goals.player.y * sy, 6, 0, Math.PI * 2);
    minimapCtx.stroke();
    minimapCtx.strokeStyle = "#c084fc";
    minimapCtx.beginPath();
    minimapCtx.arc(goals.enemy.x * sx, goals.enemy.y * sy, 6, 0, Math.PI * 2);
    minimapCtx.stroke();
    const pulse = 0.45 + Math.sin(performance.now() / 180) * 0.45;
    droppedEnergies.forEach(function (orb) {
      minimapCtx.fillStyle = "rgba(224,86,253," + pulse.toFixed(2) + ")";
      minimapCtx.fillRect(orb.x * sx - 1.5, orb.y * sy - 1.5, 3, 3);
    });
    enemies.forEach(function (en) {
      if (!en.alive) return;
      minimapCtx.beginPath();
      minimapCtx.arc(en.x * sx, en.y * sy, 3, 0, Math.PI * 2);
      minimapCtx.fillStyle = "#ff3366";
      minimapCtx.fill();
    });
    minimapCtx.beginPath();
    minimapCtx.arc(player.x * sx, player.y * sy, 4, 0, Math.PI * 2);
    minimapCtx.fillStyle = "#00f2fe";
    minimapCtx.fill();
  }

  function endMatch() {
    state.running = false;
    const win = state.playerScore >= state.enemyScore;
    el.endTitle.textContent = win ? "VITÓRIA SANDER" : "CALOPSITAS VENCEM";
    el.endScore.textContent = "Sander " + state.playerScore + "  ×  " + state.enemyScore + " Calopsitas";
    el.endOverlay.classList.remove("hidden");
    el.announcement.classList.add("hidden");
    el.countdown.classList.add("hidden");
  }

  function gameLoop(now) {
    const dt = Math.min(0.05, (now - state.lastFrameTime) / 1000);
    state.lastFrameTime = now;

    if (state.running) {
      state.remainingTime -= dt;
      applyKeyboardMove();

      if (state.remainingTime <= 120 && !state.climaxTriggered) {
        state.climax = true;
        state.climaxTriggered = true;
        el.announcement.textContent = "FRENESÍ DE ENERGIA";
        el.announcement.classList.remove("hidden");
        sound.skill(150);
        fx.burst(player.x, player.y, {
          count: 50, speed: 420, life: 0.8, size: 5.5,
          colors: ["#ffd700", "#ff0055", "#00f2fe", "#e056fd"],
          shape: "star"
        });
      }

      if (state.remainingTime <= 10 && state.remainingTime > 0) {
        const n = Math.ceil(state.remainingTime);
        el.countdown.textContent = String(n);
        el.countdown.classList.remove("hidden");
        el.timer.classList.add("danger");
        if (n !== sound.lastBeat) {
          sound.lastBeat = n;
          sound.heartbeat();
          fx.ring(player.x, player.y, "#ff0055", 40);
        }
      } else {
        el.countdown.classList.add("hidden");
      }

      ["q", "w", "e", "flash", "atk"].forEach(function (k) {
        if (cds[k] > 0) cds[k] = Math.max(0, cds[k] - dt);
      });
      setCooldownOverlay(el.btnQ, cds.q, cdMax.q);
      setCooldownOverlay(el.btnW, cds.w, cdMax.w);
      setCooldownOverlay(el.btnE, cds.e, cdMax.e);

      player.update(dt);
      enemies.forEach(function (en) { en.update(dt, player); });
      projectiles.forEach(function (p) {
        p.update(dt);
        enemies.forEach(function (en) {
          if (!en.alive || p.dead || p.dmg <= 0) return;
          if (Math.hypot(en.x - p.x, en.y - p.y) < en.radius + p.r) {
            p.dead = true;
            sound.hit();
            fx.burst(en.x, en.y, {
              count: 14, speed: 260, life: 0.35, size: 3.4,
              colors: ["#ffffff", "#00f2fe", "#ffd700"], shape: "spark"
            });
            if (en.takeHit(p.dmg)) spawnDrops(en.x, en.y);
          }
        });
      });
      projectiles = projectiles.filter(function (p) { return !p.dead; });

      droppedEnergies.forEach(function (orb) { orb.update(dt); });
      droppedEnergies = droppedEnergies.filter(function (orb) {
        if (Math.hypot(orb.x - player.x, orb.y - player.y) < player.radius + orb.radius) {
          player.auraCount += 1;
          sound.collect();
          fx.burst(orb.x, orb.y, {
            count: 14, speed: 160, life: 0.45, size: 3.2,
            colors: orb.kind === "aura" ? ["#ffd700", "#ff9a3c"] : ["#00f2fe", "#ffffff"],
            shape: "star", gravity: -60
          });
          return false;
        }
        if (Math.random() < dt * 3) {
          fx.spawn(orb.x, orb.y, (Math.random() - 0.5) * 20, -30 - Math.random() * 20, 0.4, 2,
            orb.kind === "aura" ? "#ffd700" : "#e056fd", "circle", -20, 0.96, 0.96);
        }
        return true;
      });

      if (player.auraCount > 0 || state.climax) {
        fx.emitAcc += dt;
        if (fx.emitAcc > 0.05) {
          fx.emitAcc = 0;
          fx.spawn(
            player.x + (Math.random() - 0.5) * 24,
            player.y + 10,
            (Math.random() - 0.5) * 18,
            -40 - Math.random() * 30,
            0.45,
            state.climax ? 3.4 : 2.2,
            state.climax ? (Math.random() > 0.5 ? "#ff0055" : "#ffd700") : "#00f2fe",
            "circle",
            -30,
            0.96,
            0.96
          );
        }
      }

      if (player.isDashing) {
        fx.trail(player.x, player.y, player.vx * 400, player.vy * 400, "#ffd700");
      }

      fx.update(dt);

      if (player.hp <= 0) {
        fx.burst(player.x, player.y, {
          count: 28, speed: 300, life: 0.55, size: 4,
          colors: ["#ff0055", "#00f2fe", "#ffffff"], shape: "spark"
        });
        player.hp = player.maxHp;
        player.x = goals.player.x + 40;
        player.y = goals.player.y;
        player.auraCount = Math.max(0, player.auraCount - 2);
        player.invuln = 1.4;
      }

      state.enemyScoreAcc += dt * (state.climax ? 0.18 : 0.08);
      if (state.enemyScoreAcc >= 1) {
        state.enemyScore += Math.floor(state.enemyScoreAcc);
        state.enemyScoreAcc -= Math.floor(state.enemyScoreAcc);
      }

      updateCamera();
      updateHud(false);

      if (state.remainingTime <= 0) {
        state.remainingTime = 0;
        updateHud(true);
        endMatch();
      }
    } else {
      updateCamera();
      fx.update(dt);
    }

    drawWorld();
    droppedEnergies.forEach(function (orb) { orb.render(ctx, camera.x, camera.y, assets); });
    projectiles.forEach(function (p) { p.render(ctx, camera.x, camera.y); });
    enemies.forEach(function (en) { en.render(ctx, camera.x, camera.y, assets); });
    player.render(ctx, camera.x, camera.y, assets);
    fx.render(ctx, camera.x, camera.y);
    renderMinimap();

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
})();
