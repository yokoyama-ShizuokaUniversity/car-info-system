import { fmt, fixedWidth, ITEMS } from "../items.js";
import { createFuelGauge } from "../widgets/fuel.js";
import { createChips } from "../widgets/chips.js";
import { createIdleIcon } from "../widgets/idle-icon.js";
import { loadSetting, saveSetting, onLongPress, openItemPicker } from "../settings.js";
import tako from "../gauges/tako.js";
import needle from "../gauges/needle.js";
import bargraph from "../gauges/bargraph.js";
import runtako from "../gauges/runtako.js";

// メーターの種類(タップで順に切り替え)。増やすときは gauges/ に作ってここに追加する
const GAUGES = [tako, needle, bargraph, runtako];
const GAUGE_KEY = "car-info-gauge";

// 右下に並べる項目(右側を長押しで変更)
const CHIPS_KEY = "car-info-v2-chips";
const CHIP_COUNTS = [2, 3, 4];
const DEFAULT_CHIPS = {
  count: 3,
  keys: ["COOLANT_TEMP", "accel_pct", "ENGINE_LOAD", "obd_cycle_sec"],
};

function loadChips() {
  const saved = loadSetting(CHIPS_KEY, {});
  const count = CHIP_COUNTS.includes(saved.count) ? saved.count : DEFAULT_CHIPS.count;
  const keys = DEFAULT_CHIPS.keys.map((def, i) =>
    saved.keys && ITEMS[saved.keys[i]] ? saved.keys[i] : def);
  return { count, keys };
}

export default {
  id: "meter",
  title: "メーター",
  css: ["/static/v2/css/meter.css", ...GAUGES.map((g) => g.css)],

  mount(el) {
    el.classList.add("meter");
    el.innerHTML = `
      <button class="meter-gauge" type="button" aria-label="メーターの種類を切り替え"></button>
      <div class="meter-side"></div>`;
    const side = el.querySelector(".meter-side");
    let last = null;

    // ---- 右側:速度(小さめ)・瞬間燃費(大きめ)・小さな数値表示 ----
    const speedRow = document.createElement("div");
    speedRow.className = "meter-speed";
    speedRow.innerHTML = `
      <div class="meter-speed-left">
        <div class="meter-speed-line">
          <span class="label">速度</span>
          <span class="meter-speed-value num">${fixedWidth("--", 3)}</span>
          <span class="meter-speed-unit num">km/h</span>
        </div>
        <span class="meter-gps">
          <span class="meter-gps-label">GPS</span>
          <span class="meter-gps-value num">${fixedWidth("--", 3)}</span>
          <span class="meter-gps-unit num">km/h</span>
        </span>
      </div>
      <div class="meter-speed-right">
        <span class="meter-volt">
          <span class="meter-volt-label">車両電圧</span>
          <span class="meter-volt-value num">${fixedWidth("--.-", 4)}</span>
          <span class="meter-volt-unit num">V</span>
        </span>
      </div>`;
    const idle = createIdleIcon();
    speedRow.querySelector(".meter-speed-right").appendChild(idle.el);
    const fuel = createFuelGauge();
    let chipSetting = loadChips();
    let chips = createChips(chipSetting.keys.slice(0, chipSetting.count));
    side.append(speedRow, fuel.el, chips.el);
    const speedValue = el.querySelector(".meter-speed-value");
    const gpsValue = el.querySelector(".meter-gps-value");
    const voltValue = el.querySelector(".meter-volt-value");
    function rebuildChips(next) {
      chipSetting = next;
      saveSetting(CHIPS_KEY, next);
      const fresh = createChips(next.keys.slice(0, next.count));
      chips.el.replaceWith(fresh.el);
      chips = fresh;
      if (last) chips.update(last);
    }

    onLongPress(side, () => openItemPicker({
      title: "右下に並べる項目",
      counts: CHIP_COUNTS,
      value: chipSetting,
      onChange: rebuildChips,
    }));

    // ---- 左側:メーター(タップで種類を切り替え) ----
    const gaugeBox = el.querySelector(".meter-gauge");
    let index = Math.max(0, GAUGES.findIndex((g) => g.id === loadSetting(GAUGE_KEY, null)));
    let gauge = null;

    function showGauge() {
      gauge?.destroy?.(); // 前のメーターのアニメーションを止める
      gaugeBox.replaceChildren();
      gauge = GAUGES[index].mount(gaugeBox);
      if (last) gauge.update(last);
    }
    gaugeBox.addEventListener("click", () => {
      index = (index + 1) % GAUGES.length;
      saveSetting(GAUGE_KEY, GAUGES[index].id);
      showGauge();
    });
    showGauge();

    return {
      update(d) {
        if (!d) return;
        last = d;
        gauge.update(d);
        speedValue.textContent = fixedWidth(fmt(d.SPEED, 0), 3);
        gpsValue.textContent = fixedWidth(d.gps_fix ? fmt(d.gps_speed, 0) : "--", 3);
        voltValue.textContent = fixedWidth(fmt(d.CONTROL_MODULE_VOLTAGE, 1), 4);
        idle.update(d);
        fuel.update(d);
        chips.update(d);
      },
    };
  },
};