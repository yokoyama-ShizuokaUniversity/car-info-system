import pytest

from car_info.gnss.reader import nmea_sentence, parse_line

RMC = "$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A"
GGA = "$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47"


def test_RMC():
    r = parse_line(RMC)
    assert r["gps_fix"] is True
    assert r["gps_lat"] == pytest.approx(48.1173, abs=1e-4)
    assert r["gps_lon"] == pytest.approx(11.516667, abs=1e-5)
    assert r["gps_speed"] == 41.5  # 22.4ノット × 1.852
    assert r["gps_course"] == 84.4
    assert r["gps_time"] == "1994-03-23T12:35:19+00:00"


def test_GGA():
    r = parse_line(GGA)
    assert r["gps_sats"] == 8
    assert r["gps_hdop"] == 0.9
    assert r["gps_alt"] == 545.4


def test_測位できていない():
    r = parse_line(nmea_sentence("GPRMC,123519,V,,,,,,,230394,,,N"))
    assert r == {"gps_fix": False}


def test_チェックサムが不正():
    assert parse_line(RMC[:-2] + "00") == {}


def test_チェックサムの計算():
    body = "GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W"
    assert nmea_sentence(body) == RMC