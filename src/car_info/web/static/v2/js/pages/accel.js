import { fmt } from "../items.js";

const MAX_G = 0.6;               // 円の外周が表す加速度 [g]
const RINGS = [0.2, 0.4, 0.6];   // 同心円の目盛り [g]
const RADIUS = 90;               // 外周の半径(SVGの座標)
const TRAIL_SEC = 2;             // 軌跡を残す時間 [秒]
const SHOW_FORCE = true;         // true: 体が受ける力の向き(加速で点が下) / false: 加速度の向き(加速で点が上)

const SCALE = RADIUS / MAX_G;

function signed(v) {
  if (v === null || v === undefined) return "--";
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`;
}

// 前後G・左右G → SVG上の位置(外周を超えた分は外周に止める)
function toPoint(long, lat) {
  const sign = SHOW_FORCE ? -1 : 1;
  let x = sign * lat * SCALE;
  let y = -sign * long * SCALE;  // SVGは下が+
  const r = Math.hypot(x, y);
  if (r > RADIUS) {
    x *= RADIUS / r;
    y *= RADIUS / r;
  }
  return { x, y };
}

// センサーの状態(表示する文字と色)
function statusOf(d) {
  if (!d.accel_status) return { text: "--", color: "var(--bad)" };
  if (d.accel_status === "未接続") return { text: "未接続", color: "var(--bad)" };
  if (d.accel_status === "エラー") return { text: "エラー", color: "var(--bad)" };
  return { text: "受信中", color: "var(--good)" };
}

export default {
  id: "accel",
  title: "G計",
  css: "/static/v2/css/accel.css",

  mount(el) {
    el.classList.add("accel");
    const rings = RINGS.map((g) => `
      <circle class="accel-ring${g === MAX_G ? " is-outer" : ""}" r="${g * SCALE}"></circle>
      <text class="accel-ring-label num" x="${g * SCALE * 0.71 + 2}" y="${-g * SCALE * 0.71 - 2}">${g.toFixed(1)}</text>`).join("");

    el.innerHTML = `
      <h1 class="label">G計</h1>
      <div class="accel-body">
        <svg class="accel-meter" viewBox="-100 -100 200 200" aria-hidden="true">
          ${rings}
          <line class="accel-axis" x1="${-RADIUS}" y1="0" x2="${RADIUS}" y2="0"></line>
          <line class="accel-axis" x1="0" y1="${-RADIUS}" x2="0" y2="${RADIUS}"></line>
          <text class="accel-dir" x="0" y="-93">前</text>
          <text class="accel-dir" x="0" y="99">後</text>
          <text class="accel-dir" x="-95" y="3">左</text>
          <text class="accel-dir" x="95" y="3">右</text>
          <polyline class="accel-trail" points=""></polyline>
          <circle class="accel-dot" r="6" hidden></circle>
        </svg>
        <div class="accel-side">
          <div class="cells accel-cells">
            <div class="cell">
              <div class="cell-label">前後G</div>
              <div class="cell-line"><span class="cell-value num accel-long">--</span><span class="cell-unit num">g</span></div>
              <div class="cell-sub">加速+ / 減速−</div>
            </div>
            <div class="cell">
              <div class="cell-label">左右G</div>
              <div class="cell-line"><span class="cell-value num accel-lat">--</span><span class="cell-unit num">g</span></div>
              <div class="cell-sub">右カーブ+ / 左カーブ−</div>
            </div>
            <div class="cell">
              <div class="cell-label">合成G</div>
              <div class="cell-line"><span class="cell-value num accel-total">--</span><span class="cell-unit num">g</span></div>
            </div>
            <div class="cell">
              <div class="cell-label">最大加速</div>
              <div class="cell-line"><span class="cell-value num accel-max-acc">--</span><span class="cell-unit num">g</span></div>
            </div>
            <div class="cell">
              <div class="cell-label">最大減速</div>
              <div class="cell-line"><span class="cell-value num accel-max-brk">--</span><span class="cell-unit num">g</span></div>
            </div>
            <div class="cell">
              <div class="cell-label">最大横G</div>
              <div class="cell-line"><span class="cell-value num accel-max-lat">--</span><span class="cell-unit num">g</span></div>
              <div class="cell-sub">左 <span class="num accel-max-left">--</span>・右 <span class="num accel-max-right">--</span></div>
            </div>
          </div>
          <div class="accel-foot">
            <span class="accel-state">センサー <span class="accel-status">--</span>・<span class="accel-calib">--</span></span>
            <button class="accel-reset" type="button">ピークをリセット</button>
          </div>
        </div>
      </div>`;

    const q = (s) => el.querySelector(s);
    const dot = q(".accel-dot");
    const trailLine = q(".accel-trail");
    let trail = [];  // { t, x, y }
    let peak = { acc: 0, brk: 0, left: 0, right: 0 };

    function showPeaks() {
      q(".accel-max-acc").textContent = fmt(peak.acc, 2);
      q(".accel-max-brk").textContent = fmt(peak.brk, 2);
      q(".accel-max-lat").textContent = fmt(Math.max(peak.left, peak.right), 2);
      q(".accel-max-left").textContent = fmt(peak.left, 2);
      q(".accel-max-right").textContent = fmt(peak.right, 2);
    }

    q(".accel-reset").addEventListener("click", () => {
      peak = { acc: 0, brk: 0, left: 0, right: 0 };
      showPeaks();
    });
    showPeaks();

    return {
      update(d) {
        if (!d) return;
        const st = statusOf(d);
        q(".accel-status").textContent = st.text;
        q(".accel-status").style.color = st.color;
        q(".accel-calib").textContent = d.accel_calib ?? "--";

        const ok = d.accel_status === "受信中" && d.accel_long !== undefined && d.accel_lat !== undefined;
        if (!ok) {
          dot.setAttribute("hidden", "");
          trail = [];
          trailLine.setAttribute("points", "");
          q(".accel-long").textContent = "--";
          q(".accel-lat").textContent = "--";
          q(".accel-total").textContent = "--";
          return;
        }

        const long = d.accel_long;
        const lat = d.accel_lat;

        // 数値
        q(".accel-long").textContent = signed(long);
        q(".accel-lat").textContent = signed(lat);
        q(".accel-total").textContent = fmt(Math.hypot(long, lat), 2);

        // ピーク値
        peak.acc = Math.max(peak.acc, long);
        peak.brk = Math.max(peak.brk, -long);
        peak.right = Math.max(peak.right, lat);
        peak.left = Math.max(peak.left, -lat);
        showPeaks();

        // 点と軌跡
        const p = toPoint(long, lat);
        dot.removeAttribute("hidden");        dot.setAttribute("cx", p.x);
        dot.setAttribute("cy", p.y);
        const now = Date.now();
        trail.push({ t: now, x: p.x, y: p.y });
        trail = trail.filter((s) => now - s.t <= TRAIL_SEC * 1000);
        trailLine.setAttribute("points", trail.map((s) => `${s.x},${s.y}`).join(" "));
      },
    };
  },
};