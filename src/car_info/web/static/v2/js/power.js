// シャットダウンの確認画面
let dialog = null;

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.className = "settings";
  dialog.innerHTML = `
    <form>
      <h2 class="settings-title">シャットダウン</h2>
      <p class="power-message">ラズパイを安全に終了します。終了後、ラズパイの緑のランプが消えてから、エンジンを切ってください。</p>
      <div class="buttons">
        <button class="cancel" type="button">キャンセル</button>
        <button class="close danger" type="submit">シャットダウン</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);

  const message = dialog.querySelector(".power-message");
  const buttons = dialog.querySelector(".buttons");
  dialog.querySelector(".cancel").addEventListener("click", () => dialog.close());
  dialog.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/shutdown", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      message.textContent = "シャットダウンしています。緑のランプが消えたら、エンジンを切って大丈夫です。";
      buttons.hidden = true;
    } catch (err) {
      message.textContent = "シャットダウンできませんでした。ラズパイとの接続か、権限の設定を確認してください。";
    }
  });
  return dialog;
}

export function openShutdownDialog() {
  if (document.querySelector("dialog[open]")) return;
  const dlg = ensureDialog();
  dlg.querySelector(".power-message").textContent =
    "ラズパイを安全に終了します。終了後、ラズパイの緑のランプが消えてから、エンジンを切ってください。";
  dlg.querySelector(".buttons").hidden = false;
  dlg.showModal();
}