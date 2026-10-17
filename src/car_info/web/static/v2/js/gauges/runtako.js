import { fmtInt } from "../items.js";
import { MAX_RPM, RED_RPM, rpmOf, zoneColor } from "./common.js";
import { bodyColor } from "./tako-color.js";

const RPM_PER_FPS = 250; // 250rpmごとに1秒あたり1コマ
const MAX_FPS = 32;      // コマ送りの上限
const SEGMENTS = 32;     // 下のバーの数
const STEP_RPM = MAX_RPM / SEGMENTS;
const DASH = 32;         // 地面の破線1周期の長さ(14+18)

// 走るコマ(足4本の形と、体の上下)
const FRAMES = [
  { bob: -5, legs: [
    "M 160 192 C 140 210 128 224 118 220",
    "M 175 196 C 168 216 160 232 150 236",
    "M 195 198 C 200 218 206 232 218 234",
    "M 212 194 C 230 208 244 216 254 210",
  ] },
  { bob: 2, legs: [
    "M 160 192 C 152 212 150 230 158 238",
    "M 175 196 C 174 216 172 232 178 240",
    "M 195 198 C 196 218 196 232 190 240",
    "M 212 194 C 218 214 220 230 212 238",
  ] },
  { bob: -5, legs: [
    "M 160 192 C 158 214 168 228 180 232",
    "M 175 196 C 166 214 150 224 138 220",
    "M 195 198 C 214 212 230 220 240 214",
    "M 212 194 C 214 216 206 232 196 238",
  ] },
  { bob: 2, legs: [
    "M 160 192 C 150 210 146 226 152 236",
    "M 175 196 C 178 216 182 230 190 238",
    "M 195 198 C 192 218 186 232 178 238",
    "M 212 194 C 222 212 228 226 222 236",
  ] },
];
const REST = FRAMES[1]; // 寝ているときの姿勢

function buildSvg() {
  const pitch = 320 / SEGMENTS;
  const segs = Array.from({ length: SEGMENTS }, (_, i) =>
    `<rect class="run-seg" x="${(20 + i * pitch).toFixed(1)}" y="282" width="${(pitch * 0.75).toFixed(1)}" height="16" rx="1.5"></rect>`
  ).join("");
  const labels = Array.from({ length: 9 }, (_, k) => {
    const red = k * 1000 > RED_RPM ? ' class="run-red"' : "";
    return `<text x="${20 + k * 40}" y="322"${red}>${k}</text>`;
  }).join("");
  const redX = 20 + (RED_RPM / MAX_RPM) * 320;

  return `
    <svg viewBox="0 0 360 360" role="img" aria-label="回転数メーター(走るタコ)">
      <text class="run-rpm num" x="20" y="40">--</text>
      <text class="run-unit" x="20" y="72">r/min</text>

      <line class="run-ground" x1="20" y1="252" x2="340" y2="252"></line>
      <g class="run-speedlines">
        <line x1="60" y1="140" x2="110" y2="140"></line>
        <line x1="50" y1="160" x2="100" y2="160"></line>
        <line x1="64" y1="180" x2="108" y2="180"></line>
      </g>

      <g class="run-body">
        ${REST.legs.map((p) => `<path class="run-leg" d="${p}"></path>`).join("")}
        <ellipse class="run-skirt" cx="188" cy="190" rx="40" ry="14"></ellipse>
        <ellipse class="run-mantle" cx="185" cy="150" rx="56" ry="50" transform="rotate(-18 185 150)"></ellipse>
        <ellipse class="run-cheek" cx="206" cy="180" rx="7" ry="4"></ellipse>
        <ellipse class="run-funnel" cx="232" cy="180" rx="7" ry="5"></ellipse>
        <g class="run-eye">
          <ellipse class="run-eye-white" cx="214" cy="162" rx="9" ry="11"></ellipse>
          <circle class="run-pupil" cx="217" cy="163" r="4.5"></circle>
        </g>
        <path class="run-hot-eye" d="M 208 155 L 218 162 L 208 169"></path>
        <path class="run-sleep-eye" d="M 205 162 Q 214 169 223 162"></path>
        <path class="run-sweat" d="M 132 114 C 128 120 128 126 132 126 C 136 126 136 120 132 114 Z"></path>
        <path class="run-sweat" d="M 146 96 C 142 102 142 108 146 108 C 150 108 150 102 146 96 Z"></path>
        <path class="run-steam" d="M 170 92 C 164 86 176 80 170 74 C 165 69 172 65 170 62"></path>
        <path class="run-steam" d="M 186 90 C 180 84 192 78 186 72 C 181 67 188 63 186 60"></path>
        <path class="run-steam" d="M 202 92 C 196 86 208 80 202 74 C 197 69 204 65 202 62"></path>
      </g>

      <g class="run-zzz">
        <text x="240" y="106" font-size="14">z</text>
        <text x="252" y="92" font-size="18">z</text>
        <text x="266" y="76" font-size="22">Z</text>
      </g>

      ${segs}
      <line class="run-redline" x1="${redX.toFixed(1)}" y1="304" x2="340" y2="304"></line>
      <g class="run-scale">${labels}</g>
    </svg>`;
}

export default {
  id: "runtako",
  name: "走るタコ",
  css: "/static/v2/css/gauge-runtako.css",

  mount(container) {
    const el = document.createElement("div");
    el.className = "gauge-runtako";
    el.innerHTML = buildSvg();
    container.appendChild(el);

    const body = el.querySelector(".run-body");
    const legs = [...el.querySelectorAll(".run-leg")];
    const skin = [...el.querySelectorAll(".run-mantle, .run-skirt")];
    const ground = el.querySelector(".run-ground");
    const segs = [...el.querySelectorAll(".run-seg")];
    const rpmText = el.querySelector(".run-rpm");

    let rpm = 0;
    let phase = 0;
    let shownFrame = -1;
    let lastT = performance.now();
    let raf = 0;

    // コマ送り:回転数が高いほど速くコマを進める
    function render(now) {
      const dt = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;
      const sleeping = rpm < 50;
      if (!sleeping) phase += dt * Math.min(MAX_FPS, rpm / RPM_PER_FPS);

      const index = sleeping ? 1 : Math.floor(phase) % FRAMES.length;
      if (index !== shownFrame) {
        const frame = FRAMES[index];
        body.style.transform = `translateY(${frame.bob}px)`;
        legs.forEach((leg, i) => leg.setAttribute("d", frame.legs[i]));
        shownFrame = index;
      }
      ground.style.strokeDashoffset = String(((phase / FRAMES.length) * DASH) % DASH);
      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    return {
      update(d) {
        rpm = rpmOf(d);
        const color = bodyColor(rpm);
        skin.forEach((part) => { part.style.fill = color; });
        legs.forEach((leg) => { leg.style.stroke = color; });

        const lit = Math.ceil(rpm / STEP_RPM);
        segs.forEach((seg, i) => { seg.style.fill = i < lit ? zoneColor(i * STEP_RPM) : ""; });

        el.classList.toggle("is-sleep", rpm < 50);
        el.classList.toggle("is-fast", rpm >= 4000);
        el.classList.toggle("is-sweat", rpm >= 5500);
        el.classList.toggle("is-hot", rpm >= RED_RPM);
        rpmText.textContent = fmtInt(d.RPM);
      },
      // メーターを切り替えるときにアニメーションを止める
      destroy() {
        cancelAnimationFrame(raf);
      },
    };
  },
};