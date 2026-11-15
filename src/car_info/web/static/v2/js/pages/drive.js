import { fmt } from "../items.js";

// コンパス
const DIRECTIONS = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
const MIN_SPEED_FOR_COURSE = 3; // これ未満では進行方向が定まらないので更新しない [km/h]
const DIAL_R = 88;              // 目盛り盤の半径(SVGの座標)

// G計
const MAX_G = 0.6;              // 円の外周が表す加速度 [g]
const RINGS = [0.2, 0.4, 0.6];  // 同心円の目盛り [g]
const RADIUS = 90;              // 外周の半径(SVGの座標)
const TRAIL_SEC = 2;            // 軌跡を残す時間 [秒]
const SHOW_FORCE = true;        // true: 体が受ける力の向き(加速で点が下) / false: 加速度の向き
const SCALE = RADIUS / MAX_G;

function signed(v) {
  if (v === null || v === undefined) return "--";
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`;
}

// 測位精度(HDOP。小さいほど良い)
function hdopLevel(h) {
  if (h === null || h === undefined) return "--";
  return h <= 1 ? "非常に良い" : h <= 2 ? "良い" : h <= 5 ? "普通" : "悪い";
}

// コンパスの目盛り盤(北が0°。盤ごと回転させて、進行方向を上にする)
function dialSvg() {
  let s = `<circle class="drive-dial-ring" r="${DIAL_R}"></circle>`;
  for (let deg = 0; deg < 360; deg += 10) {
    const major = deg % 30 === 0;
    const r1 = DIAL_R - (major ? 10 : 5);
    s += `<line class="drive-tick${major ? " is-major" : ""}" x1="0" y1="${-DIAL_R}" x2="0" y2="${-r1}" transform="rotate(${deg})"></line>`;
  }
  // 方位の文字は、盤が回っても常に正立させる(位置だけ盤と一緒に回る)
  ["北", "東", "南", "西"].forEach((name, i) => {
    const rad = (i * 90 * Math.PI) / 180;
    const r = DIAL_R - 24;
    const x = Math.round(Math.sin(rad) * r);
    const y = Math.round(-Math.cos(rad) * r);
    s += `<text class="drive-cardinal${i === 0 ? " is-north" : ""}" x="${x}" y="${y}">${name}</text>`;
  });
  return s;
}

// 前後G・左右G → G計の上の位置(外周を超えた分は外周に止める)
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

export default {
  id: "drive",
  title: "GPS・G計",
  css: ["/static/v2/css/accel.css", "/static/v2/css/drive.css"],  // G計の見た目はG計ページと共通

  mount(el) {
    el.classList.add("drive");
    const rings = RINGS.map((g) => `
      <circle class="accel-ring${g === MAX_G ? " is-outer" : ""}" r="${g * SCALE}"></circle>`).join("");

    el.innerHTML = `
      <h1 class="label">GPS・G計</h1>
      <div class="drive-body">
        <svg class="drive-compass" viewBox="-100 -100 200 200" aria-hidden="true">
          <g class="drive-dial">${dialSvg()}</g>
          <path class="drive-pointer" d="M0 -99 L6 -89 L-6 -89 Z"></path>
          <text class="drive-dir" x="0" y="2">--</text>
          <text class="drive-deg num" x="0" y="30">--°</text>
        </svg>
        <svg class="drive-gmeter" viewBox="-100 -100 200 200" aria-hidden="true">
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
        <div class="cells drive-cells">
          <div class="cell">
            <div class="cell-label">GPS速度</div>
            <div class="cell-line"><span class="cell-value num drive-speed">--</span><span class="cell-unit num">km/h</span></div>
            <div class="cell-sub">衛星 <span class="num drive-sats">--</span>・<span class="drive-hdop">--</span></div>
          </div>
          <div class="cell">
            <div class="cell-label">前後G</div>
            <div class="cell-line"><span class="cell-value num drive-long">--</span><span class="cell-unit num">g</span></div>
          </div>
          <div class="cell">
            <div class="cell-label">左右G</div>
            <div class="cell-line"><span class="cell-value num drive-lat">--</span><span class="cell-unit num">g</span></div>
            <div class="cell-sub drive-calib">--</div>
          </div>
        </div>
      </div>`;

    const q = (s) => el.querySelector(s);
    const dial = q(".drive-dial");
    const cardinals = el.querySelectorAll(".drive-cardinal");
    const dot = q(".accel-dot");
    const trailLine = q(".accel-trail");
    let trail = [];       // { t, x, y }
    let dialAngle = null; // 目盛り盤の回転角(359°→0°で逆回りしないよう、つなげて持つ)

    // 進行方向が上に来るように、目盛り盤を回す(近い向きに回す)
    function rotateDial(course) {
      const target = -course;
      if (dialAngle === null) {
        dialAngle = target;
      } else {
        const diff = ((target - dialAngle) % 360 + 540) % 360 - 180; // −180〜180°
        dialAngle += diff;
      }
      dial.style.transform = `rotate(${dialAngle}deg)`;
      cardinals.forEach((t) => { t.style.transform = `rotate(${-dialAngle}deg)`; });
    }

    function updateCompass(d) {
      const fix = !!d.gps_fix;
      const moving = fix && d.gps_course !== null && d.gps_course !== undefined
        && d.gps_speed >= MIN_SPEED_FOR_COURSE;
      if (moving) {
        rotateDial(d.gps_course);
        q(".drive-dir").textContent = DIRECTIONS[Math.round(d.gps_course / 45) % 8];
        q(".drive-deg").textContent = `${Math.round(d.gps_course)}°`;
      }
      // 止まっている間は最後の向きのまま、薄く表示する
      el.classList.toggle("is-stale", !moving);
      if (dialAngle === null) {
        q(".drive-dir").textContent = "--";
        q(".drive-deg").textContent = "--°";
      }

      q(".drive-speed").textContent = fix ? fmt(d.gps_speed, 0) : "--";
      q(".drive-sats").textContent = d.gps_sats ?? "--";
      q(".drive-hdop").textContent = fix ? hdopLevel(d.gps_hdop) : "測位待ち";
    }

    function updateGmeter(d) {
      q(".drive-calib").textContent = d.accel_calib ? `補正:${d.accel_calib}` : "--";
      const ok = d.accel_status === "受信中" && d.accel_long !== undefined && d.accel_lat !== undefined;
      if (!ok) {
        dot.setAttribute("hidden", "");
        trail = [];
        trailLine.setAttribute("points", "");
        q(".drive-long").textContent = "--";
        q(".drive-lat").textContent = "--";
        return;
      }
      q(".drive-long").textContent = signed(d.accel_long);
      q(".drive-lat").textContent = signed(d.accel_lat);

      const p = toPoint(d.accel_long, d.accel_lat);
      dot.removeAttribute("hidden");
      dot.setAttribute("cx", p.x);
      dot.setAttribute("cy", p.y);
      const now = Date.now();
      trail.push({ t: now, x: p.x, y: p.y });
      trail = trail.filter((s) => now - s.t <= TRAIL_SEC * 1000);
      trailLine.setAttribute("points", trail.map((s) => `${s.x},${s.y}`).join(" "));
    }

    return {
      update(d) {
        if (!d) return;
        updateCompass(d);
        updateGmeter(d);
      },
    };
  },
};