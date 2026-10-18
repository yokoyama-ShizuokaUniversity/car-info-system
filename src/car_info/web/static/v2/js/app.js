import { connect, subscribe, status } from "./data.js";
import { fmt } from "./items.js";
import meter from "./pages/meter.js";
import gps from "./pages/gps.js";
import { detailEngine, detailTrip } from "./pages/detail.js";
import { openShutdownDialog } from "./power.js";

// 表示するページ(左から順)。ページを増やすときは pages/ に作ってここに追加する
const PAGES = [meter, gps, detailEngine, detailTrip];

const STALE_MS = 5000; // OBDの値がこの時間更新されなければ「停止中」とみなす
const $ = (id) => document.getElementById(id);

// ホームのアイコン(下端の1つ目の印)
const HOME_ICON = `
  <svg class="dot-home" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 1.5 L15 8 H12.8 V14.5 H9.6 V10.2 H6.4 V14.5 H3.2 V8 H1 Z" fill="currentColor"></path>
  </svg>`;

// 指定したページへ移動する(0がホーム)
function goToPage(index) {
  const pager = $("pager");
  pager.scrollTo({ left: index * pager.clientWidth, behavior: "smooth" });
}

// ページを並べ、下端にページ位置の印を作る(印を押すとそのページへ移動)
function mountPages() {
  const pager = $("pager");
  const dots = $("dots");

  const views = PAGES.map((page, i) => {
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

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "dot";
    dot.setAttribute("aria-label", i === 0 ? "ホームに戻る" : `${page.title}へ移動`);
    dot.innerHTML = i === 0 ? HOME_ICON : '<span class="dot-mark"></span>';
    dot.addEventListener("click", () => goToPage(i));
    dots.appendChild(dot);

    try {
      return page.mount(section);
    } catch (e) {
      // 1つのページでエラーが起きても、ほかのページは動かし続ける
      console.error(`ページ「${page.title}」の表示でエラー`, e);
      section.textContent = `「${page.title}」の表示でエラーが発生しました`;
      return { update() { } };
    }
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
    .catch(() => { });
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

// 画面を消さない(HTTPSで開いているときだけ使える)
async function keepScreenOn() {
  if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
  try {
    await navigator.wakeLock.request("screen");
  } catch (e) {
    console.warn("画面を消さない設定ができませんでした", e);
  }
}
// 別のアプリから戻ってきたときにも、かけ直す
document.addEventListener("visibilitychange", keepScreenOn);
document.addEventListener("click", keepScreenOn);
keepScreenOn();

$("power-btn").addEventListener("click", openShutdownDialog);