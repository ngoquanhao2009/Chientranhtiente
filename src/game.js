import unitsData from "../data/units.json" with { type: "json" };
import traitsData from "../data/traits.json" with { type: "json" };
import shopOddsData from "../data/shopOdds.json" with { type: "json" };

const BENCH_SIZE = 8;
const BOARD_MAX = 9;
const SHOP_SIZE = 5;
const MAX_LEVEL = 9;

const XP_TO_NEXT = {
  1: 2,
  2: 6,
  3: 10,
  4: 20,
  5: 36,
  6: 56,
  7: 80,
  8: 110,
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(items) {
  return items[randomInt(0, items.length - 1)];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isBossRound(round) {
  return round > 0 && round % 5 === 0;
}

export class Game {
  constructor() {
    this.units = unitsData;
    this.traits = traitsData;
    this.unitsById = new Map(this.units.map((u) => [u.id, u]));
    this.unitsByCost = new Map();
    for (const unit of this.units) {
      if (!this.unitsByCost.has(unit.cost)) this.unitsByCost.set(unit.cost, []);
      this.unitsByCost.get(unit.cost).push(unit);
    }
    this.oddsByLevel = new Map(shopOddsData.map((x) => [x.level, x.odds]));

    this.newRun();
  }

  newRun() {
    this.state = {
      round: 1,
      gold: 10,
      level: 1,
      xp: 0,
      playerHp: 100,
      wins: 0,
      losses: 0,
      streak: 0,
      lockedShop: false,
      bench: Array(BENCH_SIZE).fill(null),
      board: Array(BOARD_MAX).fill(null),
      shop: Array(SHOP_SIZE).fill(null),
      combat: {
        result: "",
        title: "",
        allies: [],
        enemies: [],
        startAllies: [],
        startEnemies: [],
        events: [],
        playbackId: 0,
        log: ["Bat dau van dau. Chon doi hinh va bam Qua vong."],
      },
    };

    this.rollShop(true);
  }

  hydrate(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return false;
    if (!snapshot.state || !Array.isArray(snapshot.state.bench) || !Array.isArray(snapshot.state.board)) {
      return false;
    }
    this.state = snapshot.state;
    return true;
  }

  serialize() {
    return { state: this.state };
  }

  get boardSlots() {
    return clamp(this.state.level, 1, BOARD_MAX);
  }

  get xpToNext() {
    return XP_TO_NEXT[this.state.level] ?? 0;
  }

  get canLevel() {
    return this.state.level < MAX_LEVEL;
  }

  get boardUnits() {
    return this.state.board.slice(0, this.boardSlots).filter(Boolean);
  }

  getTraitSummary() {
    const counts = new Map();
    for (const unit of this.boardUnits) {
      for (const trait of unit.traits) {
        counts.set(trait, (counts.get(trait) ?? 0) + 1);
      }
    }

    return this.traits.map((trait) => {
      const count = counts.get(trait.id) ?? 0;
      let activeTier = null;
      for (const tier of trait.tiers) {
        if (count >= tier.need) activeTier = tier;
      }
      return {
        id: trait.id,
        name: trait.name,
        desc: trait.desc,
        count,
        tiers: trait.tiers,
        activeTier,
      };
    });
  }

  getCombatBuffs() {
    const summary = this.getTraitSummary();
    const buffs = { hpPct: 0, atkPct: 0, spdPct: 0 };
    for (const row of summary) {
      if (!row.activeTier) continue;
      const effects = row.activeTier.effects ?? {};
      buffs.hpPct += effects.hpPct ?? 0;
      buffs.atkPct += effects.atkPct ?? 0;
      buffs.spdPct += effects.spdPct ?? 0;
    }
    return buffs;
  }

  rollCost(level) {
    const odds = this.oddsByLevel.get(level) ?? this.oddsByLevel.get(MAX_LEVEL);
    const r = Math.random() * 100;
    let running = 0;
    for (const row of odds) {
      running += row.pct;
      if (r <= running) return row.cost;
    }
    return 1;
  }

  randomUnitByCost(cost) {
    const pool = this.unitsByCost.get(cost) ?? this.unitsByCost.get(1) ?? [];
    return pickRandom(pool);
  }

  rollShop(free = false) {
    if (!free) {
      if (this.state.gold < 2) return { ok: false, reason: "Khong du vang de lam moi." };
      this.state.gold -= 2;
    }

    this.state.shop = Array.from({ length: SHOP_SIZE }, () => {
      const cost = this.rollCost(this.state.level);
      const base = this.randomUnitByCost(cost);
      return {
        id: base.id,
        name: base.name,
        cost: base.cost,
        traits: base.traits,
        imageUrl: base.imageUrl ?? "",
      };
    });

    return { ok: true, goldDelta: free ? 0 : -2 };
  }

  lockShop() {
    this.state.lockedShop = !this.state.lockedShop;
    return { ok: true };
  }

  createOwnedUnit(base, star = 1) {
    return {
      uid: uid(),
      id: base.id,
      name: base.name,
      cost: base.cost,
      traits: [...base.traits],
      imageUrl: base.imageUrl ?? "",
      star,
      stats: { ...base.stats },
    };
  }

  findEmptyBenchIndex() {
    return this.state.bench.findIndex((x) => !x);
  }

  findEmptyBoardIndex() {
    for (let i = 0; i < this.boardSlots; i += 1) {
      if (!this.state.board[i]) return i;
    }
    return -1;
  }

  buyFromShop(index) {
    const offer = this.state.shop[index];
    if (!offer) return { ok: false, reason: "O shop trong." };
    if (this.state.gold < offer.cost) return { ok: false, reason: "Khong du vang." };

    const benchIndex = this.findEmptyBenchIndex();
    if (benchIndex === -1) return { ok: false, reason: "Day hang du bi." };

    this.state.gold -= offer.cost;
    const base = this.unitsById.get(offer.id);
    this.state.bench[benchIndex] = this.createOwnedUnit(base, 1);
    this.state.shop[index] = null;

    const merged = this.autoMerge(base.id);
    return { ok: true, goldDelta: -offer.cost, merged };
  }

  getUnitAt(zone, index) {
    if (zone === "board") return this.state.board[index] ?? null;
    return this.state.bench[index] ?? null;
  }

  setUnitAt(zone, index, unit) {
    if (zone === "board") {
      this.state.board[index] = unit;
      return;
    }
    this.state.bench[index] = unit;
  }

  getMergeCandidates(unitId = null, star = 1) {
    const out = [];

    for (let i = 0; i < this.boardSlots; i += 1) {
      const unit = this.state.board[i];
      if (!unit) continue;
      if (unit.star !== star) continue;
      if (unitId && unit.id !== unitId) continue;
      out.push({ zone: "board", index: i, unit });
    }

    for (let i = 0; i < this.state.bench.length; i += 1) {
      const unit = this.state.bench[i];
      if (!unit) continue;
      if (unit.star !== star) continue;
      if (unitId && unit.id !== unitId) continue;
      out.push({ zone: "bench", index: i, unit });
    }

    return out;
  }

  autoMerge(unitId = null) {
    let merged = false;
    let keepChecking = true;

    while (keepChecking) {
      keepChecking = false;
      for (let star = 1; star <= 2; star += 1) {
        const candidates = this.getMergeCandidates(unitId, star);
        const byId = new Map();

        for (const slot of candidates) {
          const list = byId.get(slot.unit.id) ?? [];
          list.push(slot);
          byId.set(slot.unit.id, list);
        }

        for (const [id, slots] of byId.entries()) {
          if (slots.length < 3) continue;

          const selected = slots.slice(0, 3);
          const keeper = selected.find((x) => x.zone === "board") ?? selected[0];
          const consume = selected.filter((x) => !(x.zone === keeper.zone && x.index === keeper.index));
          const base = this.unitsById.get(id);

          this.setUnitAt(keeper.zone, keeper.index, this.createOwnedUnit(base, star + 1));
          for (const c of consume) {
            this.setUnitAt(c.zone, c.index, null);
          }

          merged = true;
          keepChecking = true;
          break;
        }

        if (keepChecking) break;
      }
    }

    return merged;
  }

  moveBenchToBoard(benchIndex) {
    return this.moveBenchToBoardAt(benchIndex, null);
  }

  moveBenchToBoardAt(benchIndex, targetBoardIndex = null) {
    const unit = this.state.bench[benchIndex];
    if (!unit) return { ok: false, reason: "Khong co tuong o o nay." };

    let slot = targetBoardIndex;
    if (slot === null || slot === undefined) {
      slot = this.findEmptyBoardIndex();
    }

    if (slot < 0 || slot >= this.boardSlots) {
      return { ok: false, reason: "O san khong hop le." };
    }

    const occupying = this.state.board[slot];
    this.state.board[slot] = unit;
    this.state.bench[benchIndex] = null;

    if (occupying) {
      this.state.bench[benchIndex] = occupying;
    }

    const merged = this.autoMerge();
    return { ok: true, merged };
  }

  moveBoardToBench(boardIndex) {
    return this.moveBoardToBenchAt(boardIndex, null);
  }

  moveBoardToBenchAt(boardIndex, targetBenchIndex = null) {
    if (boardIndex < 0 || boardIndex >= this.boardSlots) {
      return { ok: false, reason: "O san khong hop le." };
    }

    const unit = this.state.board[boardIndex];
    if (!unit) return { ok: false, reason: "Khong co tuong o san." };

    let bench = targetBenchIndex;
    if (bench === null || bench === undefined) {
      bench = this.findEmptyBenchIndex();
    }

    if (bench < 0 || bench >= this.state.bench.length) {
      return { ok: false, reason: "O du bi khong hop le." };
    }

    const occupying = this.state.bench[bench];
    this.state.bench[bench] = unit;
    this.state.board[boardIndex] = null;

    if (occupying) {
      this.state.board[boardIndex] = occupying;
    }

    const merged = this.autoMerge();
    return { ok: true, merged };
  }

  swapBench(indexA, indexB) {
    if (indexA < 0 || indexA >= this.state.bench.length || indexB < 0 || indexB >= this.state.bench.length) {
      return { ok: false, reason: "O du bi khong hop le." };
    }

    if (indexA === indexB) return { ok: true };

    const tmp = this.state.bench[indexA];
    this.state.bench[indexA] = this.state.bench[indexB];
    this.state.bench[indexB] = tmp;

    const merged = this.autoMerge();
    return { ok: true, merged };
  }

  swapBoard(indexA, indexB) {
    if (indexA < 0 || indexA >= this.boardSlots || indexB < 0 || indexB >= this.boardSlots) {
      return { ok: false, reason: "O san khong hop le." };
    }

    if (indexA === indexB) return { ok: true };

    const tmp = this.state.board[indexA];
    this.state.board[indexA] = this.state.board[indexB];
    this.state.board[indexB] = tmp;

    const merged = this.autoMerge();
    return { ok: true, merged };
  }

  sellBench(index) {
    const unit = this.state.bench[index];
    if (!unit) return { ok: false, reason: "Khong co tuong de ban." };
    const gain = unit.cost * unit.star;
    this.state.gold += gain;
    this.state.bench[index] = null;
    return { ok: true, goldDelta: gain };
  }

  buyXp() {
    if (!this.canLevel) return { ok: false, reason: "Da dat cap toi da." };
    if (this.state.gold < 4) return { ok: false, reason: "Khong du vang." };

    this.state.gold -= 4;
    this.state.xp += 4;

    while (this.canLevel) {
      const needed = this.xpToNext;
      if (this.state.xp < needed) break;
      this.state.xp -= needed;
      this.state.level += 1;
    }

    return { ok: true, goldDelta: -4 };
  }

  makeFighter(unit, side, index, buffs, roundScale = 1) {
    const starHpScale = 1 + (unit.star - 1) * 0.85;
    const starAtkScale = 1 + (unit.star - 1) * 0.55;

    const hp = Math.round(unit.stats.hp * starHpScale * (1 + buffs.hpPct) * roundScale);
    const atk = Math.round(unit.stats.atk * starAtkScale * (1 + buffs.atkPct) * roundScale);
    const spd = Number((unit.stats.spd * (1 + buffs.spdPct)).toFixed(2));

    return {
      key: `${side}-${index}-${unit.uid ?? uid()}`,
      side,
      index,
      name: `${unit.name} ${"★".repeat(unit.star)}`,
      hp,
      maxHp: hp,
      atk,
      spd,
      alive: true,
    };
  }

  cloneFighter(f) {
    return {
      key: f.key,
      side: f.side,
      index: f.index,
      name: f.name,
      hp: f.hp,
      maxHp: f.maxHp,
      atk: f.atk,
      spd: f.spd,
      alive: f.alive,
    };
  }

  buildEnemyTeam(round) {
    const count = clamp(1 + Math.floor(round / 2), 1, this.boardSlots);
    const enemyLevel = clamp(Math.ceil(round / 3), 1, MAX_LEVEL);
    const boss = isBossRound(round);
    const list = [];

    if (boss) {
      const bossPool = this.units.filter((u) => u.cost >= 4);
      const picked = pickRandom(bossPool.length > 0 ? bossPool : this.units);
      const bossUnit = this.createOwnedUnit(picked, round >= 15 ? 3 : 2);
      list.push(bossUnit);
    }

    const startIndex = boss ? 1 : 0;
    for (let i = startIndex; i < count; i += 1) {
      const cost = this.rollCost(enemyLevel);
      const base = this.randomUnitByCost(cost);
      const star = round >= 10 && Math.random() < 0.22 ? 2 : 1;
      const unit = this.createOwnedUnit(base, star);
      list.push(unit);
    }

    return {
      list,
      boss,
      bossName: boss ? list[0].name : "",
    };
  }

  pickAlive(units) {
    return units.filter((x) => x.alive);
  }

  runCombat(round) {
    const allyUnits = this.boardUnits;
    if (allyUnits.length === 0) {
      this.state.streak = this.state.streak <= 0 ? this.state.streak - 1 : -1;
      this.state.losses += 1;
      this.state.playerHp = Math.max(0, this.state.playerHp - 6);
      this.state.combat = {
        result: "Thua (khong co doi hinh tren san)",
        title: `Round ${round}`,
        allies: [],
        enemies: [],
        startAllies: [],
        startEnemies: [],
        events: [],
        playbackId: Date.now(),
        log: ["Ban can dua tuong len san truoc khi qua vong."],
      };
      return { win: false, boss: false, bossName: "" };
    }

    const enemyBuild = this.buildEnemyTeam(round);
    const enemyUnits = enemyBuild.list;

    const allyBuffs = this.getCombatBuffs();
    const enemyBuffs = {
      hpPct: enemyBuild.boss ? 0.3 : 0,
      atkPct: round * 0.013 + (enemyBuild.boss ? 0.1 : 0),
      spdPct: round * 0.009 + (enemyBuild.boss ? 0.04 : 0),
    };

    const allies = allyUnits.map((u, i) => this.makeFighter(u, "ally", i, allyBuffs, 1));
    const enemies = enemyUnits.map((u, i) => this.makeFighter(u, "enemy", i, enemyBuffs, 1));
    const startAllies = allies.map((f) => this.cloneFighter(f));
    const startEnemies = enemies.map((f) => this.cloneFighter(f));
    const events = [];
    let bossSkillTick = 3;

    const log = [];
    let turns = 0;

    while (this.pickAlive(allies).length > 0 && this.pickAlive(enemies).length > 0 && turns < 60) {
      turns += 1;
      const turnOrder = [...this.pickAlive(allies), ...this.pickAlive(enemies)].sort((a, b) => b.spd - a.spd);

      for (const actor of turnOrder) {
        if (!actor.alive) continue;
        const own = actor.side === "ally" ? allies : enemies;
        const opp = actor.side === "ally" ? enemies : allies;
        if (this.pickAlive(opp).length === 0) break;

        if (enemyBuild.boss && actor.side === "enemy" && actor.key === enemies[0].key) {
          bossSkillTick -= 1;
          if (bossSkillTick <= 0) {
            bossSkillTick = 3;
            const targets = this.pickAlive(allies);
            if (targets.length > 0) {
              log.push(`${actor.name} kich hoat ky nang NO SAT THUONG!`);
              for (const target of targets) {
                const aoeDamage = Math.max(1, Math.round(actor.atk * (0.55 + Math.random() * 0.2)));
                target.hp = Math.max(0, target.hp - aoeDamage);
                target.alive = target.hp > 0;
                log.push(`${target.name} trung no -${aoeDamage}HP`);
                events.push({
                  type: "aoe-hit",
                  actorKey: actor.key,
                  actorName: actor.name,
                  targetKey: target.key,
                  targetName: target.name,
                  damage: aoeDamage,
                  hpAfter: target.hp,
                  dead: !target.alive,
                  text: `${target.name} trung no -${aoeDamage}HP`,
                });
                if (!target.alive) {
                  log.push(`${target.name} bi ha guc boi no sat thuong.`);
                  events.push({
                    type: "defeat",
                    actorKey: actor.key,
                    targetKey: target.key,
                    text: `${target.name} bi ha guc boi no sat thuong.`,
                  });
                }
              }
              if (this.pickAlive(allies).length === 0) break;
            }
          }
        }

        const target = pickRandom(this.pickAlive(opp));
        const rng = 0.88 + Math.random() * 0.24;
        const damage = Math.max(1, Math.round(actor.atk * rng));

        target.hp = Math.max(0, target.hp - damage);
        target.alive = target.hp > 0;

        log.push(`${actor.name} danh ${target.name} -${damage}HP`);
        events.push({
          type: "hit",
          actorKey: actor.key,
          actorName: actor.name,
          targetKey: target.key,
          targetName: target.name,
          damage,
          hpAfter: target.hp,
          dead: !target.alive,
          text: `${actor.name} danh ${target.name} -${damage}HP`,
        });

        if (!target.alive) {
          log.push(`${target.name} bi ha guc.`);
          events.push({
            type: "defeat",
            actorKey: actor.key,
            targetKey: target.key,
            text: `${target.name} bi ha guc.`,
          });
        }

        if (this.pickAlive(opp).length === 0) break;
        if (this.pickAlive(own).length === 0) break;
      }
    }

    const allyAlive = this.pickAlive(allies).length;
    const enemyAlive = this.pickAlive(enemies).length;
    const win = allyAlive > 0 && enemyAlive === 0;

    if (win) {
      this.state.wins += 1;
      this.state.streak = this.state.streak >= 0 ? this.state.streak + 1 : 1;
      if (enemyBuild.boss) {
        log.unshift(`Pha dao boss ${enemyBuild.bossName}! Con ${allyAlive} don vi song sot.`);
      } else {
        log.unshift(`Chien thang! Con ${allyAlive} don vi song sot.`);
      }
    } else {
      this.state.losses += 1;
      this.state.streak = this.state.streak <= 0 ? this.state.streak - 1 : -1;
      const damage = Math.max(2, enemyAlive * 2 + Math.floor(round / 3) + (enemyBuild.boss ? 3 : 0));
      this.state.playerHp = Math.max(0, this.state.playerHp - damage);
      if (enemyBuild.boss) {
        log.unshift(`That bai truoc boss ${enemyBuild.bossName}! Mat ${damage} mau linh hoat.`);
      } else {
        log.unshift(`That bai! Mat ${damage} mau linh hoat.`);
      }
    }

    this.state.combat = {
      result: win ? "WIN" : "LOSE",
      title: enemyBuild.boss ? `Round ${round} - Boss` : `Round ${round}`,
      allies,
      enemies,
      startAllies,
      startEnemies,
      events,
      playbackId: Date.now() + randomInt(0, 1000),
      log: log.slice(0, 50),
    };

    return {
      win,
      boss: enemyBuild.boss,
      bossName: enemyBuild.bossName,
    };
  }

  streakBonus() {
    const s = Math.abs(this.state.streak);
    if (s >= 6) return 3;
    if (s >= 4) return 2;
    if (s >= 2) return 1;
    return 0;
  }

  computeIncome(win) {
    const base = 5;
    const interest = Math.min(5, Math.floor(this.state.gold / 10));
    const streak = this.streakBonus();
    const victory = win ? 1 : 0;
    return {
      total: base + interest + streak + victory,
      base,
      interest,
      streak,
      victory,
    };
  }

  nextRound() {
    const currentRound = this.state.round;
    const combatResult = this.runCombat(currentRound);
    const income = this.computeIncome(combatResult.win);
    const bossBonus = combatResult.boss && combatResult.win ? 2 : 0;

    income.bossBonus = bossBonus;
    income.total += bossBonus;

    this.state.gold += income.total;
    this.state.round += 1;

    if (!this.state.lockedShop) {
      this.rollShop(true);
    }

    return {
      ok: true,
      win: combatResult.win,
      income,
      round: currentRound,
      boss: combatResult.boss,
      bossName: combatResult.bossName,
    };
  }
}
