// メーター共通の計算
export const MAX_RPM = 8000; // 目盛りの最大 [rpm]
export const RED_RPM = 6500; // レッドゾーンの始まり [rpm]

// データから回転数を取り出す(取れないときは0)
export function rpmOf(d) {
  return Math.max(0, Number(d?.RPM) || 0);
}

// 回転数 → 角度(0rpmが左下 -120°、最大が右下 +120°。真上が0°で時計回り)
export function angleOf(rpm) {
  return -120 + (Math.min(Math.max(rpm, 0), MAX_RPM) / MAX_RPM) * 240;
}

// 中心(180,180)から半径r・角度degの点
export function polar(r, deg) {
  const t = (deg * Math.PI) / 180;
  return [180 + r * Math.sin(t), 180 - r * Math.cos(t)];
}

// 半径rの円弧(fromDeg から toDeg まで時計回り)
export function arcPath(r, fromDeg, toDeg) {
  const [x1, y1] = polar(r, fromDeg);
  const [x2, y2] = polar(r, toDeg);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

// 回転数の帯ごとの色(通常:青、5000rpm〜:黄、レッドゾーン:オレンジ)
export function zoneColor(rpm) {
  if (rpm >= RED_RPM) return "var(--bad)";
  if (rpm >= 5000) return "var(--mid)";
  return "var(--good)";
}