/**
 * Shared chrome for every page: announcement bar, header/nav, accessibility menu, footer.
 * All of it is driven by content/settings.json (Pages CMS) + the hours tab (Google Sheets),
 * so the client edits phone/address/banner once and it updates on every page.
 */
import { loadContent } from "./cms.js";
import { loadSheet } from "./sheets.js";
import { openStatus } from "./hours.js";
import { $, esc, observeReveal } from "./dom.js";

const NAV = [
  { href: "index.html", label: "בית" },
  { href: "menu.html", label: "תפריט" },
  { href: "about.html", label: "הסיפור שלנו" },
  { href: "events.html", label: "אירועים" },
  { href: "gallery.html", label: "גלריה" },
  { href: "contact.html", label: "צור קשר" },
];

const currentFile = () => location.pathname.split("/").pop() || "index.html";

const ICONS = {
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  a11y: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="4.5" r="1.8"/><path d="M5 8.5l7 1.5 7-1.5M12 10v5m0 0l-3.5 6M12 15l3.5 6"/></svg>',
};

function announcementHtml(a) {
  if (!a?.enabled || !a.text) return "";
  try {
    if (sessionStorage.getItem("gachelet:announcement-dismissed") === a.text) return "";
  } catch {
    /* storage blocked — just show the bar */
  }
  const link = a.link ? `<a href="${esc(a.link)}">${esc(a.link_text || "לפרטים")} ←</a>` : "";
  return `<div class="announcement" role="region" aria-label="הודעה" data-source="cms:settings.json › announcement">
    <span>${esc(a.text)}</span>${link}
    <button class="announcement__close" type="button" aria-label="סגירת ההודעה">×</button>
  </div>`;
}

function headerHtml(s) {
  const here = currentFile();
  const links = NAV.map(
    (n) => `<li><a class="nav__link" href="${n.href}"${n.href === here ? ' aria-current="page"' : ""}>${n.label}</a></li>`
  ).join("");
  return `
  <header class="site-header">
    <div class="container site-header__inner">
      <a class="brand" href="index.html" data-source="cms:settings.json › name">
        <span class="brand__mark" aria-hidden="true"></span>
        <span><span class="brand__name">${esc(s.name)}</span><span class="brand__tag">${esc(s.tagline)}</span></span>
      </a>
      <nav class="nav" id="main-nav" aria-label="ניווט ראשי"><ul class="nav__list">${links}</ul></nav>
      <div class="header-actions">
        <a class="btn btn--primary btn--sm" href="contact.html">להזמנת שולחן</a>
        <button class="icon-btn" type="button" id="a11y-toggle" aria-expanded="false" aria-controls="a11y-panel" aria-label="תפריט נגישות">${ICONS.a11y}</button>
        <button class="icon-btn menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="פתיחת תפריט">${ICONS.menu}</button>
      </div>
    </div>
    <div class="a11y-panel" id="a11y-panel" hidden>
      <strong>נגישות</strong>
      <button type="button" data-a11y="bigger">הגדלת טקסט</button>
      <button type="button" data-a11y="contrast" aria-pressed="false">ניגודיות גבוהה</button>
      <button type="button" data-a11y="links" aria-pressed="false">הדגשת קישורים</button>
      <button type="button" data-a11y="motion" aria-pressed="false">עצירת אנימציות</button>
      <button type="button" data-a11y="reset">איפוס</button>
      <a href="accessibility.html">הצהרת נגישות</a>
    </div>
  </header>`;
}

function footerHtml(s) {
  const social = Object.entries(s.social || {})
    .filter(([, url]) => url)
    .map(([key, url]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener">${{ instagram: "אינסטגרם", facebook: "פייסבוק", tiktok: "טיקטוק" }[key] || esc(key)}</a></li>`)
    .join("");
  return `
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div data-source="cms:settings.json">
          <a class="brand" href="index.html"><span class="brand__mark" aria-hidden="true"></span><span class="brand__name">${esc(s.name)}</span></a>
          <p class="muted" style="margin-top:14px">${esc(s.footer_text || "")}</p>
          <span class="status-pill" id="footer-status" data-source="sheets:שעות פתיחה">בודקים שעות…</span>
        </div>
        <div>
          <h3>ביקור</h3>
          <ul>
            <li>${esc(s.address)}</li>
            <li><a href="tel:${esc(String(s.phone).replace(/[^\d+]/g, ""))}" dir="ltr">${esc(s.phone)}</a></li>
            <li><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>
          </ul>
        </div>
        <div>
          <h3>ניווט</h3>
          <ul>${NAV.map((n) => `<li><a href="${n.href}">${n.label}</a></li>`).join("")}</ul>
        </div>
        <div>
          <h3>עקבו אחרינו</h3>
          <ul>${social}</ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} ${esc(s.name)} · אתר הדגמה, כל התוכן בדיוני</span>
        <span>
          <a href="accessibility.html">הצהרת נגישות</a> ·
          <button class="link-btn" type="button" id="sources-toggle">הצגת מקורות התוכן (CMS / Sheets)</button>
        </span>
      </div>
    </div>
  </footer>`;
}

/* ---------- Accessibility preferences (per-visitor, localStorage) ---------- */
const A11Y_KEY = "gachelet:a11y";
function readA11y() {
  try {
    return JSON.parse(localStorage.getItem(A11Y_KEY) || "{}");
  } catch {
    return {};
  }
}
function applyA11y(prefs) {
  const root = document.documentElement;
  root.style.setProperty("--font-scale", String(prefs.scale || 1));
  for (const key of ["contrast", "links", "motion"]) {
    root.classList.toggle(`a11y-${key}`, !!prefs[key]);
    const btn = document.querySelector(`[data-a11y="${key}"]`);
    if (btn) btn.setAttribute("aria-pressed", String(!!prefs[key]));
  }
  try {
    localStorage.setItem(A11Y_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

function wireHeader() {
  const navToggle = $(".menu-toggle");
  const nav = $("#main-nav");
  navToggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });

  const a11yBtn = $("#a11y-toggle");
  const panel = $("#a11y-panel");
  a11yBtn.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    a11yBtn.setAttribute("aria-expanded", String(!panel.hidden));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      panel.hidden = true;
      a11yBtn.setAttribute("aria-expanded", "false");
      a11yBtn.focus();
    }
  });
  panel.addEventListener("click", (e) => {
    const action = e.target.closest("[data-a11y]")?.dataset.a11y;
    if (!action) return;
    const prefs = readA11y();
    if (action === "bigger") prefs.scale = Math.min(1.5, Math.round(((prefs.scale || 1) + 0.1) * 10) / 10);
    else if (action === "reset") Object.keys(prefs).forEach((k) => delete prefs[k]);
    else prefs[action] = !prefs[action];
    applyA11y(prefs);
  });
}

function wireSources() {
  const params = new URLSearchParams(location.search);
  if (params.has("sources")) document.body.classList.add("show-sources");
  $("#sources-toggle")?.addEventListener("click", () => {
    document.body.classList.toggle("show-sources");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

export async function initLayout() {
  applyA11y(readA11y());
  let settings;
  try {
    settings = await loadContent("settings");
  } catch (err) {
    console.error(err);
    settings = { name: "גחלת", tagline: "", social: {} };
  }

  const headerSlot = $("#site-header");
  headerSlot.innerHTML = announcementHtml(settings.announcement) + headerHtml(settings);
  $("#site-footer").outerHTML = footerHtml(settings);

  $(".announcement__close")?.addEventListener("click", (e) => {
    try {
      sessionStorage.setItem("gachelet:announcement-dismissed", settings.announcement.text);
    } catch {
      /* ignore */
    }
    e.target.closest(".announcement").remove();
  });

  wireHeader();
  wireSources();

  loadSheet("hours").then((hours) => {
    const status = openStatus(hours.rows);
    const pill = $("#footer-status");
    if (!pill) return;
    if (!status) {
      pill.remove();
      return;
    }
    pill.textContent = status.text;
    pill.classList.add(status.open ? "status-pill--open" : "status-pill--closed");
  });

  queueMicrotask(() => observeReveal());
  return settings;
}
