import threading

class State:
	""" 各機能の最新値を共有する入れ物(スレッド間で安全に読み書きする) """
	def __init__(self):
		self._lock = threading.Lock()
		self._data = {}
	def update(self, values: dict):
		with self._lock:
			self._data.update(values)

	def snapshot(self) -> dict:
		with self._lock:
			return dict(self._data)
