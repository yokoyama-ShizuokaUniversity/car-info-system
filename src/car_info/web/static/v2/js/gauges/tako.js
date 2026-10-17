import { fmtInt } from "../items.js";
import { bodyColor } from "./tako-color.js";
import { RED_RPM, angleOf, arcPath, polar, rpmOf } from "./common.js";

// 上向きに伸びる足1本の形(これを回転させて8本並べる)
const LEG_PATH = "M 170 142 C 168 122 182 112 176 96 C 170 82 168 70 178 60 C 183 55 190 54 192 58 C 193 61 189 62 186 60 C 181 64 180 72 184 84 C 189 98 194 114 190 142 Z";

function buildSvg() {
  const labels = Array.from({ length: 9 }, (_, k) => {
    const [x, y] = polar(160, -120 + k * 30);
    const red = k * 1000 > RED_RPM ? ' class="tako-red"' : "";
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}"${red}>${k}</text>`;
  }).join("");

  const legs = Array.from({ length: 8 }, (_, k) => `
    <g transform="rotate(${-105 + k * 30} 180 180)">
      <path class="tako-leg" d="${LEG_PATH}"></path>
      <circle class="tako-sucker" cx="186" cy="120" r="2.4"></circle>
      <circle class="tako-sucker" cx="182" cy="100" r="2.1"></circle>
      <circle class="tako-sucker" cx="181" cy="80" r="1.8"></circle>
    </g>`).join("");

  return `
    <svg viewBox="0 0 360 360" role="img" aria-label="回転数メーター(タコ)">
      <path class="tako-track" d="${arcPath(140, -120, 120)}"></path>
      <path class="tako-redzone" d="${arcPath(140, angleOf(RED_RPM), 120)}"></path>
      <path class="tako-arc"></path>
      <g class="tako-labels">${labels}</g>
      ${legs}
      <circle class="tako-head" cx="180" cy="180" r="50"></circle>
      <ellipse class="tako-cheek" cx="156" cy="196" rx="7" ry="4"></ellipse>
      <ellipse class="tako-cheek" cx="204" cy="196" rx="7" ry="4"></ellipse>
      <g class="tako-eyes">
        <ellipse class="tako-eye-white" cx="166" cy="176" rx="9" ry="11"></ellipse>
        <ellipse class="tako-eye-white" cx="194" cy="176" rx="9" ry="11"></ellipse>
        <circle class="tako-pupil" cx="166" cy="176" r="4.5"></circle>
        <circle class="tako-pupil" cx="194" cy="176" r="4.5"></circle>
      </g>
      <path class="tako-hot" d="M 158 170 L 168 177 L 158 184"></path>
      <path class="tako-hot" d="M 202 170 L 192 177 L 202 184"></path>
      <path class="tako-sleep" d="M 158 177 Q 166 184 174 177"></path>
      <path class="tako-sleep" d="M 186 177 Q 194 184 202 177"></path>
      <ellipse class="tako-mouth" cx="180" cy="200" rx="6" ry="5"></ellipse>
      <path class="tako-steam" d="M 164 124 C 158 118 170 112 164 106 C 159 101 166 97 164 94"></path>
      <path class="tako-steam" d="M 180 122 C 174 116 186 110 180 104 C 175 99 182 95 180 92"></path>
      <path class="tako-steam" d="M 196 124 C 190 118 202 112 196 106 C 191 101 198 97 196 94"></path>
      <g class="tako-zzz">
        <text x="214" y="140" font-size="14">z</text>
        <text x="224" y="126" font-size="18">z</text>
        <text x="236" y="110" font-size="22">Z</text>
      </g>
      <text class="tako-rpm num" x="180" y="290">--</text>
      <text class="tako-rpm-unit" x="180" y="322">r/min</text>
    </svg>`;
}

export default {
  id: "tako",
  name: "タコ",
  css: "/static/v2/css/gauge-tako.css",

  mount(container) {
    const el = document.createElement("div");
    el.className = "gauge-tako";
    el.innerHTML = buildSvg();
    container.appendChild(el);

    const legs = [...el.querySelectorAll(".tako-leg")];
    const pupils = [...el.querySelectorAll(".tako-pupil")];
    const head = el.querySelector(".tako-head");
    const arc = el.querySelector(".tako-arc");
    const rpmText = el.querySelector(".tako-rpm");

    return {
      update(d) {
        const rpm = rpmOf(d);
        const color = bodyColor(rpm);
        const deg = angleOf(rpm);

        head.style.fill = color;
        legs.forEach((leg, k) => { leg.style.fill = rpm > k * 1000 + 100 ? color : ""; });
        arc.style.display = rpm < 30 ? "none" : "";
        arc.setAttribute("d", arcPath(140, -120, deg));
        arc.style.stroke = color;

        // 黒目を今の回転数の方向に向ける(白目からはみ出さない範囲で動かす)
        const t = (deg * Math.PI) / 180;
        const look = `translate(${(Math.sin(t) * 4).toFixed(1)}px, ${(-Math.cos(t) * 5.5).toFixed(1)}px)`;
        pupils.forEach((pupil) => { pupil.style.transform = look; });

        el.classList.toggle("is-hot", rpm >= RED_RPM);
        el.classList.toggle("is-sleep", rpm < 50); // エンジン停止中は寝ている表示
        rpmText.textContent = fmtInt(d.RPM);
      },
    };
  },
};