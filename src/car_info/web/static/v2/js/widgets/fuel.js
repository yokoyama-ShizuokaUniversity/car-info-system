import { fmt, fixedWidth, isEmpty } from "../items.js";

const SMOOTH = 0.4;                     // 表示のなめらかさ(1で平滑化なし、小さいほどなめらか)
const MAX_KMPL = 50;                    // バーの右端 [km/L]
const MAX_SHOWN = 99.9;                 // 数字の上限(燃料カット中もこの値)
const DIGITS = 4;                       // 「99.9」の文字数(この幅で固定)
const TICKS = [0, 12.5, 25, 37.5, 50];  // 目盛り線の位置 [km/L]
const LABELS = [0, 25, 50];             // 数字を付ける目盛り(長い線になる)

function colorFor(kmpl) {
  if (kmpl < 15) return "var(--bad)";
  if (kmpl < 25) return "var(--mid)";
  return "var(--good)";
}

// km/L → バー上の位置 [%]
function pct(kmpl) {
  return Math.max(0, Math.min(100, (kmpl / MAX_KMPL) * 100));
}

// 部品:瞬間燃費(大きな数字)・平均燃費・バー
export function createFuelGauge() {
  const ticks = TICKS.map((v) =>
    `<span class="fuel-tick${LABELS.includes(v) ? " is-major" : ""}" style="left: ${pct(v)}%"></span>`).join("");
  const labels = LABELS.map((v) => {
    const edge = v === 0 ? " is-start" : v === MAX_KMPL ? " is-end" : "";
    return `<span class="fuel-scale-label${edge}" style="left: ${pct(v)}%">${v}</span>`;
  }).join("");

  const el = document.createElement("div");
  el.className = "fuel";
  el.innerHTML = `
    <div class="fuel-head">
      <span class="fuel-label">瞬間燃費</span>
      <span class="fuel-cut" hidden>燃料カット中</span>
    </div>
    <div class="fuel-line">
      <span class="fuel-value num">${fixedWidth("--.-", DIGITS)}</span>
      <span class="fuel-unit num">km/L</span>
      <span class="fuel-avg">
        <span class="fuel-avg-label">Avg.</span>
        <span class="fuel-avg-value num">${fixedWidth("--.-", DIGITS)}</span>
        <span class="fuel-avg-unit num">km/L</span>
      </span>
    </div>
    <div class="fuel-track">
      <div class="fuel-bar"><div class="fuel-fill"></div></div>
      <div class="fuel-avg-mark" hidden></div>
    </div>
    <div class="fuel-scale num" aria-hidden="true">${ticks}${labels}</div>`;

  const label = el.querySelector(".fuel-label");
  const value = el.querySelector(".fuel-value");
  const unit = el.querySelector(".fuel-unit");
  const cut = el.querySelector(".fuel-cut");
  const fill = el.querySelector(".fuel-fill");
  const avgValue = el.querySelector(".fuel-avg-value");
  const avgMark = el.querySelector(".fuel-avg-mark");
  let shown = null;

  function setBar(kmpl, color) {
    fill.style.width = pct(kmpl) + "%";
    fill.style.backgroundColor = color;
  }

  // 平均燃費の数字と、バー上の位置の線
  function updateAverage(d) {
    if (isEmpty(d.trip_kmpl)) {
      avgValue.textContent = fixedWidth("--.-", DIGITS);
      avgMark.hidden = true;
      return;
    }
    const avg = Math.min(d.trip_kmpl, MAX_SHOWN);
    avgValue.textContent = fixedWidth(avg.toFixed(1), DIGITS);
    avgMark.hidden = false;
    avgMark.style.left = pct(avg) + "%";
  }

  function update(d) {
    if (!d) return;
    updateAverage(d);

    const isCut = d.fuel_mode === "fuel_cut";
    cut.hidden = !isCut;
    label.textContent = "瞬間燃費";
    unit.textContent = "km/L";

    if (isCut) {
      // 燃料カット中は上限値を表示(平滑化はせず、すぐに切り替える)
      value.textContent = fixedWidth(MAX_SHOWN.toFixed(1), DIGITS);
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
      value.textContent = fixedWidth(stopped ? fmt(d.fuel_lph, 2) : "--.-", DIGITS);
      setBar(0, "var(--good)");
      shown = null;
      return;
    }

    const target = Math.min(d.fuel_kmpl, MAX_SHOWN);
    shown = shown === null ? target : shown + (target - shown) * SMOOTH;
    value.textContent = fixedWidth(shown.toFixed(1), DIGITS);
    setBar(shown, colorFor(shown));
  }

  return { el, update };
}