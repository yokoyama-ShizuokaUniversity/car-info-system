import json
import os
import threading
from pathlib import Path


class SettingsStore:
    """ガソリン単価などの設定をファイルに保存し、再起動後も残す"""

    def __init__(self, path: Path):
        self.path = path
        self._lock = threading.Lock()
        self._data = self._load()

    def _load(self) -> dict:
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def get(self, key, default=None):
        with self._lock:
            return self._data.get(key, default)

    def all(self) -> dict:
        with self._lock:
            return dict(self._data)

    def set(self, key, value):
        with self._lock:
            self._data[key] = value
            self._save()

    def _save(self):
        # 一時ファイルに書いてから置き換える(書き込み中に電源が切れても壊れにくい)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, self.path)