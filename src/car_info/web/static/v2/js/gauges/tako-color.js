import { RED_RPM } from "./common.js";

function lerpColor(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

// タコの体の色:生(薄紫)→ ピンク(4000rpm)→ ゆでダコの赤(レッドゾーン)
export function bodyColor(rpm) {
  if (rpm < 4000) return lerpColor("#CFC0E3", "#F59AAE", rpm / 4000);
  return lerpColor("#F59AAE", "#FF5A45", Math.min(1, (rpm - 4000) / (RED_RPM - 4000)));
}