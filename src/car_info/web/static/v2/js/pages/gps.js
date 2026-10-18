import { fmt } from "../items.js";

const DIRECTIONS = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
const MIN_SPEED_FOR_DIFF = 10;  // これ未満の速度では、OBDとの差を計算しない [km/h]
const MIN_SPEED_FOR_COURSE = 3; // これ未満では進行方向が定まらないので表示しない [km/h]

// 測位の状態(表示する文字と色)
function statusOf(d) {
  if (!d.gps_status) return { text: "--", color: "var(--bad)" };
  if (d.gps_status === "未接続") return { text: "未接続", color: "var(--bad)" };
  if (d.gps_status === "受信なし") return { text: "データなし", color: "var(--bad)" };
  if (d.gps_status === "エラー") return { text: "エラー", color: "var(--bad)" };
  if (!d.gps_fix) return { text: "測位待ち", color: "var(--mid)" };
  return { text: "測位中", color: "var(--good)" };
}

// 測位精度(HDOP。小さいほど良い)
function hdopText(h) {
  if (h === null || h === undefined) return "--";
  const level = h <= 1 ? "非常に良い" : h <= 2 ? "良い" : h <= 5 ? "普通" : "悪い";
  return `${h.toFixed(1)}(${level})`;
}

// GPS時刻(UTC)→ 日本時間
function jst(iso) {
  if (!iso) return { time: "--:--:--", date: "" };
  const t = new Date(iso);
  return {
    time: t.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false }),
    date: t.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }),
  };
}

function signed(v, digits) {
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;
}

export default {
  id: "gps",
  title: "GPS",
  css: "/static/v2/css/gps.css",

  mount(el) {
    el.classList.add("gps");
    el.innerHTML = `
      <h1 class="label">GPS</h1>
      <div class="cells gps-cells">
        <div class="cell">
          <div class="cell-label">測位状態</div>
          <div class="cell-line"><span class="cell-value gps-status">--</span></div>
          <div class="cell-sub">衛星 <span class="num gps-sats">--</span>・精度 <span class="num gps-hdop">--</span></div>
        </div>
        <div class="cell">
          <div class="cell-label">GPS速度</div>
          <div class="cell-line"><span class="cell-value num gps-speed">--</span><span class="cell-unit num">km/h</span></div>
          <div class="cell-sub">OBDとの差 <span class="num gps-diff">--</span></div>
        </div>
        <div class="cell">
          <div class="cell-label">進行方向</div>
          <div class="cell-line gps-heading">
            <svg class="gps-compass" viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="20" cy="20" r="18"></circle>
              <path class="gps-needle" d="M20 5 L26 25 L20 21 L14 25 Z"></path>
            </svg>
            <span class="cell-value gps-dir">--</span>
          </div>
          <div class="cell-sub"><span class="num gps-course">--</span>°(北が0°)</div>
        </div>
        <div class="cell">
          <div class="cell-label">位置</div>
          <div class="cell-text num gps-lat">--</div>
          <div class="cell-text num gps-lon">--</div>
        </div>
        <div class="cell">
          <div class="cell-label">高度</div>
          <div class="cell-line"><span class="cell-value num gps-alt">--</span><span class="cell-unit num">m</span></div>
        </div>
        <div class="cell">
          <div class="cell-label">GPS時刻(日本時間)</div>
          <div class="cell-line"><span class="cell-value num gps-time">--:--:--</span></div>
          <div class="cell-sub num gps-date"></div>
        </div>
      </div>`;

    const q = (s) => el.querySelector(s);
    const needle = q(".gps-needle");

    return {
      update(d) {
        if (!d) return;
        const fix = !!d.gps_fix;

        const st = statusOf(d);
        q(".gps-status").textContent = st.text;
        q(".gps-status").style.color = st.color;
        q(".gps-sats").textContent = d.gps_sats ?? "--";
        q(".gps-hdop").textContent = hdopText(d.gps_hdop);

        // GPS速度と、OBDの速度との差(OBD − GPS)
        q(".gps-speed").textContent = fix ? fmt(d.gps_speed, 1) : "--";
        let diff = "--";
        if (fix && d.SPEED !== undefined && d.gps_speed >= MIN_SPEED_FOR_DIFF) {
          const delta = d.SPEED - d.gps_speed;
          diff = `${signed(delta, 1)} km/h(${signed((delta / d.gps_speed) * 100, 1)}%)`;
        }
        q(".gps-diff").textContent = diff;

        // 進行方向
        if (fix && d.gps_course !== null && d.gps_course !== undefined && d.gps_speed >= MIN_SPEED_FOR_COURSE) {
          needle.style.transform = `rotate(${d.gps_course}deg)`;
          q(".gps-dir").textContent = DIRECTIONS[Math.round(d.gps_course / 45) % 8];
          q(".gps-course").textContent = Math.round(d.gps_course);
        } else {
          q(".gps-dir").textContent = "--";
          q(".gps-course").textContent = "--";
        }

        // 位置・高度・時刻
        q(".gps-lat").textContent = fix ? `${d.gps_lat >= 0 ? "北緯" : "南緯"} ${Math.abs(d.gps_lat).toFixed(6)}` : "--";
        q(".gps-lon").textContent = fix ? `${d.gps_lon >= 0 ? "東経" : "西経"} ${Math.abs(d.gps_lon).toFixed(6)}` : "--";
        q(".gps-alt").textContent = fmt(d.gps_alt, 0);
        const t = jst(d.gps_time);
        q(".gps-time").textContent = t.time;
        q(".gps-date").textContent = t.date;
      },
    };
  },
};