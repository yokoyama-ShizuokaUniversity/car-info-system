import { ITEMS, formatItem } from "../items.js";

// 詳細データのページに並べる項目(items.js のキー。4×4で16個)
const DETAIL_KEYS = [
  "COOLANT_TEMP", "INTAKE_TEMP", "INTAKE_PRESSURE", "BAROMETRIC_PRESSURE",
  "ENGINE_LOAD", "ACCELERATOR_POS_D", "THROTTLE_POS", "TIMING_ADVANCE",
  "SHORT_FUEL_TRIM_1", "LONG_FUEL_TRIM_1", "O2_B1S1", "O2_B1S2",
  "MAF", "CONTROL_MODULE_VOLTAGE", "FUEL_STATUS", "RUN_TIME",
];

export default {
  id: "detail",
  title: "詳細データ",
  css: "/static/v2/css/detail.css",

  mount(el) {
    el.classList.add("detail");
    el.innerHTML = `<h1 class="label">詳細データ</h1><div class="cells detail-cells"></div>`;
    const grid = el.querySelector(".detail-cells");

    const parts = DETAIL_KEYS.map((key) => {
      const item = ITEMS[key];
      const valueClass = item.format === "status" ? "cell-text" : "cell-value num";
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.innerHTML = `
        <div class="cell-label">${item.label}</div>
        <div class="cell-line"><span class="${valueClass}">--</span><span class="cell-unit num">${item.unit}</span></div>`;
      grid.appendChild(cell);
      return { key, item, value: cell.querySelector(".cell-line > span") };
    });

    return {
      update(d) {
        if (!d) return;
        for (const p of parts) {
          const v = d[p.key];
          p.value.textContent = formatItem(p.key, v);
          p.value.style.color = p.item.tone ? p.item.tone(v, d) : ""; // 水温の色など
        }
      },
    };
  },
};