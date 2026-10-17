import { isIdleReady } from "../logic/idle.js";

// 部品:アイドリングストップできそうなときだけ点く緑のアイコン
export function createIdleIcon() {
  const el = document.createElement("span");
  el.className = "idle-icon";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", "アイドリングストップ可能");
  el.innerHTML = `
    <svg viewBox="0 0 30 30" width="100%" height="100%">
      <path d="M 24.5 10 A 11 11 0 1 0 26 17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"></path>
      <path d="M 25.5 4.5 L 24.8 10.6 L 19 9.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path>
      <text x="15" y="16" fill="currentColor" font-family="Barlow Condensed, sans-serif" font-size="14" font-weight="600" text-anchor="middle" dominant-baseline="central">A</text>
    </svg>`;

  return {
    el,
    update(d) { el.classList.toggle("on", isIdleReady(d)); },
  };
}