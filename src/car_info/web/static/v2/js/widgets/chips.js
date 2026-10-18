import { ITEMS, formatItem } from "../items.js";

// 部品:項目キーの一覧から、小さな数値表示を横に並べる
export function createChips(keys) {
  const el = document.createElement("div");
  el.className = "chips";

  const parts = keys.map((key) => {
    const item = ITEMS[key];
    const chip = document.createElement("div");
    chip.className = "chip";
    if (item.onTap) {
      chip.classList.add("is-tappable");
      chip.setAttribute("role", "button");
      chip.tabIndex = 0;
      chip.addEventListener("click", item.onTap);
    }
    chip.innerHTML = `
      <span class="chip-label">${item.label}</span>
      <span class="chip-line"><span class="chip-value num">--</span><span class="chip-unit"></span></span>`;
    el.appendChild(chip);
    return { key, item, value: chip.querySelector(".chip-value"), unit: chip.querySelector(".chip-unit") };
  });

  function update(d) {
    if (!d) return;
    for (const p of parts) {
      const v = d[p.key];
      p.value.textContent = formatItem(p.key, v);
      p.value.style.color = p.item.tone ? p.item.tone(v, d) : "";
      const note = p.item.note ? p.item.note(d) : "";
      p.unit.textContent = note ? `${p.item.unit}・${note}` : p.item.unit;
    }
  }

  return { el, update };
}