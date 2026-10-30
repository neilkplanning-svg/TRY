// Small DOM helpers shared by all pages.

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape any value for safe interpolation into HTML (used for all Sheets data). */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ALLOWED_TAGS = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "A", "UL", "OL", "LI", "H2", "H3", "H4", "BLOCKQUOTE", "SPAN"]);

/**
 * Rich-text fields from Pages CMS are stored as HTML inside the JSON.
 * Keep a small whitelist so a pasted <script> or onclick never reaches the page.
 */
export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(`<div>${html ?? ""}</div>`, "text/html");
  const root = doc.body.firstElementChild;

  const walk = (node) => {
    for (const child of [...node.children]) {
      if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "TEMPLATE"].includes(child.tagName)) {
        child.remove();
        continue;
      }
      if (!ALLOWED_TAGS.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        walk(node);
        return;
      }
      for (const attr of [...child.attributes]) {
        const keep = child.tagName === "A" && attr.name === "href" && /^(https?:|mailto:|tel:|#|[\w./-]+$)/i.test(attr.value.trim());
        if (!keep) child.removeAttribute(attr.name);
      }
      if (child.tagName === "A" && /^https?:/i.test(child.getAttribute("href") || "")) {
        child.setAttribute("target", "_blank");
        child.setAttribute("rel", "noopener");
      }
      walk(child);
    }
  };
  walk(root);
  return root.innerHTML;
}

/** Render plain text from CMS "text" fields (keeps line breaks). */
export function textToHtml(text) {
  return esc(text).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
}

export function imageTag(src, alt = "", attrs = "") {
  if (!src) return "";
  return `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" ${attrs}>`;
}

export function initials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

/** Fade sections in as they scroll into view. */
export function observeReveal(root = document) {
  const items = $$(".reveal:not(.is-visible)", root);
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px" }
  );
  items.forEach((el) => io.observe(el));
}

export function formatPrice(value, currency = "₪") {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? `${currency}${n % 1 ? n.toFixed(2) : n}` : esc(value);
}

const HE_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function parseDate(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

export function dateParts(iso) {
  const date = parseDate(iso);
  if (!date) return { day: "", month: "", weekday: "", full: "" };
  return {
    day: date.getDate(),
    month: HE_MONTHS[date.getMonth()],
    weekday: `יום ${HE_DAYS[date.getDay()]}`,
    full: `${date.getDate()} ב${HE_MONTHS[date.getMonth()]} ${date.getFullYear()}`,
  };
}

export { HE_DAYS };
