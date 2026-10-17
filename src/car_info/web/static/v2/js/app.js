import { connect, subscribe, status } from "./data.js";
import { fmt } from "./items.js";
import meter from "./pages/meter.js";

// 表示するページ(左から順)。ページを増やすときは pages/ に作ってここに追加する
const PAGES = [meter];

const STALE_MS = 5000; // OBDの値がこの時間更新されなければ「停止中」とみなす
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