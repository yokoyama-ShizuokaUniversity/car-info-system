// ラズパイからのデータ受信。subscribe した関数に最新のデータを配る
const listeners = new Set();
let lastObdTime = null;

export const status = {
  sseDown: true,     // ラズパイとの通信が切れているか
  lastData: null,    // 最後に受け取ったデータ
  lastObdChange: 0,  // OBDの値が最後に更新された時刻
};

export function subscribe(fn) {
  listeners.add(fn);
  if (status.lastData) fn(status.lastData);
  return () => listeners.delete(fn);
}

export function connect(url = "/events") {
  const es = new EventSource(url); // 切れても自動で再接続する
  es.onopen = () => { status.sseDown = false; };
  es.onmessage = (e) => {
    status.sseDown = false;
    const d = JSON.parse(e.data);
    if (d.obd_time !== lastObdTime) {
      lastObdTime = d.obd_time;
      status.lastObdChange = Date.now();
    }
    status.lastData = d;
    listeners.forEach((fn) => fn(d));
  };
  es.onerror = () => {
    status.sseDown = true;
    listeners.forEach((fn) => fn(status.lastData));
  };
}