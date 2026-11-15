// 部品:タコがいないメーターのときに、エコ運転の判定をアイコンで出す
const ICONS = {
  happy: {
    label: "エコな運転",
    svg: `<circle cx="15" cy="15" r="12" fill="none" stroke="currentColor" stroke-width="2.4"></circle>
      <path d="M 9 13 Q 11 10 13 13 M 17 13 Q 19 10 21 13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>
      <path d="M 9.5 18 Q 15 23.5 20.5 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>`,
  },
  harsh: {
    label: "急な操作",
    svg: `<path d="M 15 3.5 L 27 25.5 H 3 Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"></path>
      <path d="M 15 11 V 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"></path>
      <circle cx="15" cy="21.8" r="1.6" fill="currentColor"></circle>`,
  },
  cold: {
    label: "暖機中",
    svg: `<g stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
        <path d="M 15 3 V 27 M 4.6 9 L 25.4 21 M 4.6 21 L 25.4 9"></path>
        <path d="M 11.5 4.5 L 15 7.5 L 18.5 4.5 M 11.5 25.5 L 15 22.5 L 18.5 25.5"></path>
      </g>`,
  },
};

export function createEcoIcon() {
  const el = document.createElement("span");
  el.className = "eco-icon";
  el.setAttribute("role", "img");
  let shown = undefined;

  return {
    el,
    update(mood) {
      if (mood === shown) return;
      shown = mood;
      const icon = ICONS[mood];
      el.classList.toggle("on", !!icon);
      el.dataset.mood = mood || "";
      if (!icon) return; // 消すときは形を残したまま薄くする(ふわっと消える)
      el.setAttribute("aria-label", icon.label);
      el.innerHTML = `<svg viewBox="0 0 30 30" width="100%" height="100%">${icon.svg}</svg>`;
    },
  };
}
