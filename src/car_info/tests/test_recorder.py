from car_info.recorder import LogFile, ModeTracker, build_row, iter_rows


def test_GPS時刻は受信直後だけ記録する():
    snap = {"gps_fix": True, "gps_time": "2026-10-18T00:00:00+00:00", "gps_rx_mono": 100.0,
            "obd_mono": 99.9, "SPEED": 40}
    fresh = build_row(snap, elapsed=1.0, mode="driving", now_mono=100.5)
    stale = build_row(snap, elapsed=1.0, mode="driving", now_mono=102.0)
    assert fresh["t_gps"] == "2026-10-18T00:00:00+00:00"
    assert stale["t_gps"] is None
    assert fresh["SPEED"] == 40
    assert "obd_mono" not in fresh and "gps_rx_mono" not in fresh


def test_走行中と停車中の切り替え():
    m = ModeTracker(hold_sec=3)
    assert m.update(10, now=0) == "driving"
    assert m.update(0, now=1) == "driving"    # 止まった直後はまだ走行中
    assert m.update(0, now=3.9) == "driving"
    assert m.update(0, now=4.0) == "stopped"  # 車速0が3秒続いたら停車中
    assert m.update(5, now=4.1) == "driving"  # 動き出したら即座に走行中


def test_電源断でも書き込み済みの行は読める(tmp_path):
    path = tmp_path / "a.jsonl.gz"
    log = LogFile(path)
    log.write_rows([{"a": 1}, {"a": 2}])
    # close() する前のファイルをコピーして、電源が切れた状態を再現する
    broken = tmp_path / "broken.jsonl.gz"
    broken.write_bytes(path.read_bytes())
    assert list(iter_rows(broken)) == [{"a": 1}, {"a": 2}]
    log.close()
    assert list(iter_rows(path)) == [{"a": 1}, {"a": 2}]