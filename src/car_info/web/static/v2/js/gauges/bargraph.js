import { fmtInt } from "../items.js";
import { MAX_RPM, RED_RPM, rpmOf, zoneColor } from "./common.js";

const SEGMENTS = 32;                   // 棒の数
const STEP_RPM = MAX_RPM / SEGMENTS;   // 1本あたりの回転数(250rpm)
const PEAK_HOLD_MS = 1500;             // 最高回転の位置を残す時間 [ミリ秒]

// 棒を並べる範囲(SVG内の座標)
const LEFT = 30;
const WIDTH = 300;
const BOTTOM = 300;
const MIN_H = 24;   // 左端の棒の高さ
const MAX_H = 150;  // 右端の棒の高さ

const xOf = (rpm) => LEFT + (rpm / MAX_RPM) * WIDTH;

function buildSvg() {
  const pitch = WIDTH / SEGMENTS;
  const barW = pitch * 0.7;

  // 右肩上がりの棒
  const bars = Array.from({ length: SEGMENTS }, (_, i) => {
    const h = MIN_H + (MAX_H - MIN_H) * (i / (SEGMENTS - 1));
    const x = LEFT + i * pitch;
    return `<rect class="bar-seg" x="${x.toFixed(1)}" y="${(BOTTOM - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"></rect>`;
  }).join("");

  // 目盛りの数字(×1000rpm)
  const labels = Array.from({ length: 9 }, (_, k) => {
    const red = k * 1000 > RED_RPM ? ' class="bar-red"' : "";
    return `<text x="${xOf(k * 1000).toFixed(1)}" y="328"${red}>${k}</text>`;
  }).join("");

  return `
    <svg viewBox="0 0 360 360" role="img" aria-label="回転数メーター(バーグラフ)">
      <text class="bar-rpm num" x="180" y="70">--</text>
      <text class="bar-unit" x="180" y="112">r/min</text>
      ${bars}
      <line class="bar-redline" x1="${xOf(RED_RPM).toFixed(1)}" y1="310" x2="${xOf(MAX_RPM).toFixed(1)}" y2="310"></line>
      <g class="bar-scale">${labels}</g>
    </svg>`;
}

export default {
  id: "bargraph",
  name: "バーグラフ",
  css: "/static/v2/css/gauge-bargraph.css",

  mount(container) {
    const el = document.createElement("div");
    el.className = "gauge-bargraph";
    el.innerHTML = buildSvg();
    container.appendChild(el);

    const segs = [...el.querySelectorAll(".bar-seg")];
    const rpmText = el.querySelector(".bar-rpm");
    let peak = 0;
    let peakAt = 0;

    return {
      update(d) {
        const rpm = rpmOf(d);

        // 最高回転の位置を一定時間残す(ピークホールド)
        const now = Date.now();
        if (rpm >= peak || now - peakAt > PEAK_HOLD_MS) {
          peak = rpm;
          peakAt = now;
        }

        const lit = Math.ceil(rpm / STEP_RPM);
        const peakIndex = Math.ceil(peak / STEP_RPM) - 1;
        segs.forEach((seg, i) => {
          const on = i < lit;
          seg.style.fill = on ? zoneColor(i * STEP_RPM) : "";
          seg.classList.toggle("is-peak", !on && i === peakIndex);
        });

        rpmText.textContent = fmtInt(d.RPM);
      },
    };
  },
};