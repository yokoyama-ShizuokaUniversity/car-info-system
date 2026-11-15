import { COOLANT_COLD } from "../items.js";

// エコ運転の判定(タコの表情・アイコンで伝える)
// 判定の結果:"harsh"(急な操作で焦り) / "happy"(エコな運転でご機嫌) / "cold"(暖機中で寒い) / null(ふつう)
export const ECO_RULES = {
  harshAccelG: 0.25,     // これ以上の加速は急加速 [g]
  harshBrakeG: 0.35,     // これ以上の減速は急ブレーキ [g]
  harshLatG: 0.35,       // これ以上の横Gは急ハンドル [g]
  harshHoldMs: 2000,     // 急な操作のあと、焦りの表情を続ける時間 [ミリ秒]
  coastMinSpeed: 10,     // 燃料カットで惰性走行しているとみなす最低速度 [km/h]
  gentleMaxSpeed: 40,    // ふんわり発進を判定する速度の上限 [km/h]
  gentleMinG: 0.03,      // ふんわり発進とみなす加速の範囲 [g]
  gentleMaxG: 0.15,
  happyHoldMs: 1000,     // エコな運転のあと、ご機嫌の表情を続ける時間 [ミリ秒]
};

// 加速度センサーの値が使えるか(取り付けの補正前は傾きの分だけずれるので使わない)
function accelReady(d) {
  return d.accel_status === "受信中" && d.accel_calib && d.accel_calib !== "未補正"
    && d.accel_long !== undefined && d.accel_lat !== undefined;
}

function isHarsh(d) {
  if (!accelReady(d)) return false;
  return d.accel_long >= ECO_RULES.harshAccelG
    || d.accel_long <= -ECO_RULES.harshBrakeG
    || Math.abs(d.accel_lat) >= ECO_RULES.harshLatG;
}

function isHappy(d) {
  const speed = d.SPEED ?? 0;
  // 早めにアクセルを離して、燃料カットで惰性走行している
  if (d.fuel_mode === "fuel_cut" && speed >= ECO_RULES.coastMinSpeed) return true;
  // ふんわり発進(じわっと加速している)
  return accelReady(d) && speed > 0 && speed <= ECO_RULES.gentleMaxSpeed
    && d.accel_long >= ECO_RULES.gentleMinG && d.accel_long <= ECO_RULES.gentleMaxG;
}

// 判定は前回の結果を少しの間保つので、メーター画面で1つ作って使い回す
export function createEcoJudge() {
  let harshUntil = 0;
  let happyUntil = 0;

  return {
    update(d, now = Date.now()) {
      if (!d || !(d.RPM > 0)) return null; // エンジン停止中は判定しない(タコは寝ている)
      if (isHarsh(d)) harshUntil = now + ECO_RULES.harshHoldMs;
      if (isHappy(d)) happyUntil = now + ECO_RULES.happyHoldMs;

      // 優先順位:焦り > ご機嫌 > 寒い
      if (now < harshUntil) return "harsh";
      if (now < happyUntil) return "happy";
      if (d.COOLANT_TEMP !== undefined && d.COOLANT_TEMP !== null && d.COOLANT_TEMP < COOLANT_COLD) return "cold";
      return null;
    },
  };
}
