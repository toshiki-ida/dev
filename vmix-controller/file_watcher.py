"""
ファイル監視モジュール
指定されたディレクトリを監視し、最新のファイルを検出します。
"""
import os
import time
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from typing import Optional, Callable


class FileWatcher(FileSystemEventHandler):
    """ディレクトリを監視し、最新ファイルを検出するクラス"""

    def __init__(self, callback: Optional[Callable[[str], None]] = None):
        """
        初期化

        Args:
            callback: 新しいファイルが検出されたときに呼び出される関数
        """
        super().__init__()
        self.callback = callback
        self.watch_directory: Optional[str] = None
        self.observer: Optional[Observer] = None
        self.latest_file: Optional[str] = None

    def get_latest_file(self, directory: str) -> Optional[str]:
        """
        指定されたディレクトリから最新のファイルを取得

        Args:
            directory: 監視するディレクトリパス

        Returns:
            最新ファイルのパス、存在しない場合はNone
        """
        if not os.path.exists(directory):
            return None

        files = []
        for entry in os.scandir(directory):
            if entry.is_file():
                files.append(entry.path)

        if not files:
            return None

        # 最新のファイルを取得（作成時刻でソート）
        latest = max(files, key=lambda x: os.path.getctime(x))
        return latest

    def on_created(self, event):
        """ファイルが作成されたときのハンドラ"""
        if not event.is_directory:
            file_path = event.src_path
            # 同じファイルの重複を避ける
            if file_path != self.latest_file:
                self.latest_file = file_path
                if self.callback:
                    self.callback(file_path)

    def on_modified(self, event):
        """ファイルが変更されたときのハンドラ"""
        # ファイル変更イベントは無視（作成イベントのみ処理）
        pass

    def start_watching(self, directory: str):
        """
        ディレクトリの監視を開始

        Args:
            directory: 監視するディレクトリパス
        """
        if self.observer:
            self.stop_watching()

        self.watch_directory = directory

        # 初期の最新ファイルを取得（コールバックは呼ばない）
        self.latest_file = self.get_latest_file(directory)

        # 監視を開始
        self.observer = Observer()
        self.observer.schedule(self, directory, recursive=False)
        self.observer.start()

    def stop_watching(self):
        """ディレクトリの監視を停止"""
        if self.observer:
            self.observer.stop()
            self.observer.join()
            self.observer = None

    def is_watching(self) -> bool:
        """監視中かどうかを返す"""
        return self.observer is not None and self.observer.is_alive()
