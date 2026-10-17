// 「今ならエンジンを止めても大丈夫そう」かの推定
// (この車にアイドリングストップ機能はないので、あくまで目安)
export const IDLE_RULES = {
  maxSpeed: 0.5,    // 停車中 [km/h]
  maxAccelRaw: 20,  // アクセルを離している(生の値) [%]
  minCoolant: 70,   // 暖機が終わっている [℃]
  minVoltage: 12.2, // バッテリーの電圧が下がっていない [V]
};

export function isIdleReady(d) {
  if (!d || !(d.RPM > 0)) return false;
  return (d.SPEED ?? 999) <= IDLE_RULES.maxSpeed
    && (d.ACCELERATOR_POS_D ?? 100) <= IDLE_RULES.maxAccelRaw
    && (d.COOLANT_TEMP ?? 0) >= IDLE_RULES.minCoolant
    && (d.CONTROL_MODULE_VOLTAGE ?? 0) >= IDLE_RULES.minVoltage;
}