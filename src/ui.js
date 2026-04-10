function el(id) {
  return document.getElementById(id);
}

function starText(star) {
  return "★".repeat(star);
}

function unitTagHtml(game, unit) {
  const tags = game.getUnitDisplayTags(unit);
  return `<span class="chip">${tags.join(" • ")}</span>`;
}

function passiveToneClass(tone) {
  if (tone === "beneficial") return "beneficial";
  if (tone === "harmful") return "harmful";
  return "mixed";
}

function passiveBadgeHtml(unit) {
  const passive = unit?.passive;
  if (!passive) return "";
  const tone = passiveToneClass(passive.effectTone);
  const style = passive.themeColor ? `style="--skill-theme:${passive.themeColor}"` : "";
  return `<span class="skillBadge ${tone}" ${style} title="${passive.desc ?? ""}">${passive.name}</span>`;
}

function passiveTriggerIconsHtml(unit) {
  const kinds = unit?.passive?.triggerKinds ?? [];
  if (kinds.length === 0) return "";
  return `<span class="triggerRow">${kinds
    .map((kind) => {
      const icon = kind === "ATK" ? "⚔️" : kind === "HIT" ? "🛡️" : "✨";
      return `<span class="triggerIcon" title="${kind}">${displayText(icon)} ${kind}</span>`;
    })
    .join("")}</span>`;
}

function unitInitials(name = "?") {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function withCacheBust(url, seed = 1) {
  if (!url) return "";
  const token = `cttt_retry=${Date.now()}_${seed}`;
  return url.includes("?") ? `${url}&${token}` : `${url}?${token}`;
}

function onPortraitImgError(img) {
  if (!img || typeof img !== "object") return;

  const baseSrc = img.dataset.baseSrc || img.getAttribute("src") || "";
  const retries = Number(img.dataset.retries ?? "0");

  if (baseSrc && retries < 2) {
    const next = retries + 1;
    img.dataset.retries = String(next);
    img.src = withCacheBust(baseSrc, next);
    return;
  }

  const parent = img.parentElement;
  if (parent) parent.classList.add("fallback");
  img.remove();
}

if (typeof window !== "undefined" && !window.__ctttPortraitImgError) {
  window.__ctttPortraitImgError = onPortraitImgError;
}

function cardPortraitHtml(unit) {
  const initials = unitInitials(unit.name);
  const imageUrl = unit.imageUrl ? String(unit.imageUrl).trim() : "";
  const fusionImageUrl2 = unit.fusionImageUrl2 ? String(unit.fusionImageUrl2).trim() : "";

  if (fusionImageUrl2) {
    const left = imageUrl || fusionImageUrl2;
    const right = fusionImageUrl2 || imageUrl;
    return `
      <div class="cardPortrait fusion ${left || right ? "" : "fallback"}">
        ${left ? `<img class="split left" src="${left}" data-base-src="${left}" data-retries="0" alt="${unit.name}" loading="lazy" referrerpolicy="no-referrer" onerror="window.__ctttPortraitImgError && window.__ctttPortraitImgError(this)" />` : ""}
        ${right ? `<img class="split right" src="${right}" data-base-src="${right}" data-retries="0" alt="${unit.name}" loading="lazy" referrerpolicy="no-referrer" onerror="window.__ctttPortraitImgError && window.__ctttPortraitImgError(this)" />` : ""}
        <span>${initials}</span>
      </div>
    `;
  }

  if (!imageUrl) {
    return `<div class="cardPortrait fallback"><span>${initials}</span></div>`;
  }

  return `
    <div class="cardPortrait">
      <img src="${imageUrl}" data-base-src="${imageUrl}" data-retries="0" alt="${unit.name}" loading="lazy" referrerpolicy="no-referrer" onerror="window.__ctttPortraitImgError && window.__ctttPortraitImgError(this)" />
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
let emojiEnabled = true;

function stripEmoji(text) {
  return String(text)
    .replace(/[\u2600-\u27BF]/g, "")
    .replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function displayText(text) {
  return emojiEnabled ? text : stripEmoji(text);
}

function isFusionSelected(game, unit) {
  if (!unit?.uid) return false;
  const picks = game.state.fusion?.picks ?? [];
  return picks.some((x) => x.uid === unit.uid);
}

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
  el("btnFuse")?.addEventListener("click", handlers.onFuseToggle);
  const emojiToggle = el("settingEmoji");
  if (emojiToggle) {
    emojiToggle.checked = game.state.settings?.showEmoji !== false;
    emojiToggle.addEventListener("change", () => {
      handlers.onToggleEmoji?.(emojiToggle.checked);
    });
  }

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
    if (game.state.fusion?.mode) {
      handlers.onFusePick?.("bench", Number(card.dataset.benchIndex));
      return;
    }
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
    if (game.state.fusion?.mode) {
      handlers.onFusePick?.("board", Number(card.dataset.boardIndex));
      return;
    }
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
      const selectedClass = isFusionSelected(game, unit) ? " fusionSelected" : "";
      slot.innerHTML = `
        <div class="card boardCard glow${selectedClass}" data-board-index="${i}" draggable="true" data-drag-kind="board" data-drag-index="${i}">
          ${cardPortraitHtml(unit)}
          <div class="cardTop">
            <b>${unit.name}</b>
            <span class="cost c${unit.cost}">${unit.cost}</span>
          </div>
          <div class="cardMid">${starText(unit.star)}</div>
          <div class="cardTags">${unitTagHtml(game, unit)}</div>
          <div class="cardPassive">${passiveBadgeHtml(unit)}</div>
          <div class="cardTriggers">${passiveTriggerIconsHtml(unit)}</div>
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
      const selectedClass = isFusionSelected(game, unit) ? " fusionSelected" : "";
      slot.innerHTML = `
        <div class="card benchCard${selectedClass}" data-bench-index="${i}" draggable="true" data-drag-kind="bench" data-drag-index="${i}">
          ${cardPortraitHtml(unit)}
          <div class="cardTop">
            <b>${unit.name}</b>
            <span class="cost c${unit.cost}">${unit.cost}</span>
          </div>
          <div class="cardMid">${starText(unit.star)}</div>
          <div class="cardTags">${unitTagHtml(game, unit)}</div>
          <div class="cardPassive">${passiveBadgeHtml(unit)}</div>
          <div class="cardTriggers">${passiveTriggerIconsHtml(unit)}</div>
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
        <div class="cardTags">${unitTagHtml(game, unit)}</div>
        <div class="cardPassive">${passiveBadgeHtml(unit)}</div>
        <div class="cardTriggers">${passiveTriggerIconsHtml(unit)}</div>
      `;
    }

    shop.appendChild(card);
  }

  const lockBtn = el("btnLockShop");
  const fuseBtn = el("btnFuse");
  const lockHint = el("lockHint");
  const targetRound = game.getShopLockTargetRound?.() ?? game.state.round + 1;
  lockBtn.classList.toggle("active", game.state.lockedShop);
  lockBtn.textContent = game.state.lockedShop
    ? `Mo khoa (giu den R${targetRound})`
    : `Khoa Shop (giu den R${targetRound})`;

  if (lockHint) {
    lockHint.textContent = game.state.lockedShop
      ? `Shop dang duoc khoa va giu nguyen den het Round ${targetRound}.`
      : `Shop se duoc lam moi khi qua round. Co the khoa truoc de giu lai doi hinh shop den Round ${targetRound}.`;
    lockHint.classList.toggle("active", game.state.lockedShop);
  }

  if (fuseBtn) {
    const picks = game.state.fusion?.picks ?? [];
    const count = picks.length;
    fuseBtn.classList.toggle("active", Boolean(game.state.fusion?.mode));
    fuseBtn.textContent = game.state.fusion?.mode
      ? `Dang hop the (${count}/2)`
      : "Hop the";
  }
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
    passive: null,
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
    ${info.passive ? `<div class="inspectPassive ${passiveToneClass(info.passive.effectTone)}"><b>${info.passive.name}</b> - ${info.passive.desc ?? ""}</div>` : ""}
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

function fighterHtmlWithState(f, hp, alive, flashActorKey, flashTargetKey, flashActorKind = "", flashTargetKind = "", counter = null) {
  const actorFlash = f.key === flashActorKey ? " actorFlash" : "";
  const targetFlash = f.key === flashTargetKey ? " targetFlash" : "";
  const actorFx = f.key === flashActorKey && flashActorKind ? ` hit-${flashActorKind}` : "";
  const targetFx = f.key === flashTargetKey && flashTargetKind ? ` hit-${flashTargetKind}` : "";
  const currentHp = hp ?? f.hp;
  const effectiveAlive = alive ?? f.alive;
  const effectivePct = f.maxHp === 0 ? 0 : Math.round((currentHp / f.maxHp) * 100);
  const imageUrl = f.imageUrl ? String(f.imageUrl).trim() : "";
  const fusionImageUrl2 = f.fusionImageUrl2 ? String(f.fusionImageUrl2).trim() : "";
  const initials = unitInitials(f.name);
  const counterHtml = counter
    ? `<div class="procCounter ${counter.kind ?? "mixed"}">${displayText(counter.text ?? "PROC")}</div>`
    : "";
  const portraitHtml = fusionImageUrl2
    ? `
      <div class="fighterPortrait fusion ${imageUrl || fusionImageUrl2 ? "" : "fallback"}">
        ${imageUrl ? `<img class="split left" src="${imageUrl}" data-base-src="${imageUrl}" data-retries="0" alt="${f.name}" loading="lazy" referrerpolicy="no-referrer" onerror="window.__ctttPortraitImgError && window.__ctttPortraitImgError(this)" />` : ""}
        ${fusionImageUrl2 ? `<img class="split right" src="${fusionImageUrl2}" data-base-src="${fusionImageUrl2}" data-retries="0" alt="${f.name}" loading="lazy" referrerpolicy="no-referrer" onerror="window.__ctttPortraitImgError && window.__ctttPortraitImgError(this)" />` : ""}
        <span>${initials}</span>
      </div>
    `
    : `
      <div class="fighterPortrait ${imageUrl ? "" : "fallback"}">
        ${imageUrl ? `<img src="${imageUrl}" data-base-src="${imageUrl}" data-retries="0" alt="${f.name}" loading="lazy" referrerpolicy="no-referrer" onerror="window.__ctttPortraitImgError && window.__ctttPortraitImgError(this)" />` : ""}
        <span>${initials}</span>
      </div>
    `;
  return `
    <div class="fighter ${effectiveAlive ? "" : "dead"}${actorFlash}${targetFlash}${actorFx}${targetFx}">
      <div class="fighterBody">
        ${portraitHtml}
        <div class="fighterInfo">
          <div class="fighterTop">
            <span>${f.name}</span>
            <small>${currentHp}/${f.maxHp}</small>
          </div>
        </div>
      </div>
      <div class="hpTrack"><div class="hpFill" style="width:${effectivePct}%"></div></div>
      ${counterHtml}
    </div>
  `;
}

function cloneLineup(list) {
  return list.map((f) => ({
    key: f.key,
    name: f.name,
    imageUrl: f.imageUrl ?? "",
    fusionImageUrl2: f.fusionImageUrl2 ?? "",
    maxHp: f.maxHp,
    hp: f.hp,
    alive: f.alive,
  }));
}

function renderPlaybackFrame(view, flashActorKey = "", flashTargetKey = "", flashActorKind = "", flashTargetKind = "") {
  const allies = el("combatAllies");
  const enemies = el("combatEnemies");
  const log = el("combatLog");

  const badges = view.badges ?? new Map();
  allies.innerHTML = view.allies
    .map((f) => fighterHtmlWithState(f, f.hp, f.alive, flashActorKey, flashTargetKey, flashActorKind, flashTargetKind, badges.get(f.key)))
    .join("");
  enemies.innerHTML = view.enemies
    .map((f) => fighterHtmlWithState(f, f.hp, f.alive, flashActorKey, flashTargetKey, flashActorKind, flashTargetKind, badges.get(f.key)))
    .join("");
  log.innerHTML = view.logs
    .map((line, idx) => {
      const latest = idx === view.logs.length - 1 && idx > 0 ? " logLatest" : "";
      const raw = typeof line === "string" ? line : String(line ?? "");
      const shown = displayText(raw);
      if (idx === 0) return `<div class="combatTitle">${shown}</div>`;
      if (raw.startsWith("[BUFF]")) return `<div class="logBuff${latest}">${shown}</div>`;
      if (raw.startsWith("[DEBUFF]")) return `<div class="logDebuff${latest}">${shown}</div>`;
      if (raw.startsWith("[MIXED]")) return `<div class="logMixed${latest}">${shown}</div>`;
      if (raw.startsWith("[ATK]")) return `<div class="logAttack${latest}">${shown}</div>`;
      if (raw.startsWith("[SKILL]")) return `<div class="logSkill${latest}">${shown}</div>`;
      return `<div class="${latest.trim()}">${shown}</div>`;
    })
    .join("");

  // Keep log in live-follow mode during playback so users don't need manual scrolling.
  requestAnimationFrame(() => {
    log.scrollTop = log.scrollHeight;
  });
}

function applyCombatEvent(view, event) {
  if (!event) return;
  view.badges = new Map();

  if (event.type === "skill") {
    view.logs.push(event.text);
    return;
  }

  if (event.type === "passive") {
    if (event.badgeTargetKey && event.badgeText) {
      view.badges.set(event.badgeTargetKey, {
        text: event.badgeText,
        kind: event.badgeKind ?? "mixed",
      });
    }
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
    badges: new Map(),
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
    const actorKind = event.type === "hit"
      ? (event.hitKind === "reflect" ? "reflect" : "attack")
      : "";
    const targetKind = event.type === "hit"
      ? (event.hitKind ?? "normal")
      : (event.type === "passive" ? (event.badgeKind ?? "proc") : "");
    const targetKey = event.type === "passive" && event.badgeTargetKey
      ? event.badgeTargetKey
      : (event.targetKey ?? "");

    renderPlaybackFrame(view, event.actorKey ?? "", targetKey, actorKind, targetKind);

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
  emojiEnabled = game.state.settings?.showEmoji !== false;
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

  if (result.fused) {
    fxFloatText(stage, "Hop the thanh cong", "good");
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
