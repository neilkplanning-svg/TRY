import { initLayout } from "../lib/layout.js";
import { loadAll } from "../lib/cms.js";
import { loadSheet, isTruthy, originLabel } from "../lib/sheets.js";
import { openStatus, renderHoursList } from "../lib/hours.js";
import { $, esc, sanitizeHtml, imageTag, formatPrice, dateParts, parseDate, observeReveal } from "../lib/dom.js";

const setText = (sel, value) => {
  const el = $(sel);
  if (el && value) el.textContent = value;
};

function renderHome(home) {
  if (!home) return;
  const { hero, intro, cta } = home;
  setText("#hero-eyebrow", hero.eyebrow);
  setText("#hero-title", hero.title);
  setText("#hero-subtitle", hero.subtitle);
  setText("#hero-cta1", hero.cta_primary);
  setText("#hero-cta2", hero.cta_secondary);
  if (hero.image) $("#hero-img").src = hero.image;

  setText("#intro-eyebrow", intro.eyebrow);
  setText("#intro-title", intro.title);
  $("#intro-body").innerHTML = sanitizeHtml(intro.body);
  setText("#intro-link", intro.link_text);
  $("#intro-media").innerHTML = imageTag(intro.image, intro.title);

  setText("#signature-title", home.signature_title);
  $("#signature-grid").innerHTML = (home.signature || [])
    .map(
      (d, i) => `
      <article class="card reveal" style="transition-delay:${i * 80}ms">
        <div class="card__media">${imageTag(d.image, d.name)}</div>
        <div class="card__body"><h3>${esc(d.name)}</h3><p>${esc(d.description)}</p></div>
      </article>`
    )
    .join("");

  $("#stats").innerHTML = (home.stats || [])
    .map((s) => `<div class="stat"><span class="stat__value">${esc(s.value)}</span><span class="stat__label">${esc(s.label)}</span></div>`)
    .join("");

  setText("#cta-title", cta?.title);
  setText("#cta-text", cta?.text);
  setText("#cta-btn", cta?.button);
}

function renderTestimonials(data) {
  const root = $("#testimonials");
  const items = data?.items || [];
  if (!items.length) {
    root.closest("section").remove();
    return;
  }
  setText("#testimonials-title", data.title);
  root.innerHTML = `
    <div class="slider__track" aria-live="polite">
      ${items
        .map(
          (t, i) => `
        <figure class="slide${i === 0 ? " is-active" : ""}" role="group" aria-roledescription="שקופית" aria-label="${i + 1} מתוך ${items.length}">
          <div class="stars" aria-label="דירוג ${Number(t.rating) || 5} מתוך 5">${"★".repeat(Number(t.rating) || 5)}${"☆".repeat(5 - (Number(t.rating) || 5))}</div>
          <blockquote>${esc(t.quote)}</blockquote>
          <cite>— ${esc(t.name)}${t.source ? ` · ${esc(t.source)}` : ""}</cite>
        </figure>`
        )
        .join("")}
    </div>
    <div class="slider__controls">
      <button class="icon-btn" type="button" data-dir="-1" aria-label="הקודם">→</button>
      <div class="slider__dots">${items.map((_, i) => `<button class="slider__dot" type="button" data-go="${i}" aria-label="ביקורת ${i + 1}"${i === 0 ? ' aria-current="true"' : ""}></button>`).join("")}</div>
      <button class="icon-btn" type="button" data-dir="1" aria-label="הבא">←</button>
    </div>`;

  const slides = [...root.querySelectorAll(".slide")];
  const dots = [...root.querySelectorAll(".slider__dot")];
  let current = 0;
  const go = (n) => {
    current = (n + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle("is-active", i === current));
    dots.forEach((d, i) => (i === current ? d.setAttribute("aria-current", "true") : d.removeAttribute("aria-current")));
  };
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.dir) go(current + Number(btn.dataset.dir));
    if (btn.dataset.go) go(Number(btn.dataset.go));
    clearInterval(timer);
  });
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("a11y-motion");
  let timer = reduced ? null : setInterval(() => go(current + 1), 7000);
  root.addEventListener("focusin", () => clearInterval(timer));
}

function renderEventsMini(data) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = (data?.events || [])
    .filter((e) => parseDate(e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  $("#events-mini").innerHTML = upcoming.length
    ? upcoming
        .map((e) => {
          const d = dateParts(e.date);
          return `
          <a class="event-mini" href="events.html#${encodeURIComponent(e.date)}" style="text-decoration:none;color:inherit">
            <div class="event-mini__date"><strong>${d.day}</strong><small>${d.month}</small></div>
            <div>
              <h3>${esc(e.title)} ${e.sold_out ? '<span class="badge badge--soldout">אזל</span>' : ""}</h3>
              <span class="muted">${d.weekday} · ${esc(e.time)} · ${formatPrice(e.price)} לאדם</span>
            </div>
          </a>`;
        })
        .join("")
    : '<p class="muted">אין כרגע אירועים מתוכננים — עקבו אחרינו באינסטגרם.</p>';
}

function renderGalleryStrip(data) {
  $("#gallery-strip").innerHTML = (data?.images || [])
    .slice(0, 6)
    .map((img) => `<a class="card__media" style="border-radius:var(--radius);display:block" href="gallery.html">${imageTag(img.image, img.caption)}</a>`)
    .join("");
}

async function renderSpecials() {
  const result = await loadSheet("specials");
  const active = result.rows.filter((r) => isTruthy(r.active));
  const list = $("#specials-list");
  if (!active.length) {
    list.innerHTML = '<p class="muted" style="margin:0">היום אין מנות מיוחדות — אבל התפריט המלא מחכה.</p>';
  } else {
    list.innerHTML = active
      .map(
        (s) => `
        <article class="special">
          <h3><span>${esc(s.name)}</span><span style="color:var(--gold)">${formatPrice(s.price)}</span></h3>
          <p>${esc(s.description)}</p>
        </article>`
      )
      .join("");
  }
  $("#specials-note").textContent = originLabel(result);
}

async function renderHours() {
  const result = await loadSheet("hours");
  $("#home-hours").innerHTML = renderHoursList(result.rows);
  const status = openStatus(result.rows);
  const pill = $("#home-status");
  if (status) {
    pill.textContent = status.text;
    pill.classList.add(status.open ? "status-pill--open" : "status-pill--closed");
  }
  const note = $("#hours-note");
  note.dataset.origin = result.origin;
  note.innerHTML = `<span class="data-note__dot"></span>${esc(originLabel(result))}`;
}

(async () => {
  initLayout();
  renderSpecials();
  renderHours();
  const data = await loadAll(["home", "testimonials", "events", "gallery"]);
  renderHome(data.home);
  renderTestimonials(data.testimonials);
  renderEventsMini(data.events);
  renderGalleryStrip(data.gallery);
  observeReveal();
})();
