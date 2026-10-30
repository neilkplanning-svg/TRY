import { initLayout } from "../lib/layout.js";
import { loadContent } from "../lib/cms.js";
import { loadSheet } from "../lib/sheets.js";
import { openStatus, renderHoursList, normalizeHours } from "../lib/hours.js";
import { $, $$, esc, sanitizeHtml, dateParts } from "../lib/dom.js";

const form = $("#reservation");
let settings;
let hours = [];

const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Fill the time <select> with 30-minute slots based on that weekday's hours from the sheet. */
function fillTimes() {
  const select = $("#r-time");
  const value = select.value;
  const date = $("#r-date").value ? new Date(`${$("#r-date").value}T12:00`) : null;
  const day = date ? hours.find((h) => h.index === date.getDay()) : null;

  if (date && (!day || day.openMin == null)) {
    select.innerHTML = '<option value="">סגור ביום זה</option>';
    return;
  }
  const open = day?.openMin ?? 18 * 60;
  let close = day?.closeMin ?? 23 * 60;
  if (close <= open) close += 24 * 60;
  const last = close - 90; // last seating 1.5h before closing

  const slots = [];
  for (let m = open; m <= last; m += 30) slots.push(`${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`);
  select.innerHTML = '<option value="">בחרו שעה</option>' + slots.map((s) => `<option${s === value ? " selected" : ""}>${s}</option>`).join("");
}

function setError(input, message) {
  const error = input.closest(".field").querySelector(".field__error");
  if (error) error.textContent = message;
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

function validate() {
  let ok = true;
  for (const input of $$("[required]", form)) {
    let msg = "";
    if (!input.value.trim()) msg = "שדה חובה";
    else if (input.name === "phone" && !/^0\d{1,2}-?\d{7}$/.test(input.value.replace(/\s/g, ""))) msg = "מספר טלפון לא תקין";
    else if (input.name === "guests" && Number(input.value) > Number(input.max)) msg = settings.reservation?.large_group_note || `עד ${input.max} סועדים`;
    else if (input.name === "guests" && Number(input.value) < Number(input.min)) msg = "מספר סועדים לא תקין";
    setError(input, msg);
    if (msg && ok) {
      input.focus();
      ok = false;
    }
  }
  return ok;
}

function buildMessage() {
  const f = Object.fromEntries(new FormData(form));
  const d = dateParts(f.date);
  return [
    `בקשת הזמנה — ${settings.name}`,
    `שם: ${f.name}`,
    `טלפון: ${f.phone}`,
    `מתי: ${d.weekday}, ${d.full} בשעה ${f.time}`,
    `סועדים: ${f.guests}`,
    f.occasion && f.occasion !== "ללא" ? `אירוע: ${f.occasion}` : "",
    f.notes ? `הערות: ${f.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function prefillFromQuery() {
  const q = new URLSearchParams(location.search);
  if (q.get("date")) $("#r-date").value = q.get("date");
  const occasion = q.get("occasion");
  if (occasion) {
    const select = $("#r-occasion");
    if (![...select.options].some((o) => o.value === occasion)) select.add(new Option(occasion, occasion));
    select.value = occasion;
  }
  if (q.get("event")) $("#r-notes").value = `מעוניינים ב: ${q.get("event")}`;
}

(async () => {
  initLayout();
  const [s, faq, hoursSheet] = await Promise.all([loadContent("settings"), loadContent("faq"), loadSheet("hours")]);
  settings = s;
  hours = normalizeHours(hoursSheet.rows);

  // Contact details + map (CMS)
  $("#contact-address").textContent = s.address;
  $("#contact-phone").textContent = s.phone;
  $("#contact-phone").href = `tel:${String(s.phone).replace(/[^\d+]/g, "")}`;
  $("#contact-email").textContent = s.email;
  $("#contact-email").href = `mailto:${s.email}`;
  const { lat, lng } = s.map || {};
  if (lat && lng) {
    const d = 0.006;
    $("#map").src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
    $("#waze-link").href = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }

  // Hours (Sheets)
  $("#contact-hours").innerHTML = renderHoursList(hoursSheet.rows);
  const status = openStatus(hoursSheet.rows);
  if (status) {
    $("#contact-status").textContent = status.text;
    $("#contact-status").classList.add(status.open ? "status-pill--open" : "status-pill--closed");
  }

  // Reservation rules (CMS)
  const r = s.reservation || {};
  const guests = $("#r-guests");
  guests.min = r.min_guests || 1;
  guests.max = r.max_guests || 12;
  guests.addEventListener("input", () => {
    setError(guests, Number(guests.value) > Number(guests.max) ? r.large_group_note || "" : "");
  });
  $("#r-occasion").innerHTML = (r.occasions || ["ללא"]).map((o) => `<option>${esc(o)}</option>`).join("");

  const dateInput = $("#r-date");
  const today = new Date();
  dateInput.min = isoDate(today);
  const max = new Date(today);
  max.setDate(max.getDate() + 60);
  dateInput.max = isoDate(max);
  dateInput.addEventListener("change", fillTimes);

  prefillFromQuery();
  fillTimes();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validate()) return;
    const text = encodeURIComponent(buildMessage());
    window.open(`https://wa.me/${s.whatsapp}?text=${text}`, "_blank", "noopener");
    $("#form-status").textContent = "נפתח וואטסאפ עם פרטי ההזמנה — רק ללחוץ שליחה.";
  });
  $("#send-email").addEventListener("click", () => {
    if (!validate()) return;
    location.href = `mailto:${s.email}?subject=${encodeURIComponent("בקשת הזמנת שולחן")}&body=${encodeURIComponent(buildMessage())}`;
  });

  // FAQ (CMS)
  $("#faq-title").textContent = faq.title;
  $("#faq").innerHTML = (faq.items || [])
    .map((q) => `<details><summary>${esc(q.question)}</summary><div class="rich-text">${sanitizeHtml(q.answer)}</div></details>`)
    .join("");
})();
