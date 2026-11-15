import { fmt } from "../items.js";
import { loadSetting, saveSetting } from "../settings.js";

const DIRECTIONS = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
const MIN_SPEED_FOR_DIFF = 10;
const MIN_SPEED_FOR_COURSE = 3;
const VIEW_KEY = "car-info-gps-view";
const VIEWS = ["compass", "sky"]; // 左の円(タップで切り替え)
const R = 88;                      // コンパスの半径(SVGの座標)
const SKY_R = 80;                  // 天頂図の外周(地平線)の半径。外側に方位の文字を置く
const SNR_MAX = 50;                // 信号強度の棒の最大 [dB-Hz]

function statusOf(d) {
  if (!d.gps_status) return { text: "--", color: "var(--bad)" };
  if (d.gps_status === "未接続") return { text: "未接続", color: "var(--bad)" };
  if (d.gps_status === "受信なし") return { text: "データなし", color: "var(--bad)" };
  if (d.gps_status === "エラー") return { text: "エラー", color: "var(--bad)" };
  if (!d.gps_fix) return { text: "測位待ち", color: "var(--mid)" };
  return { text: "測位中", color: "var(--good)" };
}

// 信号強度の色(強い:青 / 普通:黄 / 弱い:灰)
function snrColor(snr) {
  if (snr === null || snr === undefined) return "var(--dot-off)";
  if (snr >= 35) return "var(--good)";
  if (snr >= 20) return "var(--mid)";
  return "var(--sub)";
}

function signed(v, digits) {
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;
}

function jst(iso) {
  if (!iso) return { time: "--:--:--", date: "" };
  const t = new Date(iso);
  return {
    time: t.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false }),
    date: t.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }),
  };
}

// 目盛り(盤と一緒に回る)と方位の文字(位置だけ回り、文字は正立)
function dialSvg() {
  let s = `<circle class="gv-ring" r="${R}"></circle>`;
  for (let deg = 0; deg < 360; deg += 10) {
    const major = deg % 30 === 0;
    s += `<line class="gv-tick${major ? " is-major" : ""}" x1="0" y1="${-R}" x2="0" y2="${-R + (major ? 10 : 5)}" transform="rotate(${deg})"></line>`;
  }
  ["北", "東", "南", "西"].forEach((name, i) => {
    const rad = (i * Math.PI) / 2;
    s += `<text class="gv-cardinal${i === 0 ? " is-north" : ""}" x="${Math.round(Math.sin(rad) * (R - 24))}" y="${Math.round(-Math.cos(rad) * (R - 24))}">${name}</text>`;
  });
  return s;
}

// 天頂図の位置(中心が真上・外周が地平線。上が北)
function skyPoint(elev, az) {
  const r = SKY_R * (1 - elev / 90);
  const t = (az * Math.PI) / 180;
  return { x: Math.sin(t) * r, y: -Math.cos(t) * r };
}

export default {
  id: "gps",
  title: "GPS",
  css: "/static/v2/css/gps.css",

  mount(el) {
    el.classList.add("gps");
    el.innerHTML = `
      <h1 class="label">GPS</h1>
      <div class="gps-body">
        <button class="gps-visual" type="button" aria-label="コンパスと衛星の配置を切り替え">
          <svg class="gv-compass" viewBox="-100 -100 200 200" aria-hidden="true">
            <g class="gv-dial">${dialSvg()}</g>
            <path class="gv-pointer" d="M0 -99 L6 -89 L-6 -89 Z"></path>
            <text class="gv-dir" x="0" y="2">--</text>
            <text class="gv-deg num" x="0" y="30">--°</text>
          </svg>
          <svg class="gv-sky" viewBox="-100 -100 200 200" aria-hidden="true">
            <circle class="gv-ring" r="${SKY_R}"></circle>
            <circle class="gv-ring is-inner" r="${(SKY_R * 2) / 3}"></circle>
            <circle class="gv-ring is-inner" r="${SKY_R / 3}"></circle>
            <line class="gv-axis" x1="${-SKY_R}" y1="0" x2="${SKY_R}" y2="0"></line>
            <line class="gv-axis" x1="0" y1="${-SKY_R}" x2="0" y2="${SKY_R}"></line>
            <text class="gv-sky-label is-north" x="0" y="-93">北</text>
            <text class="gv-sky-label" x="93" y="0">東</text>
            <text class="gv-sky-label" x="0" y="93">南</text>
            <text class="gv-sky-label" x="-93" y="0">西</text>
            <text class="gv-elev num" x="3" y="${-(SKY_R * 2) / 3 + 7}">30°</text>
            <text class="gv-elev num" x="3" y="${-SKY_R / 3 + 7}">60°</text>
            <g class="gv-sats"></g>
          </svg>
          <span class="gv-caption"><span class="gv-status">--</span>・<span class="num gv-count">--</span></span>
        </button>

        <div class="gps-right">
          <div class="gps-panes">
            <section class="gps-pane">
              <div class="cells gps-cells">
                <div class="cell">
                  <div class="cell-label">GPS速度</div>
                  <div class="cell-line"><span class="cell-value num gps-speed">--</span><span class="cell-unit num">km/h</span></div>
                  <div class="cell-sub">OBDとの差 <span class="num gps-diff">--</span></div>
                </div>
                <div class="cell">
                  <div class="cell-label">GPS時刻(日本時間)</div>
                  <div class="cell-line"><span class="cell-value num gps-time">--:--:--</span></div>
                  <div class="cell-sub num gps-date"></div>
                </div>
                <div class="cell">
                  <div class="cell-label">位置</div>
                  <div class="cell-text num gps-lat">--</div>
                  <div class="cell-text num gps-lon">--</div>
                </div>
                <div class="cell">
                  <div class="cell-label">高度</div>
                  <div class="cell-line"><span class="cell-value num gps-alt">--</span><span class="cell-unit num">m</span></div>
                  <div class="cell-sub">精度 <span class="num gps-hdop">--</span></div>
                </div>
              </div>
            </section>
            <section class="gps-pane">
              <div class="gps-snr">
                <div class="gps-snr-head">
                  <span class="cell-label">衛星ごとの信号強度</span>
                  <span class="gps-snr-legend"><i class="is-used"></i>測位に使用 <i></i>未使用</span>
                </div>
                <div class="gps-bars"></div>
              </div>
            </section>
          </div>
          <div class="gps-pane-dots"><span class="active"></span><span></span></div>
        </div>
      </div>`;

    const q = (s) => el.querySelector(s);
    const visual = q(".gps-visual");
    const dial = q(".gv-dial");
    const cardinals = el.querySelectorAll(".gv-cardinal");
    const satsLayer = q(".gv-sats");
    const bars = q(".gps-bars");
    const panes = q(".gps-panes");
    const paneDots = [...el.querySelectorAll(".gps-pane-dots span")];
    let dialAngle = null;

    // 左の円:タップでコンパスと衛星の配置を切り替える
    let view = VIEWS.includes(loadSetting(VIEW_KEY, null)) ? loadSetting(VIEW_KEY, null) : "compass";
    const showView = () => { visual.dataset.view = view; };
    visual.addEventListener("click", () => {
      view = VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length];
      saveSetting(VIEW_KEY, view);
      showView();
    });
    showView();

    // 右側:縦にスワイプで切り替え(右端の印で今の位置を表示)
    panes.addEventListener("scroll", () => {
      const i = Math.round(panes.scrollTop / panes.clientHeight);
      paneDots.forEach((dot, k) => dot.classList.toggle("active", k === i));
    }, { passive: true });

    function rotateDial(course) {
      const target = -course;
      dialAngle = dialAngle === null ? target : dialAngle + (((target - dialAngle) % 360 + 540) % 360 - 180);
      dial.style.transform = `rotate(${dialAngle}deg)`;
      cardinals.forEach((t) => { t.style.transform = `rotate(${-dialAngle}deg)`; });
    }

    function drawSky(sats) {
      satsLayer.innerHTML = sats.filter((s) => s.elev !== null && s.az !== null).map((s) => {
        const p = skyPoint(s.elev, s.az);
        const color = snrColor(s.snr);
        return `<circle class="gv-sat${s.used ? " is-used" : ""}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6" style="--c:${color}"></circle>
          <text class="gv-prn num" x="${(p.x + 9).toFixed(1)}" y="${(p.y - 7).toFixed(1)}">${s.prn}</text>`;
      }).join("");
    }

    function drawBars(sats) {
      const sorted = [...sats].sort((a, b) => a.prn - b.prn);
      bars.innerHTML = sorted.map((s) => {
        const h = Math.min(100, ((s.snr ?? 0) / SNR_MAX) * 100);
        return `<div class="gps-bar${s.used ? " is-used" : ""}" style="--c:${snrColor(s.snr)}">
            <span class="gps-bar-value num">${s.snr ?? "--"}</span>
            <span class="gps-bar-track"><span class="gps-bar-fill" style="height:${h}%"></span></span>
            <span class="gps-bar-prn num">${s.prn}</span>
          </div>`;
      }).join("") || `<p class="hint">衛星の情報がありません</p>`;
    }

    return {
      update(d) {
        if (!d) return;
        const fix = !!d.gps_fix;
        const sats = d.gps_sky || [];

        // 左の円
        const st = statusOf(d);
        q(".gv-status").textContent = st.text;
        q(".gv-status").style.color = st.color;
        q(".gv-count").textContent = `使用${sats.filter((s) => s.used).length}/受信${sats.length}`;
        if (fix && d.gps_course !== null && d.gps_course !== undefined && d.gps_speed >= MIN_SPEED_FOR_COURSE) {
          rotateDial(d.gps_course);
          q(".gv-dir").textContent = DIRECTIONS[Math.round(d.gps_course / 45) % 8];
          q(".gv-deg").textContent = `${Math.round(d.gps_course)}°`;
        }
        drawSky(sats);

        // 右側(1枚目)
        q(".gps-speed").textContent = fix ? fmt(d.gps_speed, 1) : "--";
        let diff = "--";
        if (fix && d.SPEED !== undefined && d.gps_speed >= MIN_SPEED_FOR_DIFF) {
          const delta = d.SPEED - d.gps_speed;
          diff = `${signed(delta, 1)} km/h(${signed((delta / d.gps_speed) * 100, 1)}%)`;
        }
        q(".gps-diff").textContent = diff;
        const t = jst(d.gps_time);
        q(".gps-time").textContent = t.time;
        q(".gps-date").textContent = t.date;
        q(".gps-lat").textContent = fix ? `${d.gps_lat >= 0 ? "北緯" : "南緯"} ${Math.abs(d.gps_lat).toFixed(6)}` : "--";
        q(".gps-lon").textContent = fix ? `${d.gps_lon >= 0 ? "東経" : "西経"} ${Math.abs(d.gps_lon).toFixed(6)}` : "--";
        q(".gps-alt").textContent = fmt(d.gps_alt, 0);
        q(".gps-hdop").textContent = fmt(d.gps_hdop, 1);

        // 右側(2枚目)
        drawBars(sats);
      },
    };
  },
};
