// Opening hours (Google Sheets "שעות פתיחה" tab) → "open now" status in Israel time.
import { SITE } from "../config.js";
import { HE_DAYS, esc } from "./dom.js";

const toMinutes = (hhmm) => {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(String(hhmm || "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

function dayIndex(name) {
  const n = String(name || "").trim().replace(/^יום\s+/, "");
  const he = HE_DAYS.indexOf(n);
  if (he !== -1) return he;
  const en = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(n.slice(0, 3).toLowerCase());
  return en;
}

function nowInIsrael() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: SITE.timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return {
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function normalizeHours(rows) {
  return rows
    .map((r) => ({ ...r, index: dayIndex(r.day), openMin: toMinutes(r.open), closeMin: toMinutes(r.close) }))
    .filter((r) => r.index !== -1)
    .sort((a, b) => a.index - b.index);
}

export function openStatus(rows) {
  const days = normalizeHours(rows);
  if (!days.length) return null;
  const byDay = new Map(days.map((d) => [d.index, d]));
  const { day, minutes } = nowInIsrael();

  const today = byDay.get(day);
  const yesterday = byDay.get((day + 6) % 7);

  // Yesterday's shift that runs past midnight (e.g. 18:00–01:00)
  if (yesterday?.openMin != null && yesterday.closeMin != null && yesterday.closeMin <= yesterday.openMin && minutes < yesterday.closeMin) {
    return { open: true, text: `פתוח עכשיו · עד ${yesterday.close}` };
  }
  if (today?.openMin != null && today.closeMin != null) {
    const overnight = today.closeMin <= today.openMin;
    if (minutes >= today.openMin && (overnight || minutes < today.closeMin)) {
      return { open: true, text: `פתוח עכשיו · עד ${today.close}` };
    }
    if (minutes < today.openMin) return { open: false, text: `סגור כרגע · נפתח היום ב-${today.open}` };
  }
  for (let i = 1; i <= 7; i++) {
    const next = byDay.get((day + i) % 7);
    if (next?.openMin != null) {
      const when = i === 1 ? "מחר" : `ביום ${HE_DAYS[next.index]}`;
      return { open: false, text: `סגור כרגע · נפתח ${when} ב-${next.open}` };
    }
  }
  return { open: false, text: "סגור כרגע" };
}

export function renderHoursList(rows) {
  const { day } = nowInIsrael();
  return normalizeHours(rows)
    .map((r) => {
      const time = r.openMin != null ? `${esc(r.open)}–${esc(r.close)}` : "סגור";
      const note = r.note ? `<span class="note">${esc(r.note)}</span>` : "";
      return `<li class="${r.index === day ? "is-today" : ""}"><span>יום ${HE_DAYS[r.index]}${r.index === day ? " (היום)" : ""}${note}</span><span dir="ltr">${time}</span></li>`;
    })
    .join("");
}
