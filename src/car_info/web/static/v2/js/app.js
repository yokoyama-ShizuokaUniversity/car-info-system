import { connect, subscribe, status } from "./data.js";
import { fmt } from "./items.js";
import meter from "./pages/meter.js";

// 表示するページ(左から順)。ページを増やすときは pages/ に作ってここに追加する
const PAGES = [meter];

const STALE_MS = 5000; // OBDの値がこの時間更新されなければ「停止中」とみなす
const CHARGE_VOLT = 13.5;
const $ = (id) => document.getElementById(id);

// ページを並べ、ページ位置の点を作る
function mountPages() {
  const pager = $("pager");
  const dots = $("dots");
  const views = PAGES.map((page) => {
    // ページ専用のCSSを読み込む(1つでも複数でも可)
    for (const href of [].concat(page.css || [])) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }

    const section = document.createElement("section");
    section.className = "page";
    section.setAttribute("aria-label", page.title);
    pager.appendChild(section);

    const dot = document.createElement("span");
    dot.className = "dot";
    dots.appendChild(dot);

    return page.mount(section);
  });

  dots.firstChild?.classList.add("active");
  pager.addEventListener("scroll", () => {
    const index = Math.round(pager.scrollLeft / pager.clientWidth);
    [...dots.children].forEach((dot, i) => dot.classList.toggle("active", i === index));
  }, { passive: true });

  return views;
}

// GPSの状態(表示する文字と点の色)
function gpsStatus(d) {
  if (status.sseDown || !d || !d.gps_status) return { text: "GPS --", level: "bad" };
  if (d.gps_status === "未接続") return { text: "GPS未接続", level: "bad" };
  if (d.gps_status === "受信なし") return { text: "GPSデータなし", level: "bad" };
  if (!d.gps_fix) return { text: "GPS測位待ち", level: "wait" };
  return { text: `GPS測位中(衛星${d.gps_sats ?? "--"})`, level: "ok" };
}

// 下端の帯(接続状態・区間距離)
function updateFooter(d) {
  const stale = Date.now() - status.lastObdChange > STALE_MS;
  let text;
  let ok = false;
  if (status.sseDown) text = "ラズパイと通信できません";
  else if (!d || d.obd_status !== "接続中") text = "OBD未接続";
  else if (stale) text = "データ停止中";
  else { text = "OBD接続中"; ok = true; }
  $("status-text").textContent = text;
  $("status-dot").classList.toggle("ok", ok);
  if (d) $("trip").textContent = fmt(d.trip_km, 1);
  if (d) $("volt").textContent = fmt(d.CONTROL_MODULE_VOLTAGE, 1);
  const charging = !!d && d.RPM > 0 && d.CONTROL_MODULE_VOLTAGE >= CHARGE_VOLT;
  $("charge-icon").classList.toggle("on", charging);
  const gps = gpsStatus(d);
  $("gps-text").textContent = gps.text;
  $("gps-dot").classList.toggle("ok", gps.level === "ok");
  $("gps-dot").classList.toggle("wait", gps.level === "wait");
}

function tick() {
  const now = new Date();
  $("clock").textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
  updateFooter(status.lastData);
}

// タップで全画面表示・横向き固定
document.addEventListener("click", () => {
  if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  document.documentElement.requestFullscreen()
    .then(() => screen.orientation?.lock?.("landscape"))
    .catch(() => {});
});

const views = mountPages();
subscribe((d) => {
  views.forEach((view) => view.update(d));
  updateFooter(d);
});
connect();
tick();
setInterval(tick, 1000);

// 想定(915×412、約2.2:1)と大きく違う縦横比のときにお知らせを出す
const EXPECTED_RATIO = 915 / 412;
function checkAspect() {
  const ratio = window.innerWidth / window.innerHeight;
  $("aspect-note").hidden = ratio > EXPECTED_RATIO * 0.8 && ratio < EXPECTED_RATIO * 1.25;
}
window.addEventListener("resize", checkAspect);
checkAspect();