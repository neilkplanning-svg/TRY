import { initLayout } from "../lib/layout.js";
import { loadContent } from "../lib/cms.js";
import { $, esc, imageTag } from "../lib/dom.js";

let images = [];
let shown = [];
let index = 0;
let category = "הכל";

function renderFilters(categories) {
  $("#gal-filters").innerHTML = ["הכל", ...categories]
    .map((c) => `<button class="chip" type="button" data-cat="${esc(c)}" aria-pressed="${c === category}">${esc(c)}</button>`)
    .join("");
}

function renderGrid() {
  shown = category === "הכל" ? images : images.filter((img) => img.category === category);
  $("#gallery").innerHTML = shown
    .map(
      (img, i) => `
      <button class="masonry__item" type="button" data-index="${i}" aria-label="הגדלת תמונה: ${esc(img.caption)}">
        ${imageTag(img.image, img.caption)}
        <span class="masonry__cap">${esc(img.caption)}</span>
      </button>`
    )
    .join("");
}

function show(i) {
  index = (i + shown.length) % shown.length;
  const img = shown[index];
  $("#lb-img").src = img.image;
  $("#lb-img").alt = img.caption || "";
  $("#lb-cap").textContent = `${img.caption || ""} (${index + 1}/${shown.length})`;
}

(async () => {
  initLayout();
  const data = await loadContent("gallery");
  images = data.images || [];
  $("#gal-title").textContent = data.hero_title;
  $("#gal-subtitle").textContent = data.hero_subtitle;

  const categories = data.categories?.length ? data.categories : [...new Set(images.map((i) => i.category).filter(Boolean))];
  renderFilters(categories);
  renderGrid();

  $("#gal-filters").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    category = chip.dataset.cat;
    renderFilters(categories);
    renderGrid();
  });

  const dialog = $("#lightbox");
  $("#gallery").addEventListener("click", (e) => {
    const item = e.target.closest(".masonry__item");
    if (!item) return;
    show(Number(item.dataset.index));
    dialog.showModal();
  });
  // RTL: "previous" is on the right, so the right arrow goes back
  $("#lb-prev").addEventListener("click", () => show(index - 1));
  $("#lb-next").addEventListener("click", () => show(index + 1));
  $("#lb-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target.classList.contains("lightbox__inner")) dialog.close();
  });
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(index + 1);
    if (e.key === "ArrowRight") show(index - 1);
  });

  let touchX = null;
  dialog.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
  dialog.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) show(index + (dx > 0 ? 1 : -1));
    touchX = null;
  });
})();
