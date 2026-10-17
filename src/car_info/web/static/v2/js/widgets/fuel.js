import { fmt, isEmpty } from "../items.js";

const SMOOTH = 0.4;          // 表示のなめらかさ(1で平滑化なし、小さいほどなめらか)
const MAX_KMPL = 50;         // バーの右端 [km/L]
const MAX_SHOWN = 99.9;     // 数字の上限(燃料カット中もこの値)
const DIGITS = 4;            // 「999.9」の文字数
const FIGURE_SPACE = "\u2007"; // 数字と同じ幅の空白

// 999.9 と同じ幅になるよう、左側を数字幅の空白で埋める
function fixedWidth(text) {
  return text.padStart(DIGITS, FIGURE_SPACE);
}

function colorFor(kmpl) {
  if (kmpl < 15) return "var(--bad)";
  if (kmpl < 25) return "var(--mid)";
  return "var(--good)";
}

// 部品:瞬間燃費の大きな数字とバー(0・25・50km/L)
export function createFuelGauge() {
  const el = document.createElement("div");
  el.className = "fuel";
  el.innerHTML = `
    <div class="fuel-label">瞬間燃費</div>
    <div class="fuel-line">
      <span class="fuel-value num">${fixedWidth("--.-")}</span>
      <span class="fuel-unit num">km/L</span>
      <span class="fuel-cut" hidden>燃料カット中</span>
    </div>
    <div class="fuel-bar"><div class="fuel-fill"></div></div>
    <div class="fuel-scale num" aria-hidden="true"><span>0</span><span>25</span><span>50</span></div>`;

  const label = el.querySelector(".fuel-label");
  const value = el.querySelector(".fuel-value");
  const unit = el.querySelector(".fuel-unit");
  const cut = el.querySelector(".fuel-cut");
  const fill = el.querySelector(".fuel-fill");
  let shown = null;

  function setBar(kmpl, color) {
    fill.style.width = Math.max(0, Math.min(100, (kmpl / MAX_KMPL) * 100)) + "%";
    fill.style.backgroundColor = color;
  }

  function update(d) {
    if (!d) return;
    const isCut = d.fuel_mode === "fuel_cut";
    cut.hidden = !isCut;
    label.textContent = "瞬間燃費";
    unit.textContent = "km/L";

    if (isCut) {
      // 燃料カット中は上限値を表示(平滑化はせず、すぐに切り替える)
      value.textContent = fixedWidth(MAX_SHOWN.toFixed(1));
      setBar(MAX_KMPL, "var(--good)");
      shown = null;
      return;
    }

    if (isEmpty(d.fuel_kmpl)) {
      // 停車中は燃費の代わりに燃料消費を表示(データがなければ --)
      const stopped = !isEmpty(d.fuel_lph);
      if (stopped) {
        label.textContent = "燃料消費(停車中)";
        unit.textContent = "L/h";
      }
      value.textContent = fixedWidth(stopped ? fmt(d.fuel_lph, 2) : "--.-");
      setBar(0, "var(--good)");
      shown = null;
      return;
    }

    const target = Math.min(d.fuel_kmpl, MAX_SHOWN);
    shown = shown === null ? target : shown + (target - shown) * SMOOTH;
    value.textContent = fixedWidth(shown.toFixed(1));
    setBar(shown, colorFor(shown));
  }

  return { el, update };
}