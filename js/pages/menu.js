import { initLayout } from "../lib/layout.js";
import { loadSheet, parseTags, tagLabel, isTruthy, originLabel } from "../lib/sheets.js";
import { openStatus, renderHoursList } from "../lib/hours.js";
import { $, $$, esc, formatPrice } from "../lib/dom.js";

const state = { items: [], query: "", filters: new Set(), hideSoldOut: false };

const slug = (text, i) => `cat-${i}-${String(text).replace(/\s+/g, "-")}`;

function highlight(text, query) {
  const safe = esc(text);
  if (!query) return safe;
  const pattern = new RegExp(`(${esc(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return safe.replace(pattern, "<mark>$1</mark>");
}

function groupByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }
  return groups;
}

function matches(item) {
  if (state.hideSoldOut && !item.available) return false;
  for (const f of state.filters) {
    // A vegan dish is also vegetarian
    if (f === "veg" ? !(item.tags.includes("veg") || item.tags.includes("vegan")) : !item.tags.includes(f)) return false;
  }
  if (state.query) {
    const hay = `${item.name} ${item.description} ${item.category}`.toLowerCase();
    if (!hay.includes(state.query.toLowerCase())) return false;
  }
  return true;
}

function renderMenu() {
  const all = groupByCategory(state.items);
  const categories = [...all.keys()];
  const visible = state.items.filter(matches);
  const groups = groupByCategory(visible);

  $("#menu-list").innerHTML = visible.length
    ? categories
        .filter((cat) => groups.has(cat))
        .map((cat) => {
          const i = categories.indexOf(cat);
          const dishes = groups.get(cat);
          return `
          <section class="menu-cat" id="${slug(cat, i)}" aria-labelledby="${slug(cat, i)}-h">
            <h2 class="menu-cat__title" id="${slug(cat, i)}-h">${esc(cat)} <span>${dishes.length} מנות</span></h2>
            ${dishes
              .map(
                (d) => `
              <article class="dish${d.available ? "" : " dish--soldout"}">
                <div class="dish__name">
                  ${highlight(d.name, state.query)}
                  ${d.tags.map((t) => `<span class="badge badge--${t}">${tagLabel(t)}</span>`).join("")}
                  ${d.available ? "" : '<span class="badge badge--soldout">אזל להיום</span>'}
                </div>
                <div class="dish__price">${formatPrice(d.price)}</div>
                ${d.description ? `<p class="dish__desc">${highlight(d.description, state.query)}</p>` : ""}
              </article>`
              )
              .join("")}
          </section>`;
        })
        .join("")
    : `<div class="empty-state"><p>לא מצאנו מנות שמתאימות לחיפוש.</p><button class="btn btn--ghost btn--sm" type="button" id="clear-filters">ניקוי סינון</button></div>`;

  $("#clear-filters")?.addEventListener("click", clearFilters);

  $("#cat-nav").innerHTML =
    categories
      .map((cat, i) => (groups.has(cat) ? `<a href="#${slug(cat, i)}" data-target="${slug(cat, i)}">${esc(cat)}</a>` : ""))
      .join("") + '<a href="#wine" data-target="wine">יינות</a>';
  watchActiveCategory();
}

function clearFilters() {
  state.query = "";
  state.filters.clear();
  state.hideSoldOut = false;
  $("#menu-search").value = "";
  $$("#menu-filters .chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
  renderMenu();
}

let observer;
function watchActiveCategory() {
  observer?.disconnect();
  const links = $$("#cat-nav a");
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((a) => a.classList.toggle("is-active", a.dataset.target === entry.target.id));
        const active = links.find((a) => a.dataset.target === entry.target.id);
        active?.scrollIntoView({ block: "nearest", inline: "center" });
      }
    },
    { rootMargin: "-35% 0px -60% 0px" }
  );
  $$(".menu-cat").forEach((s) => observer.observe(s));
}

function wireControls() {
  let debounce;
  $("#menu-search").addEventListener("input", (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.query = e.target.value.trim();
      renderMenu();
    }, 120);
  });
  $("#menu-filters").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const pressed = chip.getAttribute("aria-pressed") !== "true";
    chip.setAttribute("aria-pressed", String(pressed));
    if (chip.id === "toggle-soldout") state.hideSoldOut = pressed;
    else if (pressed) state.filters.add(chip.dataset.filter);
    else state.filters.delete(chip.dataset.filter);
    renderMenu();
  });
}

async function renderWine() {
  const result = await loadSheet("wine");
  let lastType = null;
  $("#wine-body").innerHTML = result.rows
    .map((w) => {
      const typeRow = w.type && w.type !== lastType ? `<tr class="wine-type"><td colspan="4">${esc(w.type)}</td></tr>` : "";
      lastType = w.type;
      return `${typeRow}<tr>
        <td><strong>${esc(w.name)}</strong></td>
        <td class="muted">${esc(w.winery)}${w.region ? ` · ${esc(w.region)}` : ""}</td>
        <td class="num">${formatPrice(w.glass) || "—"}</td>
        <td class="num">${formatPrice(w.bottle) || "—"}</td>
      </tr>`;
    })
    .join("");
}

async function renderAside() {
  const [specials, hours] = await Promise.all([loadSheet("specials"), loadSheet("hours")]);
  const active = specials.rows.filter((r) => isTruthy(r.active));
  $("#menu-specials").innerHTML = active.length
    ? active.map((s) => `<div class="dish" style="padding:12px 0"><div class="dish__name" style="font-size:1.05rem">${esc(s.name)}</div><div class="dish__price" style="font-size:1.05rem">${formatPrice(s.price)}</div><p class="dish__desc">${esc(s.description)}</p></div>`).join("")
    : '<p class="muted">אין מנות מיוחדות היום.</p>';

  $("#menu-hours").innerHTML = renderHoursList(hours.rows);
  const status = openStatus(hours.rows);
  if (status) {
    $("#menu-status").textContent = status.text;
    $("#menu-status").classList.add(status.open ? "status-pill--open" : "status-pill--closed");
  }
}

(async () => {
  initLayout();
  wireControls();
  renderWine();
  renderAside();

  const result = await loadSheet("menu");
  state.items = result.rows.map((r) => ({
    ...r,
    tags: parseTags(r.tags),
    available: isTruthy(r.available),
  }));

  const note = $("#menu-note");
  note.dataset.origin = result.origin;
  const when = result.updatedAt ? ` · נטען ${new Date(result.updatedAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` : "";
  note.innerHTML = `<span class="data-note__dot"></span>${esc(originLabel(result))}${when}${result.error ? ` <span title="${esc(result.error)}">(ⓘ)</span>` : ""}`;

  renderMenu();
})();
