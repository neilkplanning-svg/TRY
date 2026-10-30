import { initLayout } from "../lib/layout.js";
import { loadContent } from "../lib/cms.js";
import { $, esc, sanitizeHtml, imageTag, initials, observeReveal } from "../lib/dom.js";

(async () => {
  initLayout();
  const a = await loadContent("about");

  $("#about-hero-title").textContent = a.hero_title;
  $("#about-hero-subtitle").textContent = a.hero_subtitle;
  if (a.hero_image) $("#about-hero-img").src = a.hero_image;

  $("#story-title").textContent = a.story_title;
  $("#story-body").innerHTML = sanitizeHtml(a.story);
  $("#story-media").innerHTML = imageTag(a.story_image, a.story_title);

  $("#quote").textContent = a.quote;
  $("#quote-author").textContent = a.quote_author ? `— ${a.quote_author}` : "";

  $("#timeline").innerHTML = (a.timeline || [])
    .map((t) => `<li class="reveal"><span class="timeline__year">${esc(t.year)}</span><h3>${esc(t.title)}</h3><p class="muted">${esc(t.text)}</p></li>`)
    .join("");

  $("#values-title").textContent = a.values_title;
  $("#values").innerHTML = (a.values || [])
    .map((v) => `<div class="value reveal"><h3>${esc(v.title)}</h3><p class="muted" style="margin:0">${esc(v.text)}</p></div>`)
    .join("");

  $("#team-title").textContent = a.team_title;
  $("#team").innerHTML = (a.team || [])
    .map(
      (m) => `
      <article class="card team-card reveal">
        <div class="avatar">${m.photo ? imageTag(m.photo, m.name) : `<span aria-hidden="true">${esc(initials(m.name))}</span>`}</div>
        <h3 style="margin-bottom:4px">${esc(m.name)}</h3>
        <span class="team-card__role">${esc(m.role)}</span>
        <p class="muted" style="margin:0">${esc(m.bio)}</p>
      </article>`
    )
    .join("");

  observeReveal();
})();
