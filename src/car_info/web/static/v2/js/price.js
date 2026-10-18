// ガソリン単価の入力画面(給油のたびに入力する。ラズパイに保存され、再起動後も残る)
let dialog = null;

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.className = "settings";
  dialog.innerHTML = `
    <form>
      <h2 class="settings-title">ガソリン単価</h2>
      <div class="field">
        <label for="fuel-price">給油したガソリンの単価(円/L)</label>
        <input id="fuel-price" type="number" inputmode="decimal" min="1" max="999" step="0.1" required>
      </div>
      <p class="hint price-error" hidden>保存できませんでした。ラズパイとの接続を確認してください。</p>
      <div class="buttons">
        <button class="cancel" type="button">キャンセル</button>
        <button class="close" type="submit">保存</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);

  const input = dialog.querySelector("#fuel-price");
  const error = dialog.querySelector(".price-error");
  dialog.querySelector(".cancel").addEventListener("click", () => dialog.close());
  dialog.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    error.hidden = true;
    try {
      const res = await fetch("/api/fuel-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: Number(input.value) }),
      });
      if (!res.ok) throw new Error(String(res.status));
      dialog.close();
    } catch (err) {
      error.hidden = false;
    }
  });
  return dialog;
}

export async function openPriceInput() {
  // 長押しで別の設定画面を開いた直後のタップなど、ほかの画面が開いているときは開かない
  if (document.querySelector("dialog[open]")) return;
  const dlg = ensureDialog();
  const settings = await fetch("/api/settings").then((r) => r.json()).catch(() => ({}));
  const input = dlg.querySelector("#fuel-price");
  input.value = settings.fuel_price ?? "";
  dlg.querySelector(".price-error").hidden = true;
  dlg.showModal();
  input.focus();
}