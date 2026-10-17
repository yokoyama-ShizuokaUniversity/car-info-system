import { fmtInt } from "../items.js";
import { RED_RPM, angleOf, arcPath, polar, rpmOf } from "./common.js";

function line(r1, r2, deg) {
  const [x1, y1] = polar(r1, deg);
  const [x2, y2] = polar(r2, deg);
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"></line>`;
}

function buildSvg() {
  const majors = [];
  const minors = [];
  const labels = [];
  for (let k = 0; k <= 8; k++) {
    const deg = -120 + k * 30;
    majors.push(line(140, 122, deg));
    if (k < 8) minors.push(line(140, 132, deg + 15));
    const [x, y] = polar(104, deg);
    const red = k * 1000 > RED_RPM ? ' class="needle-red"' : "";
    labels.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}"${red}>${k}</text>`);
  }

  return `
    <svg viewBox="0 0 360 360" role="img" aria-label="回転数メーター(針)">
      <path class="needle-track" d="${arcPath(152, -120, 120)}"></path>
      <path class="needle-redzone" d="${arcPath(152, angleOf(RED_RPM), 120)}"></path>
      <path class="needle-arc"></path>
      <g class="needle-minor">${minors.join("")}</g>
      <g class="needle-major">${majors.join("")}</g>
      <g class="needle-labels">${labels.join("")}</g>
      <text class="needle-rpm num" x="180" y="238">--</text>
      <text class="needle-unit" x="180" y="300">×1000 r/min</text>
      <line class="needle-pointer" x1="180" y1="196" x2="180" y2="58"></line>
      <circle class="needle-hub" cx="180" cy="180" r="9"></circle>
    </svg>`;
}

export default {
  id: "needle",
  name: "針",
  css: "/static/v2/css/gauge-needle.css",

  mount(container) {
    const el = document.createElement("div");
    el.className = "gauge-needle";
    el.innerHTML = buildSvg();
    container.appendChild(el);

    const arc = el.querySelector(".needle-arc");
    const pointer = el.querySelector(".needle-pointer");
    const rpmText = el.querySelector(".needle-rpm");

    return {
      update(d) {
        const rpm = rpmOf(d);
        const deg = angleOf(rpm);
        arc.style.display = rpm < 30 ? "none" : "";
        arc.setAttribute("d", arcPath(152, -120, deg));
        pointer.style.transform = `rotate(${deg.toFixed(1)}deg)`;
        el.classList.toggle("is-hot", rpm >= RED_RPM);
        rpmText.textContent = fmtInt(d.RPM);
      },
    };
  },
};