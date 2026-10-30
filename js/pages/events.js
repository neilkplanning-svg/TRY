import { initLayout } from "../lib/layout.js";
import { loadContent } from "../lib/cms.js";
import { $, esc, imageTag, formatPrice, dateParts, parseDate, observeReveal } from "../lib/dom.js";

let onlyAvailable = false;
let data;

function eventCard(e) {
  const d = dateParts(e.date);
  const reserve = e.sold_out
    ? '<button class="btn btn--ghost btn--sm" type="button" disabled>אזלו המקומות</button>'
    : `<a class="btn btn--primary btn--sm" href="contact.html?occasion=${encodeURIComponent("ערב טעימות")}&event=${encodeURIComponent(e.title)}&date=${encodeURIComponent(e.date)}">שריון מקום</a>`;
  return `
    <article class="event reveal" id="${esc(e.date)}">
      <div class="event__date"><span class="event__day">${d.day}</span><span class="event__month">${d.month}</span></div>
      <div class="event__body">
        <h3>${esc(e.title)} ${e.featured ? '<span class="badge badge--hot">מומלץ</span>' : ""} ${e.sold_out ? '<span class="badge badge--soldout">sold out</span>' : ""}</h3>
        <div class="event__meta"><span>${d.weekday}, ${esc(e.time)}</span><span>${esc(e.seats || "")}</span><span>${formatPrice(e.price)} לאדם</span></div>
        <p>${esc(e.description)}</p>
        ${reserve}
      </div>
      <div class="event__media">${imageTag(e.image, e.title)}</div>
    </article>`;
}

function render() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const events = [...(data.events || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const upcoming = events.filter((e) => parseDate(e.date) >= today && (!onlyAvailable || !e.sold_out));
  const past = events.filter((e) => parseDate(e.date) < today).reverse();

  $("#events-list").innerHTML = upcoming.length ? upcoming.map(eventCard).join("") : '<p class="empty-state">אין כרגע אירועים פתוחים להרשמה.</p>';
  $("#past-events").innerHTML = past.length
    ? past.map((e) => `<p><strong>${esc(e.title)}</strong> <span class="muted">· ${dateParts(e.date).full}</span></p>`).join("")
    : '<p class="muted">עוד אין.</p>';
  observeReveal();

  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
}

(async () => {
  initLayout();
  data = await loadContent("events");

  $("#ev-hero-title").textContent = data.hero_title;
  $("#ev-hero-subtitle").textContent = data.hero_subtitle;
  if (data.hero_image) $("#ev-hero-img").src = data.hero_image;

  $("#private-title").textContent = data.private_title;
  $("#private-text").textContent = data.private_text;
  $("#packages").innerHTML = (data.packages || [])
    .map(
      (p) => `
      <article class="card package reveal${p.featured ? " package--featured" : ""}">
        ${p.featured ? '<span class="badge badge--hot" style="align-self:start;margin-bottom:12px">הכי מבוקש</span>' : ""}
        <h3>${esc(p.name)}</h3>
        <span class="muted">${esc(p.guests)}</span>
        <div class="package__price">${formatPrice(p.price_per_person)} <small>לאדם</small></div>
        <ul>${(p.features || []).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
        <a class="btn ${p.featured ? "btn--primary" : "btn--ghost"}" style="margin-top:auto" href="contact.html?occasion=${encodeURIComponent("אירוע פרטי")}&event=${encodeURIComponent(p.name)}">לקבלת הצעה</a>
      </article>`
    )
    .join("");

  $("#only-available").addEventListener("click", (e) => {
    onlyAvailable = !onlyAvailable;
    e.currentTarget.setAttribute("aria-pressed", String(onlyAvailable));
    render();
  });

  render();
})();
