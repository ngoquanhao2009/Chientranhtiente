import { Game } from "./game.js";
import { loadGame, saveGame } from "./storage.js";
import { bindUI, feedback, renderAll } from "./ui.js";

const game = new Game();
const snapshot = loadGame();
if (snapshot) {
  game.hydrate(snapshot);
}

if (Array.isArray(game.integrityIssues) && game.integrityIssues.length > 0) {
  console.warn("Data integrity issues:", game.integrityIssues);
}

function safeRender() {
  try {
    renderAll(game);
    return true;
  } catch (err) {
    console.error("Render failure:", err);
    feedback({ ok: false, reason: "Co loi hien thi. Thu Tai lai, hoac Van moi neu save cu bi loi." });
    return false;
  }
}

function run(action) {
  let result;
  try {
    result = action();
  } catch {
    result = { ok: false, reason: "Co loi xay ra trong luc xu ly thao tac." };
  }

  if (result?.ok) {
    saveGame(game.serialize());
  }

  safeRender();
  feedback(result);
}

bindUI(game, {
  onNew: () => run(() => {
    game.newRun();
    return { ok: true };
  }),
  onSave: () => run(() => {
    saveGame(game.serialize());
    return { ok: true, reason: "Da luu" };
  }),
  onLoad: () => run(() => {
    const loaded = loadGame();
    if (!loaded) return { ok: false, reason: "Chua co ban luu" };
    const ok = game.hydrate(loaded);
    return ok ? { ok: true } : { ok: false, reason: "Ban luu khong hop le" };
  }),
  onRefresh: () => run(() => game.rollShop(false)),
  onBuyXp: () => run(() => game.buyXp()),
  onNextRound: () => run(() => game.nextRound()),
  onLockShop: () => run(() => game.lockShop()),
  onFuseToggle: () => run(() => game.toggleFusionMode()),
  onFusePick: (zone, index) => run(() => game.fusePick(zone, index)),
  onBuyShop: (index) => run(() => game.buyFromShop(index)),
  onSellBench: (index) => run(() => game.sellBench(index)),
  onBenchToBoard: (index) => run(() => game.moveBenchToBoard(index)),
  onBoardToBench: (index) => run(() => game.moveBoardToBench(index)),
  onDrop: (fromKind, fromIndex, toKind, toIndex) => run(() => {
    if (fromKind === toKind) {
      if (fromKind === "bench") {
        return game.swapBench(fromIndex, toIndex);
      }
      return game.swapBoard(fromIndex, toIndex);
    }

    if (fromKind === "bench" && toKind === "board") {
      return game.moveBenchToBoardAt(fromIndex, toIndex);
    }

    if (fromKind === "board" && toKind === "bench") {
      return game.moveBoardToBenchAt(fromIndex, toIndex);
    }

    return { ok: false, reason: "Thao tac keo-tha khong hop le." };
  }),
  onInspect: (where, index) => {
    if (where === "shop") game.getInfoFromShop(index);
    if (where === "bench") game.getInfoFromBench(index);
    if (where === "board") game.getInfoFromBoard(index);
    renderAll(game);
  },
  onToggleEmoji: (enabled) => run(() => game.setEmojiEnabled(enabled)),
});

safeRender();

if (Array.isArray(game.integrityIssues) && game.integrityIssues.length > 0) {
  feedback({
    ok: false,
    reason: `Canh bao du lieu: phat hien ${game.integrityIssues.length} van de JSON. Kiem tra console de xem chi tiet.`,
  });
}
