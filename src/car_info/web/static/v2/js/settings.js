import { ITEMS } from "./items.js";

// ---- 端末(ブラウザ)への保存 ----
export function loadSetting(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch (e) {
    return fallback;
  }
}

export function saveSetting(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* 保存できなくても表示は続ける */
  }
}

// ---- 長押しで処理を呼ぶ(スワイプ中は呼ばない) ----
export function onLongPress(el, fn, ms = 700) {
  let timer = null;
  const cancel = () => clearTimeout(timer);
  el.addEventListener("pointerdown", () => {
    cancel();
    timer = setTimeout(fn, ms);
  });
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
    el.addEventListener(type, cancel);
  }
  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    cancel();
    fn();
  });
}

// ---- 表示項目を選ぶ設定パネル(どのページからも使える) ----
let dialog = null;

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.className = "settings";
  dialog.innerHTML = `
    <form method="dialog">
      <h2 class="settings-title"></h2>
      <div class="field">
        <label for="set-count">表示する数</label>
        <select id="set-count"></select>
      </div>
      <div class="slots"></div>
      <p class="hint">左から順に並びます。設定はこの端末に保存されます。</p>
      <button class="close" type="submit">閉じる</button>
    </form>`;
  document.body.appendChild(dialog);
  return dialog;
}

// value: { count, keys }、counts: 選べる数の一覧、onChange: 変更のたびに新しい設定で呼ばれる
export function openItemPicker({ title, counts, value, onChange }) {
  const dlg = ensureDialog();
  if (dlg.open) return;

  const state = { count: value.count, keys: [...value.keys] };
  const notify = () => onChange({ count: state.count, keys: [...state.keys] });
  const options = Object.entries(ITEMS)
    .map(([key, item]) => `<option value="${key}">${item.label}</option>`).join("");

  dlg.querySelector(".settings-title").textContent = title;

  const countSelect = dlg.querySelector("#set-count");
  countSelect.innerHTML = counts.map((n) => `<option value="${n}">${n}個</option>`).join("");
  countSelect.value = String(state.count);

  const slots = dlg.querySelector(".slots");
  function renderSlots() {
    slots.replaceChildren(...state.keys.map((key, i) => {
      const field = document.createElement("div");
      field.className = "field";
      field.hidden = i >= state.count;
      field.innerHTML = `<label for="set-slot-${i}">${i + 1}つ目</label><select id="set-slot-${i}">${options}</select>`;
      const select = field.querySelector("select");
      select.value = key;
      select.addEventListener("change", () => {
        state.keys[i] = select.value;
        notify();
      });
      return field;
    }));
  }

  countSelect.onchange = () => {
    state.count = Number(countSelect.value);
    renderSlots();
    notify();
  };

  renderSlots();
  dlg.showModal();
}