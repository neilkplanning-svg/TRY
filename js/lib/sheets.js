/**
 * אפשרות 2 — Google Sheets כמסד נתונים.
 * הדפדפן של הגולש מושך את הגיליון ישירות מגוגל (אין Git, אין build).
 *
 * שרשרת גיבוי: Google → עותק אחרון שנשמר בדפדפן → קובץ CSV מקומי ב-data/sheets/.
 * כך האתר לא "נשבר" אם גוגל איטי, אם הגיליון לא משותף, או אם מישהו מחק עמודה.
 */
import { SHEETS } from "../config.js";
import { parseCsv } from "./csv.js";

// כותרות עמודה מותרות לכל שדה — עברית או אנגלית, כדי שהלקוח לא ישבור בטעות.
const SCHEMAS = {
  menu: {
    required: ["category", "name", "price"],
    columns: {
      category: ["קטגוריה", "category"],
      name: ["שם המנה", "שם", "מנה", "name"],
      description: ["תיאור", "description"],
      price: ["מחיר", "price"],
      tags: ["תגיות", "tags"],
      available: ["זמין", "במלאי", "available"],
    },
  },
  specials: {
    required: ["name"],
    columns: {
      name: ["שם המנה", "שם", "name"],
      description: ["תיאור", "description"],
      price: ["מחיר", "price"],
      active: ["פעיל", "להציג", "active"],
    },
  },
  hours: {
    required: ["day"],
    columns: {
      day: ["יום", "day"],
      open: ["פתיחה", "open"],
      close: ["סגירה", "close"],
      note: ["הערה", "note"],
    },
  },
  wine: {
    required: ["name"],
    columns: {
      type: ["סוג", "type"],
      name: ["שם היין", "יין", "שם", "name"],
      winery: ["יקב", "winery"],
      region: ["אזור", "region"],
      glass: ["כוס", "מחיר כוס", "glass"],
      bottle: ["בקבוק", "מחיר בקבוק", "bottle"],
    },
  },
};

const norm = (s) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

function toObjects(table, tab) {
  const schema = SCHEMAS[tab];
  const [header = [], ...body] = table;
  const index = {};
  const normalizedHeader = header.map(norm);

  for (const [key, aliases] of Object.entries(schema.columns)) {
    const pos = normalizedHeader.findIndex((h) => aliases.some((a) => norm(a) === h));
    if (pos !== -1) index[key] = pos;
  }

  const missing = schema.required.filter((key) => !(key in index));
  if (missing.length) {
    throw new Error(`בלשונית "${SHEETS.tabs[tab]}" חסרות עמודות: ${missing.map((k) => schema.columns[k][0]).join(", ")}`);
  }

  return body
    .map((cells) => Object.fromEntries(Object.entries(index).map(([key, pos]) => [key, (cells[pos] ?? "").trim()])))
    .filter((row) => schema.required.every((key) => row[key] !== ""));
}

function remoteUrl(tab) {
  if (SHEETS.publishedCsv?.[tab]) return SHEETS.publishedCsv[tab];
  if (SHEETS.sheetId) {
    const sheet = encodeURIComponent(SHEETS.tabs[tab]);
    // gviz endpoint: no "publish to web" needed (only link-sharing), and it skips Google's ~5 min publish cache.
    return `https://docs.google.com/spreadsheets/d/${SHEETS.sheetId}/gviz/tq?tqx=out:csv&headers=1&sheet=${sheet}`;
  }
  return null;
}

async function fetchText(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    // A non-shared sheet answers 200 with Google's HTML sign-in page instead of CSV.
    if (/^\s*<(!doctype|html)/i.test(text)) throw new Error("הגיליון לא משותף לצפייה ציבורית");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

const cacheKey = (tab) => `gachelet:sheet:${tab}`;

function readCache(tab) {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(tab)) || "null");
  } catch {
    return null;
  }
}

function writeCache(tab, rows) {
  try {
    localStorage.setItem(cacheKey(tab), JSON.stringify({ rows, savedAt: Date.now() }));
  } catch {
    /* private mode / storage full — fine, the cache is only a convenience */
  }
}

const inflight = new Map();

/**
 * @returns {Promise<{rows: object[], origin: "google"|"cache"|"local", updatedAt: number|null, error?: string}>}
 */
export function loadSheet(tab) {
  if (!inflight.has(tab)) inflight.set(tab, load(tab));
  return inflight.get(tab);
}

async function load(tab) {
  const url = remoteUrl(tab);
  let error;

  if (url) {
    try {
      const rows = toObjects(parseCsv(await fetchText(url, SHEETS.timeoutMs)), tab);
      writeCache(tab, rows);
      return { rows, origin: "google", updatedAt: Date.now() };
    } catch (err) {
      error = err.name === "AbortError" ? "גוגל לא הגיב בזמן" : err.message;
      console.warn(`[sheets:${tab}]`, error);
      const cached = readCache(tab);
      if (cached?.rows?.length) return { rows: cached.rows, origin: "cache", updatedAt: cached.savedAt, error };
    }
  }

  try {
    const res = await fetch(`data/sheets/${tab}.csv`, { cache: "no-cache" });
    const rows = toObjects(parseCsv(await res.text()), tab);
    return { rows, origin: "local", updatedAt: null, error };
  } catch (err) {
    console.error(`[sheets:${tab}] local fallback failed`, err);
    return { rows: [], origin: "local", updatedAt: null, error: error || err.message };
  }
}

/* ---------- Field helpers ---------- */

export function isTruthy(value, fallback = true) {
  const v = norm(value);
  if (v === "") return fallback;
  return !["false", "לא", "0", "no", "אזל", "x", "✗"].includes(v);
}

const TAGS = {
  vegan: { label: "טבעוני", match: ["טבעוני", "vegan"] },
  veg: { label: "צמחוני", match: ["צמחוני", "vegetarian", "veg"] },
  gf: { label: "ללא גלוטן", match: ["ללא גלוטן", "gf", "gluten free"] },
  spicy: { label: "חריף", match: ["חריף", "spicy", "🌶"] },
  chef: { label: "המלצת השף", match: ["המלצת השף", "שף", "chef"] },
  new: { label: "חדש", match: ["חדש", "new"] },
};

export function parseTags(value) {
  return String(value || "")
    .split(/[,|;]/)
    .map(norm)
    .filter(Boolean)
    .map((t) => Object.entries(TAGS).find(([, def]) => def.match.some((m) => norm(m) === t))?.[0])
    .filter(Boolean);
}

export const tagLabel = (key) => TAGS[key]?.label ?? key;

export function originLabel(result) {
  const labels = {
    google: "מתעדכן חי מ-Google Sheets",
    cache: "עותק אחרון שנשמר (גוגל לא זמין כרגע)",
    local: SHEETS.sheetId || Object.values(SHEETS.publishedCsv).some(Boolean) ? "קובץ גיבוי מקומי (גוגל לא זמין)" : "קובץ CSV מקומי — עוד לא חובר גיליון",
  };
  return labels[result.origin];
}
