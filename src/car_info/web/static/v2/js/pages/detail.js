import { ITEMS, formatItem } from "../items.js";

// 詳細データのページを作る(keys は items.js のキー。4×4で16個まで)
export function createDetailPage({ id, title, keys }) {
  return {
    id,
    title,
    css: "/static/v2/css/detail.css",

    mount(el) {
      el.classList.add("detail");
      el.innerHTML = `<h1 class="label">${title}</h1><div class="cells detail-cells"></div>`;
      const grid = el.querySelector(".detail-cells");

      const parts = keys.map((key) => {
        const item = ITEMS[key];
        const valueClass = item.format === "status" ? "cell-text" : "cell-value num";
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.innerHTML = `
          <div class="cell-label">${item.label}</div>
          <div class="cell-line"><span class="${valueClass}">--</span><span class="cell-unit num">${item.unit}</span></div>`;
        if (item.onTap) {
          cell.classList.add("is-tappable");
          cell.setAttribute("role", "button");
          cell.tabIndex = 0;
          cell.addEventListener("click", item.onTap);
        }
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
}

// 1枚目:エンジン関係
export const detailEngine = createDetailPage({
  id: "detail-engine",
  title: "詳細データ(エンジン)",
  keys: [
    "COOLANT_TEMP", "INTAKE_TEMP", "INTAKE_PRESSURE", "BAROMETRIC_PRESSURE",
    "ENGINE_LOAD", "ACCELERATOR_POS_D", "THROTTLE_POS", "TIMING_ADVANCE",
    "SHORT_FUEL_TRIM_1", "LONG_FUEL_TRIM_1", "O2_B1S1", "O2_B1S2",
    "MAF", "CONTROL_MODULE_VOLTAGE", "FUEL_STATUS", "RUN_TIME",
  ],
});

// 2枚目:区間・燃料費・その他
export const detailTrip = createDetailPage({
  id: "detail-trip",
  title: "詳細データ(区間・その他)",
  keys: [
    "trip_km", "trip_fuel_l", "trip_kmpl", "trip_cost_yen",
    "cost_per_km", "fuel_price", "fuel_lph", "SPEED",
    "ACCELERATOR_POS_E", "THROTTLE_POS_B", "RELATIVE_THROTTLE_POS", "THROTTLE_ACTUATOR",
    "COMMANDED_EGR", "EGR_ERROR", "EVAPORATIVE_PURGE", "obd_cycle_sec",
  ],
});