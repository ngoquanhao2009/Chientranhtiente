import charactersData from "../data/characters.json" with { type: "json" };
import factionsData from "../data/factions.json" with { type: "json" };
import archetypesData from "../data/archetypes.json" with { type: "json" };
import bossesData from "../data/bosses.json" with { type: "json" };
import shopOddsData from "../data/shopOdds.json" with { type: "json" };
import passivesData from "../data/passives.json" with { type: "json" };

const BENCH_SIZE = 8;
const BOARD_MAX = 9;
const SHOP_SIZE = 5;
const MAX_LEVEL = 9;
const SNAPSHOT_VERSION = 7;

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

const CHARACTER_THEME_BY_ID = {
  c001: "#f59e0b",
  c002: "#7dd3fc",
  c003: "#93c5fd",
  c004: "#fb7185",
  c005: "#a78bfa",
  c006: "#f97316",
  c007: "#60a5fa",
  c008: "#ef4444",
  c009: "#f43f5e",
  c010: "#7c3aed",
  c011: "#c4b5fd",
  c012: "#38bdf8",
  c013: "#22c55e",
  c014: "#fbbf24",
  c015: "#34d399",
  c016: "#e879f9",
  c017: "#f8fafc",
  c018: "#f59e0b",
  c019: "#fcd34d",
  c020: "#818cf8",
  c021: "#6ee7b7",
  c022: "#93c5fd",
  c023: "#f9a8d4",
  c024: "#f97316",
  c025: "#f472b6",
  c026: "#84cc16",
  c027: "#22d3ee",
  c028: "#fb7185",
  c029: "#fde047",
  c030: "#9ca3af",
};

const FACTION_THEME_BY_NAME = {
  "Astral Express": "#60a5fa",
  "Stellaron Hunters": "#f97316",
  Belobog: "#38bdf8",
  "Xianzhou Luofu": "#f59e0b",
  IPC: "#fbbf24",
  "Genius Society": "#a78bfa",
  Penacony: "#f472b6",
  "Galaxy Rangers": "#fb7185",
  "Masked Fools": "#f43f5e",
  "Chrysos Heirs": "#22d3ee",
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

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function blendHexColor(colorA = "#7aa2ff", colorB = "#f472b6") {
  const a = colorA.replace("#", "");
  const b = colorB.replace("#", "");
  if (a.length !== 6 || b.length !== 6) return colorA;

  const ar = Number.parseInt(a.slice(0, 2), 16);
  const ag = Number.parseInt(a.slice(2, 4), 16);
  const ab = Number.parseInt(a.slice(4, 6), 16);
  const br = Number.parseInt(b.slice(0, 2), 16);
  const bg = Number.parseInt(b.slice(2, 4), 16);
  const bb = Number.parseInt(b.slice(4, 6), 16);

  const r = Math.round((ar + br) / 2).toString(16).padStart(2, "0");
  const g = Math.round((ag + bg) / 2).toString(16).padStart(2, "0");
  const c = Math.round((ab + bb) / 2).toString(16).padStart(2, "0");
  return `#${r}${g}${c}`;
}

function compactNamePart(name) {
  const clean = String(name ?? "")
    .replace(/[^A-Za-z0-9]/g, "")
    .trim();
  return clean || "X";
}

export class Game {
  constructor() {
    const validated = this.validateDataIntegrity();
    this.integrityIssues = validated.issues;
    this.characters = validated.characters;
    this.factions = validated.factions;
    this.archetypes = validated.archetypes;
    this.bosses = validated.bosses;
    this.passives = validated.passives;
    this.shopOdds = validated.shopOdds;
    this.archetypeNameById = new Map(this.archetypes.map((x) => [x.id, x.name]));
    this.charactersById = new Map(this.characters.map((u) => [u.id, u]));
    this.passiveById = new Map(this.passives.map((x) => [x.id, x]));
    this.charactersByCost = new Map();
    for (const unit of this.characters) {
      if (!this.charactersByCost.has(unit.cost)) this.charactersByCost.set(unit.cost, []);
      this.charactersByCost.get(unit.cost).push(unit);
    }
    this.oddsByLevel = new Map(this.shopOdds.map((x) => [x.level, x.odds]));

    this.newRun();
  }

  validateDataIntegrity() {
    const issues = [];
    const characters = [];
    const factions = Array.isArray(factionsData) ? factionsData : [];
    const archetypes = Array.isArray(archetypesData) ? archetypesData : [];
    const bosses = [];
    const passives = [];
    const shopOdds = [];

    const seenCharacterIds = new Set();
    for (const raw of Array.isArray(charactersData) ? charactersData : []) {
      if (!raw || typeof raw !== "object") {
        issues.push("characters: co phan tu khong hop le.");
        continue;
      }

      const id = typeof raw.id === "string" ? raw.id.trim() : "";
      const name = typeof raw.name === "string" ? raw.name.trim() : "";
      const cost = Math.floor(asNumber(raw.cost, -1));
      const hp = Math.floor(asNumber(raw.stats?.hp, -1));
      const atk = Math.floor(asNumber(raw.stats?.atk, -1));
      const spd = asNumber(raw.stats?.spd, -1);

      if (!id || seenCharacterIds.has(id)) {
        issues.push(`characters: id loi hoac trung (${id || "missing"}).`);
        continue;
      }
      if (!name || cost < 1 || cost > 5) {
        issues.push(`characters: ${id} thieu name/cost hop le.`);
        continue;
      }
      if (hp <= 0 || atk <= 0 || spd <= 0) {
        issues.push(`characters: ${id} thieu stats hp/atk/spd hop le.`);
        continue;
      }

      seenCharacterIds.add(id);
      characters.push(raw);
    }

    const seenPassiveIds = new Set();
    for (const raw of Array.isArray(passivesData) ? passivesData : []) {
      if (!raw || typeof raw !== "object") {
        issues.push("passives: co phan tu khong hop le.");
        continue;
      }
      const id = typeof raw.id === "string" ? raw.id.trim() : "";
      const name = typeof raw.name === "string" ? raw.name.trim() : "";
      if (!id || !name || seenPassiveIds.has(id)) {
        issues.push(`passives: id/name loi (${id || "missing"}).`);
        continue;
      }
      if (!characters.some((x) => x.id === id)) {
        issues.push(`passives: ${id} khong co character tuong ung.`);
        continue;
      }
      seenPassiveIds.add(id);
      passives.push(raw);
    }

    for (const raw of Array.isArray(shopOddsData) ? shopOddsData : []) {
      if (!raw || typeof raw !== "object") {
        issues.push("shopOdds: co phan tu khong hop le.");
        continue;
      }
      const level = Math.floor(asNumber(raw.level, -1));
      const odds = Array.isArray(raw.odds) ? raw.odds : [];
      const sum = odds.reduce((acc, item) => acc + asNumber(item?.pct, 0), 0);
      if (level < 1 || level > MAX_LEVEL || odds.length === 0 || sum <= 0) {
        issues.push(`shopOdds: level ${raw.level ?? "missing"} loi.`);
        continue;
      }
      shopOdds.push(raw);
    }

    for (const raw of Array.isArray(bossesData) ? bossesData : []) {
      if (!raw || typeof raw !== "object") {
        issues.push("bosses: co phan tu khong hop le.");
        continue;
      }
      const id = typeof raw.id === "string" ? raw.id.trim() : "";
      const hp = Math.floor(asNumber(raw.base?.hp, -1));
      const atk = Math.floor(asNumber(raw.base?.atk, -1));
      const spd = asNumber(raw.base?.spd, -1);
      if (!id || hp <= 0 || atk <= 0 || spd <= 0) {
        issues.push(`bosses: ${id || "missing"} loi du lieu base.`);
        continue;
      }
      bosses.push(raw);
    }

    if (characters.length === 0) {
      throw new Error("Khong co du lieu character hop le.");
    }

    if (shopOdds.length === 0) {
      throw new Error("Khong co du lieu shopOdds hop le.");
    }

    return {
      issues,
      characters,
      factions,
      archetypes,
      bosses: bosses.length > 0 ? bosses : bossesData,
      passives,
      shopOdds,
    };
  }

  passivePowerScale(cost, star, round) {
    const costFactor = ({ 1: 0.84, 2: 0.9, 3: 1, 4: 1.08, 5: 1.15 })[cost] ?? 1;
    const starFactor = 1 + Math.max(0, star - 1) * 0.08;
    const roundFactor = round >= 16 ? 0.82 : round >= 11 ? 0.9 : 1;
    return costFactor * starFactor * roundFactor;
  }

  scalePassivePct(value, scale, cap = 0.55) {
    if (!value) return 0;
    return clamp(value * scale, 0, cap);
  }

  scalePassiveChance(value, cost, round, cap = 0.42) {
    if (!value) return 0;
    const costFactor = ({ 1: 0.82, 2: 0.88, 3: 0.95, 4: 1.02, 5: 1.1 })[cost] ?? 1;
    const roundFactor = round >= 16 ? 0.78 : round >= 11 ? 0.86 : 0.95;
    return clamp(value * costFactor * roundFactor, 0, cap);
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
      shopLockTargetRound: null,
      bench: Array(BENCH_SIZE).fill(null),
      settings: {
        showEmoji: true,
      },
      fusion: {
        mode: false,
        picks: [],
      },
      board: Array(BOARD_MAX).fill(null),
      shop: Array(SHOP_SIZE).fill(null),
      combat: {
        result: "",
        title: "",
        allies: [],
        enemies: [],
        startAllies: [],
        startEnemies: [],
        bossInfo: null,
        events: [],
        playbackId: 0,
        log: ["Bat dau van dau. Chon doi hinh va bam Qua vong."],
      },
      inspect: {
        title: "Huong dan nhanh",
        tags: ["Keo-tha de sap doi hinh"],
        passive: null,
      },
    };

    this.rollShop(true);
  }

  hydrate(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return false;
    if ((snapshot.version ?? 0) !== SNAPSHOT_VERSION) return false;
    if (!snapshot.state || !Array.isArray(snapshot.state.bench) || !Array.isArray(snapshot.state.board)) {
      return false;
    }
    const source = snapshot.state;

    const level = clamp(Math.floor(asNumber(source.level, 1)), 1, MAX_LEVEL);
    const xpCap = XP_TO_NEXT[level] ?? 0;
    const board = Array.from({ length: BOARD_MAX }, (_, i) => this.normalizeOwnedUnit(source.board[i]));
    const bench = Array.from({ length: BENCH_SIZE }, (_, i) => this.normalizeOwnedUnit(source.bench[i]));
    const shop = Array.from({ length: SHOP_SIZE }, (_, i) => this.normalizeShopOffer(source.shop?.[i]));

    this.state = {
      round: Math.max(1, Math.floor(asNumber(source.round, 1))),
      gold: Math.max(0, Math.floor(asNumber(source.gold, 0))),
      level,
      xp: clamp(Math.floor(asNumber(source.xp, 0)), 0, xpCap),
      playerHp: clamp(Math.floor(asNumber(source.playerHp, 100)), 0, 999),
      wins: Math.max(0, Math.floor(asNumber(source.wins, 0))),
      losses: Math.max(0, Math.floor(asNumber(source.losses, 0))),
      streak: Math.floor(asNumber(source.streak, 0)),
      lockedShop: Boolean(source.lockedShop),
      shopLockTargetRound: source.lockedShop
        ? Math.max(1, Math.floor(asNumber(source.shopLockTargetRound, asNumber(source.round, 1) + 1)))
        : null,
      bench,
      board,
      shop,
      combat: source.combat && typeof source.combat === "object" ? source.combat : null,
      inspect: source.inspect && typeof source.inspect === "object" ? source.inspect : null,
      settings: {
        showEmoji: source.settings?.showEmoji !== false,
      },
      fusion: {
        mode: Boolean(source.fusion?.mode),
        picks: Array.isArray(source.fusion?.picks) ? source.fusion.picks.slice(0, 2) : [],
      },
    };

    this.state.fusion.mode = false;
    this.state.fusion.picks = [];

    if (!this.state.combat) {
      this.state.combat = {
        result: "",
        title: "",
        allies: [],
        enemies: [],
        startAllies: [],
        startEnemies: [],
        bossInfo: null,
        events: [],
        playbackId: 0,
        log: ["Ban da tai save cu."],
      };
    } else {
      this.state.combat.events = Array.isArray(this.state.combat.events) ? this.state.combat.events : [];
      this.state.combat.log = Array.isArray(this.state.combat.log)
        ? this.state.combat.log.slice(0, 80)
        : ["Ban da tai ban luu."];
      this.state.combat.playbackId = Math.floor(asNumber(this.state.combat.playbackId, Date.now()));
      this.state.combat.startAllies = Array.isArray(this.state.combat.startAllies)
        ? this.state.combat.startAllies
        : [];
      this.state.combat.startEnemies = Array.isArray(this.state.combat.startEnemies)
        ? this.state.combat.startEnemies
        : [];
      this.state.combat.allies = Array.isArray(this.state.combat.allies) ? this.state.combat.allies : [];
      this.state.combat.enemies = Array.isArray(this.state.combat.enemies) ? this.state.combat.enemies : [];
    }

    if (!this.state.inspect) {
      this.state.inspect = {
        title: "Thong tin",
        tags: ["Di chuot vao tuong de xem"],
        passive: null,
      };
    } else {
      const passive = this.state.inspect.passive;
      this.state.inspect = {
        title: this.state.inspect.title ?? this.state.inspect.name ?? "Thong tin",
        tags: Array.isArray(this.state.inspect.tags) ? this.state.inspect.tags.filter(Boolean).slice(0, 4) : [],
        passive: passive && typeof passive === "object"
          ? {
            name: passive.name ?? "Passive",
            effectTone: passive.effectTone ?? "mixed",
            desc: passive.desc ?? "",
          }
          : null,
      };
    }

    if (!this.state.lockedShop && this.state.shop.every((x) => !x)) {
      this.rollShop(true);
    }

    return true;
  }

  normalizeOwnedUnit(raw) {
    if (!raw || typeof raw !== "object") return null;
    const base = this.charactersById.get(raw.id);
    if (!base) {
      if (!raw.fusionMeta || typeof raw.fusionMeta !== "object") return null;
      const passive = raw.passive && typeof raw.passive === "object"
        ? {
          ...raw.passive,
          effects: { ...(raw.passive.effects ?? {}) },
          triggerKinds: Array.isArray(raw.passive.triggerKinds) ? raw.passive.triggerKinds.slice(0, 4) : [],
          themeColor: raw.passive.themeColor ?? "#7aa2ff",
        }
        : null;

      return {
        uid: typeof raw.uid === "string" && raw.uid.trim() ? raw.uid : uid(),
        id: typeof raw.id === "string" ? raw.id : `fusion:${uid()}`,
        name: String(raw.name ?? "Fusion Unit"),
        cost: clamp(Math.floor(asNumber(raw.cost, 3)), 1, 5),
        faction: String(raw.faction ?? "Fusion"),
        archetypes: Array.isArray(raw.archetypes) ? raw.archetypes.filter(Boolean).slice(0, 6) : [],
        bio: String(raw.bio ?? "Don vi hop the."),
        imageUrl: String(raw.imageUrl ?? ""),
        fusionImageUrl2: String(raw.fusionImageUrl2 ?? ""),
        star: clamp(Math.floor(asNumber(raw.star, 1)), 1, 3),
        stats: {
          hp: Math.max(1, Math.floor(asNumber(raw.stats?.hp, 800))),
          atk: Math.max(1, Math.floor(asNumber(raw.stats?.atk, 70))),
          spd: Math.max(0.1, asNumber(raw.stats?.spd, 1)),
        },
        passive,
        fusionMeta: {
          from: Array.isArray(raw.fusionMeta.from) ? raw.fusionMeta.from.slice(0, 64) : [],
          names: Array.isArray(raw.fusionMeta.names)
            ? raw.fusionMeta.names
              .map((x) => String(x ?? "").trim())
              .filter(Boolean)
              .slice(0, 64)
            : [],
          sourceCount: Math.max(2, Math.floor(asNumber(raw.fusionMeta.sourceCount, 2))),
          atRound: Math.max(1, Math.floor(asNumber(raw.fusionMeta.atRound, this.state?.round ?? 1))),
        },
      };
    }

    const star = clamp(Math.floor(asNumber(raw.star, 1)), 1, 3);
    const rawStats = raw.stats && typeof raw.stats === "object" ? raw.stats : {};
    const stats = {
      hp: Math.max(1, Math.floor(asNumber(rawStats.hp, base.stats.hp))),
      atk: Math.max(1, Math.floor(asNumber(rawStats.atk, base.stats.atk))),
      spd: Math.max(0.1, asNumber(rawStats.spd, base.stats.spd)),
    };
    const passive = this.buildPassiveForUnit(base);

    return {
      uid: typeof raw.uid === "string" && raw.uid.trim() ? raw.uid : uid(),
      id: base.id,
      name: base.name,
      cost: base.cost,
      faction: base.faction,
      archetypes: [...(base.archetypes ?? [])],
      bio: base.bio,
      imageUrl: raw.imageUrl ?? base.imageUrl ?? "",
      fusionImageUrl2: "",
      star,
      stats,
      bossSkill: raw.bossSkill ?? null,
      passive,
      fusionMeta: null,
    };
  }

  normalizeShopOffer(raw) {
    if (!raw || typeof raw !== "object") return null;
    const base = this.charactersById.get(raw.id);
    if (!base) return null;
    const passive = this.buildPassiveForUnit(base);

    return {
      id: base.id,
      name: base.name,
      cost: base.cost,
      faction: base.faction,
      archetypes: [...(base.archetypes ?? [])],
      bio: base.bio,
      imageUrl: raw.imageUrl ?? base.imageUrl ?? "",
      passive,
    };
  }

  serialize() {
    return {
      version: SNAPSHOT_VERSION,
      state: this.state,
    };
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

  setInspect(payload) {
    if (!payload) return;
    this.state.inspect = {
      title: payload.title ?? payload.name ?? "Thong tin",
      tags: payload.tags ?? [],
      passive: payload.passive ?? null,
    };
  }

  displayArchetype(id) {
    return this.archetypeNameById.get(id) ?? id;
  }

  getUnitDisplayTags(unit) {
    const archetypes = (unit.archetypes ?? []).map((id) => this.displayArchetype(id));
    return [unit.faction, ...archetypes].filter(Boolean);
  }

  unitInspectTags(unit) {
    return this.getUnitDisplayTags(unit)
      .filter(Boolean)
      .slice(0, 2);
  }

  getInfoFromShop(index) {
    const x = this.state.shop[index];
    if (!x) return;
    this.setInspect({
      title: x.name,
      tags: this.unitInspectTags(x),
      passive: x.passive ?? null,
    });
  }

  getInfoFromBench(index) {
    const x = this.state.bench[index];
    if (!x) return;
    this.setInspect({
      title: x.name,
      tags: this.unitInspectTags(x),
      passive: x.passive ?? null,
    });
  }

  getInfoFromBoard(index) {
    const x = this.state.board[index];
    if (!x) return;
    this.setInspect({
      title: x.name,
      tags: this.unitInspectTags(x),
      passive: x.passive ?? null,
    });
  }

  getPassiveById(unitId) {
    return this.passiveById.get(unitId) ?? null;
  }

  getCharacterThemeColor(base) {
    if (!base) return "#7aa2ff";
    return CHARACTER_THEME_BY_ID[base.id]
      ?? FACTION_THEME_BY_NAME[base.faction]
      ?? "#7aa2ff";
  }

  getPassiveTriggerKinds(effects = {}) {
    const out = [];
    const keys = Object.keys(effects);
    if (keys.some((x) => x.startsWith("onAttack"))) out.push("ATK");
    if (keys.some((x) => x.startsWith("onHit"))) out.push("HIT");
    if (keys.some((x) => x.startsWith("periodic"))) out.push("AURA");
    return out;
  }

  buildPassiveForUnit(base) {
    if (!base) return null;
    const passive = this.getPassiveById(base.id);
    if (!passive) return null;
    const effects = { ...(passive.effects ?? {}) };
    return {
      ...passive,
      effects,
      themeColor: this.getCharacterThemeColor(base),
      triggerKinds: this.getPassiveTriggerKinds(effects),
    };
  }

  getSynergyRows(configList, countMap, group) {
    return configList.map((item) => {
      const count = countMap.get(item.id) ?? 0;
      let activeTier = null;
      for (const tier of item.tiers) {
        if (count >= tier.need) activeTier = tier;
      }
      return {
        group,
        id: item.id,
        name: item.name,
        desc: item.desc,
        count,
        tiers: item.tiers,
        activeTier,
      };
    });
  }

  getSynergyOverview() {
    const factionCounts = new Map();
    const archetypeCounts = new Map();

    for (const unit of this.boardUnits) {
      factionCounts.set(unit.faction, (factionCounts.get(unit.faction) ?? 0) + 1);
      for (const type of unit.archetypes ?? []) {
        archetypeCounts.set(type, (archetypeCounts.get(type) ?? 0) + 1);
      }
    }

    return {
      factions: this.getSynergyRows(this.factions, factionCounts, "Phe phai"),
      archetypes: this.getSynergyRows(this.archetypes, archetypeCounts, "Toc he"),
    };
  }

  getTraitSummary() {
    const overview = this.getSynergyOverview();
    return [...overview.factions, ...overview.archetypes];
  }

  getCombatBuffs() {
    const overview = this.getSynergyOverview();
    const summary = [...overview.factions, ...overview.archetypes];
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
    const pool = this.charactersByCost.get(cost) ?? this.charactersByCost.get(1) ?? [];
    return pickRandom(pool);
  }

  blockIfFusionMode(actionName = "thao tac") {
    if (!this.state.fusion?.mode) return null;
    this.state.fusion.mode = false;
    this.clearFusionPicks();
    return null;
  }

  clearFusionPicks() {
    if (!this.state.fusion) return;
    this.state.fusion.picks = [];
  }

  rollShop(free = false) {
    if (!free) {
      const blocked = this.blockIfFusionMode("lam moi shop");
      if (blocked) return blocked;
    }

    if (!free) {
      if (this.state.gold < 2) return { ok: false, reason: "Khong du vang de lam moi." };
      this.state.gold -= 2;
    }

    this.state.shop = Array.from({ length: SHOP_SIZE }, () => {
      const cost = this.rollCost(this.state.level);
      const base = this.randomUnitByCost(cost);
      if (!base) return null;
      const passive = this.buildPassiveForUnit(base);
      return {
        id: base.id,
        name: base.name,
        cost: base.cost,
        faction: base.faction,
        archetypes: base.archetypes,
        bio: base.bio,
        imageUrl: base.imageUrl ?? "",
        passive,
      };
    });

    return { ok: true, goldDelta: free ? 0 : -2 };
  }

  lockShop() {
    this.state.lockedShop = !this.state.lockedShop;
    this.state.shopLockTargetRound = this.state.lockedShop ? this.state.round + 1 : null;
    return { ok: true };
  }

  getShopLockTargetRound() {
    if (!this.state.lockedShop) return null;
    return Math.max(this.state.round + 1, asNumber(this.state.shopLockTargetRound, this.state.round + 1));
  }

  createOwnedUnit(base, star = 1) {
    const passive = this.buildPassiveForUnit(base);
    return {
      uid: uid(),
      id: base.id,
      name: base.name,
      cost: base.cost,
      faction: base.faction,
      archetypes: [...(base.archetypes ?? [])],
      bio: base.bio,
      imageUrl: base.imageUrl ?? "",
      fusionImageUrl2: "",
      star,
      stats: { ...base.stats },
      passive,
      fusionMeta: null,
    };
  }

  setEmojiEnabled(enabled) {
    this.state.settings.showEmoji = Boolean(enabled);
    return { ok: true };
  }

  toggleFusionMode() {
    this.state.fusion.mode = !this.state.fusion.mode;
    this.state.fusion.picks = [];
    return {
      ok: true,
      reason: this.state.fusion.mode
        ? "Che do Hop the da bat. Chon 2 the tren Board/Bench."
        : "Da tat che do Hop the.",
    };
  }

  getFusionPickUnit(zone, index) {
    if (zone !== "board" && zone !== "bench") return null;
    const unit = this.getUnitAt(zone, index);
    if (!unit) return null;
    return { zone, index, unit };
  }

  mergePassiveEffects(effectsA = {}, effectsB = {}) {
    const keys = new Set([...Object.keys(effectsA), ...Object.keys(effectsB)]);
    const out = {};
    for (const key of keys) {
      const a = asNumber(effectsA[key], 0);
      const b = asNumber(effectsB[key], 0);
      if (!Number.isFinite(a) && !Number.isFinite(b)) continue;
      const merged = a + b;
      if (key.toLowerCase().includes("chance")) {
        out[key] = clamp(merged * 0.9, 0, 0.62);
      } else if (key.toLowerCase().includes("interval")) {
        out[key] = Math.max(1, Math.floor(Math.min(a || 99, b || 99)));
      } else {
        out[key] = clamp(merged * 0.92, 0, 1.1);
      }
    }
    return out;
  }

  mergePassiveTone(toneA = "mixed", toneB = "mixed") {
    if (toneA === toneB) return toneA;
    if (toneA === "mixed" || toneB === "mixed") return "mixed";
    return "mixed";
  }

  getFusionSourceNames(unit) {
    if (!unit || typeof unit !== "object") return [];
    const metaNames = Array.isArray(unit.fusionMeta?.names)
      ? unit.fusionMeta.names.map((x) => String(x ?? "").trim()).filter(Boolean)
      : [];
    if (metaNames.length > 0) return metaNames;
    if (typeof unit.name === "string" && unit.name.trim()) return [unit.name.trim()];
    return ["X"];
  }

  buildFusionDisplayName(sourceNames) {
    const names = sourceNames
      .map((x) => compactNamePart(x))
      .filter(Boolean)
      .slice(0, 64);

    if (names.length === 0) return "Fusion";

    const maxLen = 12;
    if (names.length === 1) return names[0].slice(0, maxLen);

    if (names.length === 2) {
      const buildHeadTail = (raw) => {
        if (raw.length <= 6) return raw;
        return `${raw.slice(0, 3)}${raw.slice(-3)}`;
      };
      const merged = `${buildHeadTail(names[0])}${buildHeadTail(names[1])}`;
      return merged.slice(0, maxLen) || "Fusion";
    }

    const perPart = names.length <= 3
      ? 4
      : names.length <= 4
        ? 3
        : names.length <= 6
          ? 2
          : 1;

    const tokens = names.map((x) => x.slice(0, perPart)).filter(Boolean);
    let out = "";
    let round = 0;

    while (out.length < maxLen && round < perPart) {
      for (const token of tokens) {
        if (out.length >= maxLen) break;
        const ch = token[round];
        if (ch) out += ch;
      }
      round += 1;
    }

    if (out.length < maxLen) {
      out += tokens.join("");
    }

    return out.slice(0, maxLen) || "Fusion";
  }

  createFusionUnit(slotA, slotB) {
    const a = slotA.unit;
    const b = slotB.unit;
    const aAtk = asNumber(a.stats?.atk, 1);
    const bAtk = asNumber(b.stats?.atk, 1);
    const primary = aAtk >= bAtk ? a : b;
    const secondary = primary === a ? b : a;

    const star = a.star === b.star ? clamp(a.star + 1, 1, 3) : Math.max(a.star, b.star);
    const hp = Math.max(1, Math.round((asNumber(a.stats?.hp, 500) + asNumber(b.stats?.hp, 500)) * 0.72));
    const atk = Math.max(1, Math.round((aAtk + bAtk) * 0.74));
    const spd = Number((Math.max(asNumber(a.stats?.spd, 1), asNumber(b.stats?.spd, 1)) + Math.min(asNumber(a.stats?.spd, 1), asNumber(b.stats?.spd, 1)) * 0.35).toFixed(2));
    const passiveA = a.passive ?? null;
    const passiveB = b.passive ?? null;
    const fromA = Array.isArray(a.fusionMeta?.from) ? a.fusionMeta.from : [a.id];
    const fromB = Array.isArray(b.fusionMeta?.from) ? b.fusionMeta.from : [b.id];
    const namesA = this.getFusionSourceNames(a);
    const namesB = this.getFusionSourceNames(b);
    const mergedSourceNames = [...namesA, ...namesB].slice(0, 64);
    const sourceCount = mergedSourceNames.length;
    const mergedEffects = this.mergePassiveEffects(passiveA?.effects ?? {}, passiveB?.effects ?? {});
    const mergedTone = this.mergePassiveTone(passiveA?.effectTone ?? "mixed", passiveB?.effectTone ?? "mixed");
    const colorA = passiveA?.themeColor ?? this.getCharacterThemeColor(a);
    const colorB = passiveB?.themeColor ?? this.getCharacterThemeColor(b);
    const fusionName = this.buildFusionDisplayName(mergedSourceNames);
    const fusionId = `fusion:${uid()}`;

    const passive = {
      id: `fusion-passive:${uid()}`,
      name: `Fusion ${fusionName}`,
      effectTone: mergedTone,
      desc: "Ky nang hop the: ket hop toan bo nang luc cua hai the.",
      effects: mergedEffects,
      themeColor: blendHexColor(colorA, colorB),
      triggerKinds: this.getPassiveTriggerKinds(mergedEffects),
    };

    const archetypes = [...new Set([...(a.archetypes ?? []), ...(b.archetypes ?? [])])].slice(0, 6);

    return {
      uid: uid(),
      id: fusionId,
      name: fusionName,
      cost: clamp(Math.max(asNumber(a.cost, 1), asNumber(b.cost, 1)), 1, 5),
      faction: primary.faction ?? a.faction ?? "Fusion",
      archetypes,
      bio: `Don vi hop the gom ${sourceCount} the goc.`,
      imageUrl: primary.imageUrl ?? "",
      fusionImageUrl2: secondary.imageUrl ?? "",
      star,
      stats: { hp, atk, spd },
      passive,
      fusionMeta: {
        from: [...fromA, ...fromB].slice(0, 64),
        names: mergedSourceNames,
        sourceCount,
        atRound: this.state.round,
      },
    };
  }

  fusePick(zone, index) {
    if (!this.state.fusion.mode) {
      return { ok: false, reason: "Hay bat che do Hop the truoc." };
    }

    const slot = this.getFusionPickUnit(zone, index);
    if (!slot) return { ok: false, reason: "Chi co the hop the tuong tren Board/Bench." };

    const existing = this.state.fusion.picks.findIndex((x) => x.uid === slot.unit.uid);
    if (existing !== -1) {
      this.state.fusion.picks.splice(existing, 1);
      return { ok: true, reason: "Da bo chon 1 the hop the." };
    }

    this.state.fusion.picks.push({ zone: slot.zone, index: slot.index, uid: slot.unit.uid });
    if (this.state.fusion.picks.length < 2) {
      return { ok: true, reason: "Da chon the thu nhat. Chon tiep the thu hai." };
    }

    const [pickA, pickB] = this.state.fusion.picks;
    const slotA = this.getFusionPickUnit(pickA.zone, pickA.index);
    const slotB = this.getFusionPickUnit(pickB.zone, pickB.index);
    this.state.fusion.picks = [];

    if (!slotA || !slotB) {
      return { ok: false, reason: "The hop the da thay doi, hay chon lai." };
    }
    if (slotA.unit.uid !== pickA.uid || slotB.unit.uid !== pickB.uid) {
      return { ok: false, reason: "The da thay doi do thao tac khac. Hay chon lai 2 the hop the." };
    }
    if (slotA.unit.uid === slotB.unit.uid) {
      return { ok: false, reason: "Khong the hop the cung mot the." };
    }

    const fused = this.createFusionUnit(slotA, slotB);
    this.setUnitAt(slotA.zone, slotA.index, fused);
    this.setUnitAt(slotB.zone, slotB.index, null);

    const merged = this.autoMerge();
    return {
      ok: true,
      fused: true,
      merged,
      reason: `Hop the thanh cong: ${fused.name}`,
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
    const blocked = this.blockIfFusionMode("mua tuong");
    if (blocked) return blocked;

    const offer = this.state.shop[index];
    if (!offer) return { ok: false, reason: "O shop trong." };
    if (this.state.gold < offer.cost) return { ok: false, reason: "Khong du vang." };

    const benchIndex = this.findEmptyBenchIndex();
    if (benchIndex === -1) return { ok: false, reason: "Day hang du bi." };

    this.state.gold -= offer.cost;
    const base = this.charactersById.get(offer.id);
    if (!base) {
      this.state.shop[index] = null;
      return { ok: false, reason: "Du lieu tuong loi, hay lam moi shop." };
    }
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
          const base = this.charactersById.get(id);

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
    const blocked = this.blockIfFusionMode("doi vi tri tuong");
    if (blocked) return blocked;

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
    const blocked = this.blockIfFusionMode("doi vi tri tuong");
    if (blocked) return blocked;

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
    const blocked = this.blockIfFusionMode("doi vi tri du bi");
    if (blocked) return blocked;

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
    const blocked = this.blockIfFusionMode("doi vi tri tren san");
    if (blocked) return blocked;

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
    const blocked = this.blockIfFusionMode("ban tuong");
    if (blocked) return blocked;

    const unit = this.state.bench[index];
    if (!unit) return { ok: false, reason: "Khong co tuong de ban." };
    const gain = unit.cost * unit.star;
    this.state.gold += gain;
    this.state.bench[index] = null;
    return { ok: true, goldDelta: gain };
  }

  buyXp() {
    const blocked = this.blockIfFusionMode("mua EXP");
    if (blocked) return blocked;

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
      cost: unit.cost ?? 1,
      star: unit.star ?? 1,
      imageUrl: unit.imageUrl ?? "",
      fusionImageUrl2: unit.fusionImageUrl2 ?? "",
      bio: unit.bio ?? "",
      faction: unit.faction ?? "",
      archetypes: [...(unit.archetypes ?? [])],
      bossSkill: unit.bossSkill ?? null,
      passive: unit.passive ?? null,
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
      cost: f.cost,
      star: f.star,
      hp: f.hp,
      maxHp: f.maxHp,
      atk: f.atk,
      spd: f.spd,
      alive: f.alive,
      imageUrl: f.imageUrl,
      fusionImageUrl2: f.fusionImageUrl2 ?? "",
      bio: f.bio,
      faction: f.faction,
      archetypes: [...(f.archetypes ?? [])],
      bossSkill: f.bossSkill,
      passive: f.passive ?? null,
    };
  }

  createPassiveRuntime(fighter) {
    return {
      key: fighter.key,
      damageReductionPct: 0,
      damageOutPct: 0,
      damageTakenPctUp: 0,
      lifestealPct: 0,
      executeThresholdPct: 0,
      executeBonusPct: 0,
      onKillAtkPct: 0,
      onKillSpdPct: 0,
      onAttackWeakenPctDown: 0,
      onAttackMarkPctUp: 0,
      onHitThornsPct: 0,
      onHitGuardPct: 0,
      onHitHealPct: 0,
      extraHitChance: 0,
      extraHitPct: 0,
      periodicHealPct: 0,
      periodicHealInterval: 0,
    };
  }

  pushPassiveEvent(events, log, actor, passive, text) {
    const tone = passive?.effectTone ?? "mixed";
    const prefix = tone === "beneficial"
      ? "[BUFF] ✨"
      : tone === "harmful"
        ? "[DEBUFF] ☠️"
        : "[MIXED] 🌀";
    const line = `${prefix} ${text}`;
    log.push(line);
    events.push({
      type: "passive",
      actorKey: actor.key,
      text: line,
      tone,
    });
  }

  applyPassiveStartEffects(actor, ownTeam, enemyTeam, runtimeState, events, log, round) {
    const passive = actor.passive;
    if (!passive) return;
    const effects = passive.effects ?? {};
    const state = runtimeState.get(actor.key) ?? this.createPassiveRuntime(actor);
    const powerScale = this.passivePowerScale(actor.cost ?? 3, actor.star ?? 1, round);

    if (effects.selfAtkPct) {
      const pct = this.scalePassivePct(effects.selfAtkPct, powerScale, 0.32);
      actor.atk = Math.max(1, Math.round(actor.atk * (1 + pct)));
      this.pushPassiveEvent(events, log, actor, passive, `${actor.name} kich hoat ${passive.name}: +${Math.round(effects.selfAtkPct * 100)}% ATK.`);
    }

    if (effects.selfSpdPct) {
      const pct = this.scalePassivePct(effects.selfSpdPct, powerScale, 0.26);
      actor.spd = Number((actor.spd * (1 + pct)).toFixed(2));
      this.pushPassiveEvent(events, log, actor, passive, `${actor.name} co nhip tan cong nhanh hon.`);
    }

    if (effects.selfDmgReductionPct) {
      state.damageReductionPct += this.scalePassivePct(effects.selfDmgReductionPct, powerScale, 0.24);
      this.pushPassiveEvent(events, log, actor, passive, `${actor.name} giam sat thuong nhan vao.`);
    }

    if (effects.selfLifestealPct) {
      state.lifestealPct += this.scalePassivePct(effects.selfLifestealPct, powerScale, 0.3);
      this.pushPassiveEvent(events, log, actor, passive, `${actor.name} nhan hut mau tu don danh.`);
    }

    if (effects.selfShieldPct) {
      const pct = this.scalePassivePct(effects.selfShieldPct, powerScale, 0.24);
      const extra = Math.max(1, Math.round(actor.maxHp * pct));
      actor.maxHp += extra;
      actor.hp += extra;
      this.pushPassiveEvent(events, log, actor, passive, `${actor.name} tao mau ao +${extra}.`);
    }

    if (effects.teamAtkPct) {
      const pct = this.scalePassivePct(effects.teamAtkPct, powerScale * 0.85, 0.22);
      for (const unit of ownTeam) {
        unit.atk = Math.max(1, Math.round(unit.atk * (1 + pct)));
      }
      this.pushPassiveEvent(events, log, actor, passive, `${actor.name} tang ATK toan doi.`);
    }

    if (effects.teamSpdPct) {
      const pct = this.scalePassivePct(effects.teamSpdPct, powerScale * 0.85, 0.2);
      for (const unit of ownTeam) {
        unit.spd = Number((unit.spd * (1 + pct)).toFixed(2));
      }
      this.pushPassiveEvent(events, log, actor, passive, `${actor.name} tang SPD toan doi.`);
    }

    if (effects.teamShieldPct) {
      const pct = this.scalePassivePct(effects.teamShieldPct, powerScale * 0.85, 0.22);
      for (const unit of ownTeam) {
        const extra = Math.max(1, Math.round(unit.maxHp * pct));
        unit.maxHp += extra;
        unit.hp += extra;
      }
      this.pushPassiveEvent(events, log, actor, passive, `${actor.name} dat khien dau tran cho dong doi.`);
    }

    if (effects.teamDmgReductionPct) {
      const pct = this.scalePassivePct(effects.teamDmgReductionPct, powerScale * 0.85, 0.2);
      for (const unit of ownTeam) {
        const ownState = runtimeState.get(unit.key) ?? this.createPassiveRuntime(unit);
        ownState.damageReductionPct += pct;
        runtimeState.set(unit.key, ownState);
      }
      this.pushPassiveEvent(events, log, actor, passive, `${actor.name} giam sat thuong toan doi.`);
    }

    if (effects.enemyAtkPctDown) {
      const pct = this.scalePassivePct(effects.enemyAtkPctDown, powerScale, 0.24);
      for (const unit of enemyTeam) {
        unit.atk = Math.max(1, Math.round(unit.atk * (1 - pct)));
      }
      this.pushPassiveEvent(events, log, actor, passive, `${actor.name} lam giam sat thuong doi thu.`);
    }

    if (effects.enemySpdPctDown) {
      const pct = this.scalePassivePct(effects.enemySpdPctDown, powerScale, 0.24);
      for (const unit of enemyTeam) {
        unit.spd = Number((unit.spd * (1 - pct)).toFixed(2));
      }
      this.pushPassiveEvent(events, log, actor, passive, `${actor.name} lam cham doi hinh doi thu.`);
    }

    if (effects.enemyDmgTakenPctUp) {
      const pct = this.scalePassivePct(effects.enemyDmgTakenPctUp, powerScale, 0.22);
      for (const unit of enemyTeam) {
        const enemyState = runtimeState.get(unit.key) ?? this.createPassiveRuntime(unit);
        enemyState.damageTakenPctUp += pct;
        runtimeState.set(unit.key, enemyState);
      }
      this.pushPassiveEvent(events, log, actor, passive, `${actor.name} khien doi thu de bi sat thuong hon.`);
    }

    if (effects.executeThresholdPct) {
      const threshold = this.scalePassivePct(effects.executeThresholdPct, powerScale, 0.62);
      state.executeThresholdPct = Math.max(state.executeThresholdPct, threshold);
    }
    if (effects.executeBonusPct) {
      const bonus = this.scalePassivePct(effects.executeBonusPct, powerScale, 0.36);
      state.executeBonusPct = Math.max(state.executeBonusPct, bonus);
    }
    if (effects.onKillAtkPct) state.onKillAtkPct += this.scalePassivePct(effects.onKillAtkPct, powerScale, 0.18);
    if (effects.onKillSpdPct) state.onKillSpdPct += this.scalePassivePct(effects.onKillSpdPct, powerScale, 0.16);
    if (effects.onAttackWeakenPctDown) {
      state.onAttackWeakenPctDown += this.scalePassivePct(effects.onAttackWeakenPctDown, powerScale, 0.2);
    }
    if (effects.onAttackMarkPctUp) {
      state.onAttackMarkPctUp += this.scalePassivePct(effects.onAttackMarkPctUp, powerScale, 0.2);
    }
    if (effects.onHitThornsPct) {
      state.onHitThornsPct += this.scalePassivePct(effects.onHitThornsPct, powerScale, 0.3);
    }
    if (effects.onHitGuardPct) {
      state.onHitGuardPct += this.scalePassivePct(effects.onHitGuardPct, powerScale, 0.14);
    }
    if (effects.onHitHealPct) {
      state.onHitHealPct += this.scalePassivePct(effects.onHitHealPct, powerScale, 0.16);
    }
    if (effects.extraHitChance) {
      state.extraHitChance += this.scalePassiveChance(effects.extraHitChance, actor.cost ?? 3, round, 0.42);
    }
    if (effects.extraHitPct) state.extraHitPct += this.scalePassivePct(effects.extraHitPct, powerScale, 0.52);
    if (effects.periodicHealPct) {
      state.periodicHealPct = Math.max(state.periodicHealPct, this.scalePassivePct(effects.periodicHealPct, powerScale, 0.2));
    }
    if (effects.periodicHealInterval) {
      const interval = Math.max(1, Math.floor(asNumber(effects.periodicHealInterval, 0)));
      state.periodicHealInterval = state.periodicHealInterval > 0
        ? Math.min(state.periodicHealInterval, interval)
        : interval;
    }

    runtimeState.set(actor.key, state);
  }

  applyPeriodicHeal(actor, ownTeam, state, turn, events, log) {
    if (!state?.periodicHealPct || !state.periodicHealInterval) return;
    if (turn % state.periodicHealInterval !== 0) return;

    for (const ally of ownTeam) {
      if (!ally.alive) continue;
      const heal = Math.max(1, Math.round(ally.maxHp * state.periodicHealPct));
      ally.hp = Math.min(ally.maxHp, ally.hp + heal);
    }

    const passiveName = actor.passive?.name ?? "Healing Pulse";
    const text = `[BUFF] ✨ ${actor.name} kich hoat ${passiveName}: hoi phuc dong doi.`;
    log.push(text);
    events.push({
      type: "passive",
      actorKey: actor.key,
      text,
      tone: "beneficial",
    });
  }

  createBossUnit(boss, round) {
    const hpScale = 1 + round * 0.06;
    const atkScale = 1 + round * 0.03;
    const spdScale = 1 + round * 0.006;
    return {
      uid: uid(),
      id: boss.id,
      name: boss.name,
      cost: 6,
      faction: "Boss",
      archetypes: ["Boss"],
      bio: boss.bio,
      imageUrl: boss.imageUrl,
      star: 1,
      stats: {
        hp: Math.round(boss.base.hp * hpScale),
        atk: Math.round(boss.base.atk * atkScale),
        spd: Number((boss.base.spd * spdScale).toFixed(2)),
      },
      bossSkill: boss.skill,
    };
  }

  buildEnemyTeam(round) {
    const count = clamp(1 + Math.floor(round / 2), 1, this.boardSlots);
    const enemyLevel = clamp(Math.ceil(round / 3), 1, MAX_LEVEL);
    const boss = isBossRound(round);
    const list = [];
    let bossInfo = null;

    if (boss) {
      const picked = pickRandom(this.bosses);
      const bossUnit = this.createBossUnit(picked, round);
      list.push(bossUnit);
      bossInfo = {
        id: picked.id,
        name: picked.name,
        skill: picked.skill?.name ?? "",
        bio: picked.bio,
        imageUrl: picked.imageUrl,
      };
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
      bossInfo,
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
    const events = [];
    const bossCooldown = new Map();
    const passiveRuntime = new Map();

    const log = [];
    for (const fighter of [...allies, ...enemies]) {
      passiveRuntime.set(fighter.key, this.createPassiveRuntime(fighter));
    }

    for (const ally of allies) {
      this.applyPassiveStartEffects(ally, allies, enemies, passiveRuntime, events, log, round);
    }
    for (const enemy of enemies) {
      this.applyPassiveStartEffects(enemy, enemies, allies, passiveRuntime, events, log, round);
    }

    const startAllies = allies.map((f) => this.cloneFighter(f));
    const startEnemies = enemies.map((f) => this.cloneFighter(f));

    let turns = 0;

    while (this.pickAlive(allies).length > 0 && this.pickAlive(enemies).length > 0 && turns < 60) {
      turns += 1;
      const turnOrder = [...this.pickAlive(allies), ...this.pickAlive(enemies)].sort((a, b) => b.spd - a.spd);

      for (const actor of turnOrder) {
        if (!actor.alive) continue;
        const own = actor.side === "ally" ? allies : enemies;
        const opp = actor.side === "ally" ? enemies : allies;
        const actorState = passiveRuntime.get(actor.key) ?? this.createPassiveRuntime(actor);

        this.applyPeriodicHeal(actor, own, actorState, turns, events, log);

        if (this.pickAlive(opp).length === 0) break;

        if (actor.side === "enemy" && actor.bossSkill) {
          const interval = actor.bossSkill.interval ?? 3;
          if (!bossCooldown.has(actor.key)) {
            bossCooldown.set(actor.key, interval);
          }
          const tick = (bossCooldown.get(actor.key) ?? interval) - 1;
          bossCooldown.set(actor.key, tick);

          if (tick <= 0) {
            bossCooldown.set(actor.key, interval);
            log.push(`[SKILL] 🔥 ${actor.name} tung chieu ${actor.bossSkill.name}!`);
            events.push({
              type: "skill",
              actorKey: actor.key,
              text: `[SKILL] 🔥 ${actor.name} tung chieu ${actor.bossSkill.name}!`,
            });

            const aliveTargets = this.pickAlive(allies);
            if (aliveTargets.length > 0) {
              if (actor.bossSkill.type === "blast") {
                const primary = pickRandom(aliveTargets);
                const direct = Math.max(1, Math.round(actor.atk * actor.bossSkill.multiplier));
                primary.hp = Math.max(0, primary.hp - direct);
                primary.alive = primary.hp > 0;
                log.push(`${primary.name} trung no chinh -${direct}HP`);
                events.push({
                  type: "aoe-hit",
                  actorKey: actor.key,
                  targetKey: primary.key,
                  damage: direct,
                  hpAfter: primary.hp,
                  dead: !primary.alive,
                  text: `${primary.name} trung no chinh -${direct}HP`,
                });

                const splashTargets = aliveTargets.filter((x) => x.key !== primary.key).slice(0, 2);
                for (const target of splashTargets) {
                  const splash = Math.max(1, Math.round(direct * 0.45));
                  target.hp = Math.max(0, target.hp - splash);
                  target.alive = target.hp > 0;
                  log.push(`${target.name} trung sat thuong lan -${splash}HP`);
                  events.push({
                    type: "aoe-hit",
                    actorKey: actor.key,
                    targetKey: target.key,
                    damage: splash,
                    hpAfter: target.hp,
                    dead: !target.alive,
                    text: `${target.name} trung sat thuong lan -${splash}HP`,
                  });
                }
              } else {
                for (const target of aliveTargets) {
                  const aoeDamage = Math.max(1, Math.round(actor.atk * actor.bossSkill.multiplier));
                  target.hp = Math.max(0, target.hp - aoeDamage);
                  target.alive = target.hp > 0;
                  log.push(`${target.name} trung no rong -${aoeDamage}HP`);
                  events.push({
                    type: "aoe-hit",
                    actorKey: actor.key,
                    targetKey: target.key,
                    damage: aoeDamage,
                    hpAfter: target.hp,
                    dead: !target.alive,
                    text: `${target.name} trung no rong -${aoeDamage}HP`,
                  });
                }
              }

              for (const target of aliveTargets) {
                if (!target.alive) {
                  log.push(`${target.name} bi ha guc boi ky nang boss.`);
                  events.push({
                    type: "defeat",
                    actorKey: actor.key,
                    targetKey: target.key,
                    text: `${target.name} bi ha guc boi ky nang boss.`,
                  });
                }
              }

              if (this.pickAlive(allies).length === 0) break;
              continue;
            }
          }
        }

        const target = pickRandom(this.pickAlive(opp));
        const targetState = passiveRuntime.get(target.key) ?? this.createPassiveRuntime(target);
        const rng = 0.88 + Math.random() * 0.24;
        const hpRatio = target.maxHp > 0 ? target.hp / target.maxHp : 1;
        const executeBonus = hpRatio <= actorState.executeThresholdPct ? actorState.executeBonusPct : 0;
        const damageScale = 1 + actorState.damageOutPct + executeBonus + targetState.damageTakenPctUp;
        const damageReduction = clamp(targetState.damageReductionPct, 0, 0.8);
        const isCrit = Math.random() < 0.18;
        const critMult = isCrit ? 1.55 : 1;
        const damage = Math.max(1, Math.round(actor.atk * rng * damageScale * critMult * (1 - damageReduction)));
        const hitKind = isCrit ? "crit" : damageReduction >= 0.18 ? "shielded" : "normal";

        target.hp = Math.max(0, target.hp - damage);
        target.alive = target.hp > 0;

        const attackIcon = isCrit ? "💥" : "⚔️";
        log.push(`[ATK] ${attackIcon} ${actor.name} danh ${target.name} -${damage}HP`);
        events.push({
          type: "hit",
          actorKey: actor.key,
          actorName: actor.name,
          targetKey: target.key,
          targetName: target.name,
          damage,
          hpAfter: target.hp,
          dead: !target.alive,
          hitKind,
          text: `[ATK] ${attackIcon} ${actor.name} danh ${target.name} -${damage}HP`,
        });

        if (actorState.onAttackWeakenPctDown > 0 && target.alive) {
          const weakenPct = clamp(actorState.onAttackWeakenPctDown, 0, 0.3);
          target.atk = Math.max(1, Math.round(target.atk * (1 - weakenPct)));
          const weakenLine = `[DEBUFF] ☠️ ${target.name} bi suy yeu luc danh.`;
          log.push(weakenLine);
          events.push({
            type: "passive",
            actorKey: actor.key,
            text: weakenLine,
            tone: "harmful",
            badgeTargetKey: target.key,
            badgeText: "SUY YEU",
            badgeKind: "debuff",
          });
        }

        if (actorState.onAttackMarkPctUp > 0 && target.alive) {
          const markPct = clamp(actorState.onAttackMarkPctUp, 0, 0.3);
          targetState.damageTakenPctUp = clamp(targetState.damageTakenPctUp + markPct, 0, 0.8);
          const markLine = `[DEBUFF] ☠️ ${target.name} bi danh dau, de nhan them sat thuong.`;
          log.push(markLine);
          events.push({
            type: "passive",
            actorKey: actor.key,
            text: markLine,
            tone: "harmful",
            badgeTargetKey: target.key,
            badgeText: "DANH DAU",
            badgeKind: "debuff",
          });
        }

        if (targetState.onHitGuardPct > 0 && target.alive) {
          targetState.damageReductionPct = clamp(targetState.damageReductionPct + targetState.onHitGuardPct, 0, 0.8);
          const guardLine = `[BUFF] ✨ ${target.name} kich hoat thu the phong thu.`;
          log.push(guardLine);
          events.push({
            type: "passive",
            actorKey: target.key,
            text: guardLine,
            tone: "beneficial",
            badgeTargetKey: target.key,
            badgeText: "CHONG DO",
            badgeKind: "buff",
          });
        }

        if (targetState.onHitHealPct > 0 && target.alive) {
          const healBack = Math.max(1, Math.round(target.maxHp * targetState.onHitHealPct));
          target.hp = Math.min(target.maxHp, target.hp + healBack);
          const healLine = `[BUFF] ✨ ${target.name} phan ung hoi phuc +${healBack}HP`;
          log.push(healLine);
          events.push({
            type: "passive",
            actorKey: target.key,
            text: healLine,
            tone: "beneficial",
            badgeTargetKey: target.key,
            badgeText: "HOI PHUC",
            badgeKind: "buff",
          });
        }

        if (targetState.onHitThornsPct > 0 && target.alive && actor.alive) {
          const thornsDamage = Math.max(1, Math.round(damage * clamp(targetState.onHitThornsPct, 0, 0.35)));
          actor.hp = Math.max(0, actor.hp - thornsDamage);
          actor.alive = actor.hp > 0;
          const thornsText = `[ATK] 🛡️ ${target.name} phan don ${actor.name} -${thornsDamage}HP`;
          log.push(thornsText);
          events.push({
            type: "hit",
            actorKey: target.key,
            actorName: target.name,
            targetKey: actor.key,
            targetName: actor.name,
            damage: thornsDamage,
            hpAfter: actor.hp,
            dead: !actor.alive,
            hitKind: "reflect",
            text: thornsText,
          });

          events.push({
            type: "passive",
            actorKey: target.key,
            text: `[BUFF] ✨ ${target.name} kich hoat phan don manh.`,
            tone: "mixed",
            badgeTargetKey: target.key,
            badgeText: "PHAN DON",
            badgeKind: "mixed",
          });

          if (!actor.alive) {
            const reflectDefeat = `${actor.name} bi ha guc boi phan don.`;
            log.push(reflectDefeat);
            events.push({
              type: "defeat",
              actorKey: target.key,
              targetKey: actor.key,
              text: reflectDefeat,
            });
          }
        }

        passiveRuntime.set(target.key, targetState);
        passiveRuntime.set(actor.key, actorState);

        if (actorState.lifestealPct > 0) {
          const heal = Math.max(1, Math.round(damage * actorState.lifestealPct));
          actor.hp = Math.min(actor.maxHp, actor.hp + heal);
          const lifestealLine = `[BUFF] ✨ ${actor.name} hut mau +${heal}HP`;
          log.push(lifestealLine);
          events.push({
            type: "passive",
            actorKey: actor.key,
            text: lifestealLine,
            tone: "beneficial",
            badgeTargetKey: actor.key,
            badgeText: "HUT MAU",
            badgeKind: "buff",
          });
        }

        if (actorState.extraHitChance > 0 && actorState.extraHitPct > 0 && target.alive) {
          if (Math.random() < actorState.extraHitChance) {
            const extraDamage = Math.max(1, Math.round(damage * actorState.extraHitPct));
            target.hp = Math.max(0, target.hp - extraDamage);
            target.alive = target.hp > 0;
            log.push(`[ATK] ⚔️ ${actor.name} kich noi don -${extraDamage}HP vao ${target.name}`);
            events.push({
              type: "hit",
              actorKey: actor.key,
              actorName: actor.name,
              targetKey: target.key,
              targetName: target.name,
              damage: extraDamage,
              hpAfter: target.hp,
              dead: !target.alive,
              hitKind: "normal",
              text: `[ATK] ⚔️ ${actor.name} kich noi don -${extraDamage}HP vao ${target.name}`,
            });
          }
        }

        if (!target.alive) {
          log.push(`${target.name} bi ha guc.`);
          events.push({
            type: "defeat",
            actorKey: actor.key,
            targetKey: target.key,
            text: `${target.name} bi ha guc.`,
          });

          if (actorState.onKillAtkPct > 0 || actorState.onKillSpdPct > 0) {
            if (actorState.onKillAtkPct > 0) {
              actor.atk = Math.max(1, Math.round(actor.atk * (1 + actorState.onKillAtkPct)));
            }
            if (actorState.onKillSpdPct > 0) {
              actor.spd = Number((actor.spd * (1 + actorState.onKillSpdPct)).toFixed(2));
            }

            const frenzyLine = `[BUFF] ✨ ${actor.name} duoc cuong hoa sau khi ket lieu.`;
            log.push(frenzyLine);
            events.push({
              type: "passive",
              actorKey: actor.key,
              text: frenzyLine,
              tone: "beneficial",
            });
          }
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
      bossInfo: enemyBuild.bossInfo,
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
    const blocked = this.blockIfFusionMode("qua vong");
    if (blocked) return blocked;

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
      this.state.shopLockTargetRound = null;
    } else {
      this.state.shopLockTargetRound = this.state.round + 1;
    }

    return {
      ok: true,
      win: combatResult.win,
      income,
      round: currentRound,
      boss: combatResult.boss,
      bossName: combatResult.bossName,
      bossInfo: this.state.combat.bossInfo,
    };
  }
}
