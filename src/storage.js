const SAVE_KEY = "cttt_save_v6";

export function saveGame(payload) {
  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify({
      savedAt: new Date().toISOString(),
      payload,
    })
  );
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.payload ?? null;
  } catch {
    return null;
  }
}
