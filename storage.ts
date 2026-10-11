export type Phase = "intro" | "play" | "note" | "finale" | "letter";

export type Save = {
  v: 1;
  phase: Exclude<Phase, "intro">;
  level: number;
};

const KEY = "ten-parts-fa-v1";

export function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Save;
    if (data?.v !== 1) return null;
    if (data.phase !== "play" && data.phase !== "note" && data.phase !== "finale" && data.phase !== "letter") {
      return null;
    }
    if (typeof data.level !== "number" || data.level < 0 || data.level > 9) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(save: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode */
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}
