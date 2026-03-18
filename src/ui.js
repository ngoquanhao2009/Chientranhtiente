function el(id) {
  return document.getElementById(id);
}

function starText(star) {
  return "★".repeat(star);
}

function unitTagHtml(unit) {
  const tags = [unit.faction, ...(unit.archetypes ?? [])].filter(Boolean);
  return `<span class="chip">${tags.join(" • ")}</span>`;
}

function unitInitials(name = "?") {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function cardPortraitHtml(unit) {
  const initials = unitInitials(unit.name);
  const imageUrl = unit.imageUrl ? String(unit.imageUrl).trim() : "";

  if (!imageUrl) {
    return `<div class="cardPortrait fallback"><span>${initials}</span></div>`;
  }

  return `
    <div class="cardPortrait">
      <img src="${imageUrl}" alt="${unit.name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('fallback'); this.remove();" />
      <span>${initials}</span>
    </div>
  `;
}

function fxFloatText(container, text, type = "good") {
  if (!container) return;
  const node = document.createElement("div");
  node.className = `fx-float ${type}`;
  node.textContent = text;
  container.appendChild(node);
  setTimeout(() => node.remove(), 950);
}

function fxDeny(node) {
  if (!node) return;
  node.classList.remove("shake");
  void node.offsetWidth;
  node.classList.add("shake");
}

function addPop(node) {
  if (!node) return;
  node.classList.add("pop");
  setTimeout(() => node.classList.remove("pop"), 240);
}

function showRoundBanner(text, type = "") {
  const banner = el("roundBanner");
  if (!banner) return;
  banner.textContent = text;
  banner.className = `roundBanner show ${type}`.trim();
  setTimeout(() => {
    banner.classList.remove("show", "win", "lose", "boss");
  }, 1800);
}

let activePlaybackId = null;
let playbackToken = 0;
let suppressClickUntil = 0;
let isMouseDragging = false;
const INSPECT_DELAY_MS = 3000;
let inspectToastTimer = null;

function closestFromTarget(target, selector) {
  if (target instanceof Element) return target.closest(selector);
  if (target && target.parentElement instanceof Element) {
    return target.parentElement.closest(selector);
  }
  return null;
}

export function bindUI(game, handlers) {
  el("btnNew").addEventListener("click", handlers.onNew);
  el("btnSave").addEventListener("click", handlers.onSave);
  el("btnLoad").addEventListener("click", handlers.onLoad);
  el("btnRefresh").addEventListener("click", handlers.onRefresh);
  el("btnBuyXp").addEventListener("click", handlers.onBuyXp);
  el("btnNextRound").addEventListener("click", handlers.onNextRound);
  el("btnLockShop").addEventListener("click", handlers.onLockShop);

  const shop = el("shop");
  const bench = el("bench");
  const board = el("board");

  let inspectTimer = null;
  let inspectKey = "";
  let lastShopBuyAt = 0;
  let lastShopBuyIndex = -1;

  function clearInspectTimer() {
    if (!inspectTimer) return;
    clearTimeout(inspectTimer);
    inspectTimer = null;
  }

  function queueInspect(where, index) {
    const key = `${where}:${index}`;
    if (inspectKey === key && inspectTimer) return;
    inspectKey = key;
    clearInspectTimer();
    inspectTimer = setTimeout(() => {
      handlers.onInspect(where, index);
      renderInspect(game);
      inspectTimer = null;
    }, INSPECT_DELAY_MS);
  }

  function cancelInspect() {
    inspectKey = "";
    clearInspectTimer();
  }

  function tryBuyFromShopEvent(target, now = Date.now()) {
    const card = closestFromTarget(target, "[data-shop-index]");
    if (!card) return false;
    const index = Number(card.dataset.shopIndex);
    if (Number.isNaN(index)) return false;
    if (index === lastShopBuyIndex && now - lastShopBuyAt < 260) return true;
    lastShopBuyIndex = index;
    lastShopBuyAt = now;
    handlers.onBuyShop(index);
    return true;
  }

  shop.addEventListener("click", (ev) => {
    cancelInspect();
    if (Date.now() < suppressClickUntil) return;
    tryBuyFromShopEvent(ev.target, Date.now());
  });

  shop.addEventListener("pointerup", (ev) => {
    cancelInspect();
    if (ev.button !== undefined && ev.button !== 0) return;
    suppressClickUntil = Date.now() + 260;
    tryBuyFromShopEvent(ev.target, Date.now());
  });

  shop.addEventListener("mouseover", (ev) => {
    const card = closestFromTarget(ev.target, "[data-shop-index]");
    if (!card) return;
    queueInspect("shop", Number(card.dataset.shopIndex));
  });

  shop.addEventListener("mouseout", (ev) => {
    const card = closestFromTarget(ev.target, "[data-shop-index]");
    if (!card) return;
    const related = ev.relatedTarget;
    const stillInside = related instanceof Node && card.contains(related);
    if (!stillInside) cancelInspect();
  });

  bench.addEventListener("click", (ev) => {
    cancelInspect();
    if (Date.now() < suppressClickUntil) return;
    const card = closestFromTarget(ev.target, "[data-bench-index]");
    if (!card) return;
    handlers.onSellBench(Number(card.dataset.benchIndex));
  });

  bench.addEventListener("mouseover", (ev) => {
    const card = closestFromTarget(ev.target, "[data-bench-index]");
    if (!card) return;
    queueInspect("bench", Number(card.dataset.benchIndex));
  });

  bench.addEventListener("mouseout", (ev) => {
    const card = closestFromTarget(ev.target, "[data-bench-index]");
    if (!card) return;
    const related = ev.relatedTarget;
    const stillInside = related instanceof Node && card.contains(related);
    if (!stillInside) cancelInspect();
  });

  function dragStart(ev) {
    const target = ev.target;
    const card = closestFromTarget(target, "[data-drag-kind]");
    if (!card) return;
    cancelInspect();
    isMouseDragging = true;
    suppressClickUntil = Date.now() + 300;
    const kind = card.dataset.dragKind;
    const index = card.dataset.dragIndex;
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", `${kind}:${index}`);
      ev.dataTransfer.setData("text/cttt", `${kind}:${index}`);
    }
    card.classList.add("dragging");
  }

  function dragEnd(ev) {
    const target = ev.target;
    const card = closestFromTarget(target, "[data-drag-kind]");
    if (!card) return;
    card.classList.remove("dragging");
    isMouseDragging = false;
    suppressClickUntil = Date.now() + 220;
  }

  function onDragOver(ev) {
    const target = ev.target;
    const drop = closestFromTarget(target, "[data-drop-kind]");
    if (!drop) return;
    ev.preventDefault();
    drop.classList.add("dropTarget");
  }

  function onDragLeave(ev) {
    const target = ev.target;
    const drop = closestFromTarget(target, "[data-drop-kind]");
    if (!drop) return;
    drop.classList.remove("dropTarget");
  }

  function onDrop(ev) {
    const target = ev.target;
    const drop = closestFromTarget(target, "[data-drop-kind]");
    if (!drop) return;
    ev.preventDefault();
    drop.classList.remove("dropTarget");
    suppressClickUntil = Date.now() + 260;
    cancelInspect();

    const raw = ev.dataTransfer?.getData("text/plain") || ev.dataTransfer?.getData("text/cttt") || "";
    if (!raw || !raw.includes(":")) return;

    const [fromKind, fromIndexText] = raw.split(":");
    const toKind = drop.dataset.dropKind;
    const toIndex = Number(drop.dataset.dropIndex);
    const fromIndex = Number(fromIndexText);

    handlers.onDrop(fromKind, fromIndex, toKind, toIndex);
  }

  let touchSession = null;

  function clearDropTargets() {
    document.querySelectorAll(".dropTarget").forEach((node) => node.classList.remove("dropTarget"));
  }

  function touchStart(ev) {
    const card = closestFromTarget(ev.target, "[data-drag-kind]");
    if (!card) return;
    if (!ev.touches || ev.touches.length === 0) return;
    cancelInspect();

    const touch = ev.touches[0];
    const kind = card.dataset.dragKind;
    const index = Number(card.dataset.dragIndex);
    const label = card.querySelector("b")?.textContent ?? "Unit";

    const ghost = document.createElement("div");
    ghost.className = "touchGhost";
    ghost.textContent = label;
    document.body.appendChild(ghost);

    card.classList.add("dragging");
    touchSession = {
      kind,
      index,
      source: card,
      ghost,
      moved: false,
      hoverDrop: null,
    };

    ghost.style.left = `${touch.clientX}px`;
    ghost.style.top = `${touch.clientY}px`;
  }

  function touchMove(ev) {
    if (!touchSession || !ev.touches || ev.touches.length === 0) return;
    const touch = ev.touches[0];
    touchSession.moved = true;
    suppressClickUntil = Date.now() + 350;
    ev.preventDefault();

    touchSession.ghost.style.left = `${touch.clientX}px`;
    touchSession.ghost.style.top = `${touch.clientY}px`;

    clearDropTargets();
    const targetNode = document.elementFromPoint(touch.clientX, touch.clientY);
    const drop = targetNode?.closest?.("[data-drop-kind]") ?? null;
    if (drop) {
      drop.classList.add("dropTarget");
      touchSession.hoverDrop = drop;
    } else {
      touchSession.hoverDrop = null;
    }
  }

  function touchEnd() {
    if (!touchSession) return;

    clearDropTargets();
    touchSession.source.classList.remove("dragging");
    touchSession.ghost.remove();

    if (touchSession.moved && touchSession.hoverDrop) {
      const toKind = touchSession.hoverDrop.dataset.dropKind;
      const toIndex = Number(touchSession.hoverDrop.dataset.dropIndex);
      handlers.onDrop(touchSession.kind, touchSession.index, toKind, toIndex);
    }

    touchSession = null;
  }

  board.addEventListener("dragstart", dragStart);
  board.addEventListener("dragend", dragEnd);
  board.addEventListener("dragover", onDragOver);
  board.addEventListener("dragleave", onDragLeave);
  board.addEventListener("drop", onDrop);
  board.addEventListener("touchstart", touchStart, { passive: true });
  board.addEventListener("touchmove", touchMove, { passive: false });
  board.addEventListener("touchend", touchEnd, { passive: true });
  board.addEventListener("touchcancel", touchEnd, { passive: true });

  bench.addEventListener("dragstart", dragStart);
  bench.addEventListener("dragend", dragEnd);
  bench.addEventListener("dragover", onDragOver);
  bench.addEventListener("dragleave", onDragLeave);
  bench.addEventListener("drop", onDrop);
  bench.addEventListener("touchstart", touchStart, { passive: true });
  bench.addEventListener("touchmove", touchMove, { passive: false });
  bench.addEventListener("touchend", touchEnd, { passive: true });
  bench.addEventListener("touchcancel", touchEnd, { passive: true });

  board.addEventListener("click", (ev) => {
    cancelInspect();
    if (isMouseDragging || Date.now() < suppressClickUntil) return;
    const card = closestFromTarget(ev.target, "[data-board-index]");
    if (!card) return;
    handlers.onBoardToBench(Number(card.dataset.boardIndex));
  });

  board.addEventListener("mouseover", (ev) => {
    const card = closestFromTarget(ev.target, "[data-board-index]");
    if (!card) return;
    queueInspect("board", Number(card.dataset.boardIndex));
  });

  board.addEventListener("mouseout", (ev) => {
    const card = closestFromTarget(ev.target, "[data-board-index]");
    if (!card) return;
    const related = ev.relatedTarget;
    const stillInside = related instanceof Node && card.contains(related);
    if (!stillInside) cancelInspect();
  });
}

function renderHud(game) {
  const hud = el("hud");
  const xpPart = game.canLevel
    ? `${game.state.xp}/${game.xpToNext}`
    : "MAX";

  hud.innerHTML = `
    <div class="stat"><span>Vang</span><b>${game.state.gold}</b></div>
    <div class="stat"><span>Vong</span><b>${game.state.round}</b></div>
    <div class="stat"><span>Cap</span><b>${game.state.level}</b></div>
    <div class="stat"><span>EXP</span><b>${xpPart}</b></div>
    <div class="stat"><span>Mau</span><b>${game.state.playerHp}</b></div>
    <div class="stat"><span>Streak</span><b>${game.state.streak}</b></div>
  `;
}

function renderBoard(game) {
  const board = el("board");
  board.innerHTML = "";

  for (let i = 0; i < game.state.board.length; i += 1) {
    const unit = game.state.board[i];
    const active = i < game.boardSlots;
    const slot = document.createElement("div");
    slot.className = `slot ${active ? "" : "disabled"}`;
    slot.dataset.dropKind = "board";
    slot.dataset.dropIndex = String(i);

    if (!active) {
      slot.innerHTML = `<span class="slotHint">Mo o cap ${i + 1}</span>`;
    } else if (!unit) {
      slot.innerHTML = `<span class="slotHint">Trong</span>`;
    } else {
      slot.dataset.boardIndex = String(i);
      slot.innerHTML = `
        <div class="card boardCard glow" data-board-index="${i}" draggable="true" data-drag-kind="board" data-drag-index="${i}">
          ${cardPortraitHtml(unit)}
          <div class="cardTop">
            <b>${unit.name}</b>
            <span class="cost c${unit.cost}">${unit.cost}</span>
          </div>
          <div class="cardMid">${starText(unit.star)}</div>
          <div class="cardTags">${unitTagHtml(unit)}</div>
        </div>
      `;
    }

    board.appendChild(slot);
  }
}

function renderBench(game) {
  const bench = el("bench");
  bench.innerHTML = "";

  for (let i = 0; i < game.state.bench.length; i += 1) {
    const unit = game.state.bench[i];
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.dataset.dropKind = "bench";
    slot.dataset.dropIndex = String(i);

    if (!unit) {
      slot.innerHTML = `<span class="slotHint">Trong</span>`;
    } else {
      slot.dataset.benchIndex = String(i);
      slot.innerHTML = `
        <div class="card benchCard" data-bench-index="${i}" draggable="true" data-drag-kind="bench" data-drag-index="${i}">
          ${cardPortraitHtml(unit)}
          <div class="cardTop">
            <b>${unit.name}</b>
            <span class="cost c${unit.cost}">${unit.cost}</span>
          </div>
          <div class="cardMid">${starText(unit.star)}</div>
          <div class="cardTags">${unitTagHtml(unit)}</div>
        </div>
      `;
    }

    bench.appendChild(slot);
  }
}

function renderShop(game) {
  const shop = el("shop");
  shop.innerHTML = "";

  for (let i = 0; i < game.state.shop.length; i += 1) {
    const unit = game.state.shop[i];
    const card = document.createElement("button");
    card.type = "button";
    card.className = `shopCard ${unit ? "" : "empty"}`;
    card.dataset.shopIndex = String(i);

    if (!unit) {
      card.innerHTML = `<span class="slotHint">Da mua</span>`;
    } else {
      card.innerHTML = `
        ${cardPortraitHtml(unit)}
        <div class="cardTop">
          <b>${unit.name}</b>
          <span class="cost c${unit.cost}">${unit.cost}</span>
        </div>
        <div class="cardTags">${unitTagHtml(unit)}</div>
      `;
    }

    shop.appendChild(card);
  }

  const lockBtn = el("btnLockShop");
  lockBtn.classList.toggle("active", game.state.lockedShop);
  lockBtn.textContent = game.state.lockedShop ? "Dang khoa" : "Khoa Shop";
}

function renderTraits(game) {
  const root = el("traits");
  root.innerHTML = "";

  const groups = game.getSynergyOverview();
  const entries = [
    { title: "Phe phai", rows: groups.factions },
    { title: "Toc he", rows: groups.archetypes },
  ];

  for (const g of entries) {
    const visibleRows = g.rows.filter((row) => row.count > 0);
    if (visibleRows.length === 0) continue;

    const title = document.createElement("div");
    title.className = "traitGroupTitle";
    title.textContent = g.title;
    root.appendChild(title);

    for (const row of visibleRows) {
      const node = document.createElement("div");
      node.className = `trait ${row.activeTier ? "active" : ""}`;

      const tiers = row.tiers
        .map((t) => `${t.need}: ${t.label}`)
        .join(" | ");

      node.innerHTML = `
        <div class="traitTop">
          <b>${row.name}</b>
          <span>${row.count}</span>
        </div>
        <div class="traitDesc">${row.desc}</div>
        <div class="traitTier">${tiers}</div>
      `;
      root.appendChild(node);
    }
  }
}

function renderInspect(game) {
  const info = game.state.inspect ?? {
    title: "Chua chon",
    tags: ["Toc he"],
  };

  const meta = (info.tags ?? []).filter(Boolean).join(" • ") || "Toc he";

  let toast = el("inspectToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "inspectToast";
    toast.className = "inspectToast";
    document.body.appendChild(toast);
  }

  toast.innerHTML = `
    <div class="inspectToastName">${info.title}</div>
    <div class="inspectToastMeta">${meta}</div>
  `;
  toast.classList.add("show");

  if (inspectToastTimer) clearTimeout(inspectToastTimer);
  inspectToastTimer = setTimeout(() => {
    const node = el("inspectToast");
    if (node) node.classList.remove("show");
  }, 1600);
}

function fighterHtml(f) {
  return fighterHtmlWithState(f, f.hp, f.alive, "", "");
}

function fighterHtmlWithState(f, hp, alive, flashActorKey, flashTargetKey) {
  const actorFlash = f.key === flashActorKey ? " actorFlash" : "";
  const targetFlash = f.key === flashTargetKey ? " targetFlash" : "";
  const currentHp = hp ?? f.hp;
  const effectiveAlive = alive ?? f.alive;
  const effectivePct = f.maxHp === 0 ? 0 : Math.round((currentHp / f.maxHp) * 100);
  const imageUrl = f.imageUrl ? String(f.imageUrl).trim() : "";
  const initials = unitInitials(f.name);
  return `
    <div class="fighter ${effectiveAlive ? "" : "dead"}${actorFlash}${targetFlash}">
      <div class="fighterBody">
        <div class="fighterPortrait ${imageUrl ? "" : "fallback"}">
          ${imageUrl ? `<img src="${imageUrl}" alt="${f.name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('fallback'); this.remove();" />` : ""}
          <span>${initials}</span>
        </div>
        <div class="fighterInfo">
          <div class="fighterTop">
            <span>${f.name}</span>
            <small>${currentHp}/${f.maxHp}</small>
          </div>
        </div>
      </div>
      <div class="hpTrack"><div class="hpFill" style="width:${effectivePct}%"></div></div>
    </div>
  `;
}

function cloneLineup(list) {
  return list.map((f) => ({
    key: f.key,
    name: f.name,
    imageUrl: f.imageUrl ?? "",
    maxHp: f.maxHp,
    hp: f.hp,
    alive: f.alive,
  }));
}

function renderPlaybackFrame(view, flashActorKey = "", flashTargetKey = "") {
  const allies = el("combatAllies");
  const enemies = el("combatEnemies");
  const log = el("combatLog");

  allies.innerHTML = view.allies
    .map((f) => fighterHtmlWithState(f, f.hp, f.alive, flashActorKey, flashTargetKey))
    .join("");
  enemies.innerHTML = view.enemies
    .map((f) => fighterHtmlWithState(f, f.hp, f.alive, flashActorKey, flashTargetKey))
    .join("");
  log.innerHTML = view.logs.map((line, idx) => `<div class="${idx === 0 ? "combatTitle" : ""}">${line}</div>`).join("");
}

function applyCombatEvent(view, event) {
  if (!event) return;

  if (event.type === "skill") {
    view.logs.push(event.text);
    return;
  }

  if (event.type === "hit" || event.type === "aoe-hit") {
    const findTarget = (list) => list.find((x) => x.key === event.targetKey);
    const target = findTarget(view.allies) ?? findTarget(view.enemies);
    if (target) {
      target.hp = Math.max(0, event.hpAfter);
      target.alive = !event.dead;
    }
    view.logs.push(event.text);
    return;
  }

  if (event.type === "defeat") {
    view.logs.push(event.text);
  }
}

function playCombatAnimation(combat) {
  const title = combat.title || "Combat";
  const startAllies = combat.startAllies?.length ? combat.startAllies : combat.allies;
  const startEnemies = combat.startEnemies?.length ? combat.startEnemies : combat.enemies;
  const events = combat.events ?? [];

  const view = {
    allies: cloneLineup(startAllies),
    enemies: cloneLineup(startEnemies),
    logs: [title],
  };

  const token = ++playbackToken;
  renderPlaybackFrame(view);

  if (events.length === 0) {
    for (const line of combat.log ?? []) view.logs.push(line);
    renderPlaybackFrame(view);
    return;
  }

  let idx = 0;
  const step = () => {
    if (token !== playbackToken) return;
    if (idx >= events.length) {
      if (combat.log && combat.log[0]) {
        view.logs.unshift(combat.log[0]);
        renderPlaybackFrame(view);
      }
      return;
    }

    const event = events[idx];
    idx += 1;

    applyCombatEvent(view, event);
    renderPlaybackFrame(view, event.actorKey ?? "", event.targetKey ?? "");

    const delay = event.type === "defeat" ? 140 : 220;
    setTimeout(step, delay);
  };

  setTimeout(step, 120);
}

function renderCombat(game) {
  const result = el("combatResult");
  const combat = game.state.combat;

  result.textContent = combat.result || "";
  result.className = `combatResult ${combat.result === "WIN" ? "win" : "lose"}`;
  if ((combat.title ?? "").includes("Boss")) {
    result.classList.add("boss");
  }

  if (activePlaybackId !== combat.playbackId) {
    activePlaybackId = combat.playbackId;
    playCombatAnimation(combat);
  }
}

export function renderAll(game) {
  renderHud(game);
  renderBoard(game);
  renderBench(game);
  renderShop(game);
  renderTraits(game);
  renderCombat(game);
}

export function feedback(result) {
  const stage = el("fxStage");

  if (!result) return;
  if (!result.ok) {
    fxDeny(document.body);
    fxFloatText(stage, result.reason ?? "Khong the thuc hien", "bad");
    return;
  }

  if (typeof result.goldDelta === "number" && result.goldDelta !== 0) {
    const txt = result.goldDelta > 0 ? `+${result.goldDelta} vang` : `${result.goldDelta} vang`;
    fxFloatText(stage, txt, result.goldDelta > 0 ? "good" : "bad");
  }

  if (result.merged) {
    fxFloatText(stage, "Len sao thanh cong", "good");
  }

  if (result.income) {
    const b = result.income;
    const bossPart = b.bossBonus ? ` + boss ${b.bossBonus}` : "";
    fxFloatText(stage, `+${b.total} vang (base ${b.base} + lai ${b.interest} + streak ${b.streak}${bossPart})`, "good");
  }

  if (typeof result.round === "number") {
    const bossText = result.boss ? ` - Boss ${result.bossName}` : "";
    const outcome = result.win ? "THANG" : "THUA";
    const bannerType = `${result.win ? "win" : "lose"} ${result.boss ? "boss" : ""}`;
    showRoundBanner(`Round ${result.round} ${outcome}${bossText}`, bannerType);
  }

  addPop(stage);
}
