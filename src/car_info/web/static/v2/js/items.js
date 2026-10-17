// 表示できる項目の一覧と、表示用の整形
// 項目を増やすときは ITEMS に1行追加する(format: 小数桁数 / "int" / "time" / "status")

export const ITEMS = {
  fuel_kmpl: { label: "瞬間燃費", unit: "km/L", format: 1 },
  trip_kmpl: { label: "平均燃費", unit: "km/L", format: 1 },
  fuel_lph: { label: "燃料消費", unit: "L/h", format: 1 },
  trip_km: { label: "区間距離", unit: "km", format: 1 },
  trip_fuel_l: { label: "区間燃料", unit: "L", format: 2 },
  SPEED: { label: "速度", unit: "km/h", format: 0 },
  RPM: { label: "回転数", unit: "rpm", format: "int" },
  accel_pct: { label: "アクセル開度", unit: "%", format: 0 },
  ACCELERATOR_POS_D: { label: "アクセル開度(生値)", unit: "%", format: 0 },
  ACCELERATOR_POS_E: { label: "アクセル開度(E)", unit: "%", format: 0 },
  THROTTLE_POS: { label: "スロットル開度", unit: "%", format: 0 },
  THROTTLE_POS_B: { label: "スロットル開度(B)", unit: "%", format: 0 },
  RELATIVE_THROTTLE_POS: { label: "相対スロットル開度", unit: "%", format: 0 },
  THROTTLE_ACTUATOR: { label: "スロットル指令値", unit: "%", format: 0 },
  ENGINE_LOAD: { label: "エンジン負荷", unit: "%", format: 0 },
  CONTROL_MODULE_VOLTAGE: { label: "車両電圧", unit: "V", format: 1, note: voltageNote },
  COOLANT_TEMP: { label: "水温", unit: "℃", format: 0 },
  INTAKE_TEMP: { label: "吸気温", unit: "℃", format: 0 },
  INTAKE_PRESSURE: { label: "吸気圧", unit: "kPa", format: 0 },
  BAROMETRIC_PRESSURE: { label: "大気圧", unit: "kPa", format: 0 },
  MAF: { label: "MAF", unit: "g/s", format: 1 },
  TIMING_ADVANCE: { label: "点火時期", unit: "°", format: 1 },
  SHORT_FUEL_TRIM_1: { label: "燃料補正(短期)", unit: "%", format: 1 },
  LONG_FUEL_TRIM_1: { label: "燃料補正(長期)", unit: "%", format: 1 },
  O2_B1S1: { label: "O2センサー(前)", unit: "V", format: 2 },
  O2_B1S2: { label: "O2センサー(後)", unit: "V", format: 2 },
  COMMANDED_EGR: { label: "EGR指令値", unit: "%", format: 0 },
  EGR_ERROR: { label: "EGR誤差", unit: "%", format: 0 },
  EVAPORATIVE_PURGE: { label: "エバポパージ", unit: "%", format: 0 },
  FUEL_STATUS: { label: "燃料制御", unit: "", format: "status" },
  RUN_TIME: { label: "エンジン稼働時間", unit: "", format: "time" },
  obd_cycle_sec: { label: "取得周期", unit: "秒", format: 2 },
  gps_speed: { label: "GPS速度", unit: "km/h", format: 1 },
  gps_sats: { label: "衛星数", unit: "個", format: 0 },
  gps_alt: { label: "高度", unit: "m", format: 0 },
  gps_course: { label: "進行方向", unit: "°", format: 0 },
  gps_hdop: { label: "測位精度(HDOP)", unit: "", format: 1 },
};

// 車両電圧の状態(エンジン回転中のみ表示)
function voltageNote(d) {
  const v = d.CONTROL_MODULE_VOLTAGE;
  if (isEmpty(v) || !(d.RPM > 0)) return "";
  return v >= 13.5 ? "充電中" : "充電制御中";
}

export function isEmpty(v) {
  return v === null || v === undefined || Number.isNaN(Number(v));
}

export function fmt(v, digits) {
  return isEmpty(v) ? "--" : Number(v).toFixed(digits).replace("-", "−");
}

export function fmtInt(v) {
  return isEmpty(v) ? "--" : Math.round(v).toLocaleString("en-US");
}

export function fmtTime(sec) {
  if (isEmpty(sec)) return "--";
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function fuelStatusText(st) {
  const s = (Array.isArray(st) ? st[0] : st || "").toLowerCase();
  if (!s) return "--";
  if (s.includes("closed loop") && s.includes("fault")) return "クローズドループ(異常)";
  if (s.includes("closed loop")) return "クローズドループ";
  if (s.includes("fuel cut")) return "減速・高負荷";
  if (s.includes("temperature")) return "暖機中";
  if (s.includes("failure")) return "異常";
  return "--";
}

export function formatItem(key, v) {
  const format = ITEMS[key].format;
  if (format === "status") return fuelStatusText(v);
  if (format === "time") return fmtTime(v);
  if (format === "int") return fmtInt(v);
  return fmt(v, format);
}