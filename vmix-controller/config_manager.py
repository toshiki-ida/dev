"""
設定管理モジュール
アプリケーションの設定を保存・読み込みします。
"""
import json
import os
from typing import Dict, Any, List


class ConfigManager:
    """設定を管理するクラス"""

    DEFAULT_PRESETS = [
        {
            "name": "フルスクリーン",
            "x": 0,
            "y": 0,
            "width": 1920,
            "height": 1080,
            "zoom": 1.0,
            "panX": 0.0,
            "panY": 0.0,
            "cropX1": 0.0,
            "cropY1": 0.0,
            "cropX2": 1.0,
            "cropY2": 1.0
        },
        {
            "name": "左半分",
            "x": 0,
            "y": 0,
            "width": 960,
            "height": 1080,
            "zoom": 1.0,
            "panX": 0.0,
            "panY": 0.0,
            "cropX1": 0.0,
            "cropY1": 0.0,
            "cropX2": 1.0,
            "cropY2": 1.0
        },
        {
            "name": "右半分",
            "x": 960,
            "y": 0,
            "width": 960,
            "height": 1080,
            "zoom": 1.0,
            "panX": 0.0,
            "panY": 0.0,
            "cropX1": 0.0,
            "cropY1": 0.0,
            "cropX2": 1.0,
            "cropY2": 1.0
        },
        {
            "name": "右下1/4",
            "x": 960,
            "y": 540,
            "width": 960,
            "height": 540,
            "zoom": 1.0,
            "panX": 0.0,
            "panY": 0.0,
            "cropX1": 0.0,
            "cropY1": 0.0,
            "cropX2": 1.0,
            "cropY2": 1.0
        },
        {
            "name": "左下1/4",
            "x": 0,
            "y": 540,
            "width": 960,
            "height": 540,
            "zoom": 1.0,
            "panX": 0.0,
            "panY": 0.0,
            "cropX1": 0.0,
            "cropY1": 0.0,
            "cropX2": 1.0,
            "cropY2": 1.0
        },
        {
            "name": "中央1/2",
            "x": 480,
            "y": 270,
            "width": 960,
            "height": 540,
            "zoom": 1.0,
            "panX": 0.0,
            "panY": 0.0,
            "cropX1": 0.0,
            "cropY1": 0.0,
            "cropX2": 1.0,
            "cropY2": 1.0
        }
    ]

    def __init__(self, config_file: str = "config.json"):
        """
        初期化

        Args:
            config_file: 設定ファイルのパス
        """
        self.config_file = config_file
        self.config: Dict[str, Any] = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        """
        設定ファイルを読み込む

        Returns:
            設定の辞書
        """
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"設定ファイルの読み込みに失敗しました: {e}")

        # デフォルト設定を返す
        return {
            "watch_directory": "",
            "vmix_host": "localhost",
            "vmix_port": 8088,
            "presets": self.DEFAULT_PRESETS,
            "auto_add_to_vmix": True,
            "window_geometry": "800x600"
        }

    def save_config(self) -> bool:
        """
        設定をファイルに保存

        Returns:
            成功した場合True
        """
        try:
            print(f"[ConfigManager] Saving config to {self.config_file}")
            print(f"[ConfigManager] Config data: {self.config}")
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=2)
            print(f"[ConfigManager] Config saved successfully")
            return True
        except Exception as e:
            print(f"[ConfigManager] 設定ファイルの保存に失敗しました: {e}")
            import traceback
            traceback.print_exc()
            return False

    def get(self, key: str, default: Any = None) -> Any:
        """
        設定値を取得

        Args:
            key: 設定キー
            default: デフォルト値

        Returns:
            設定値
        """
        return self.config.get(key, default)

    def set(self, key: str, value: Any):
        """
        設定値を設定

        Args:
            key: 設定キー
            value: 設定値
        """
        self.config[key] = value

    def get_presets(self) -> List[Dict[str, Any]]:
        """
        リサイズプリセットを取得

        Returns:
            プリセットのリスト
        """
        return self.config.get("presets", self.DEFAULT_PRESETS)

    def set_presets(self, presets: List[Dict[str, Any]]):
        """
        リサイズプリセットを設定

        Args:
            presets: プリセットのリスト
        """
        self.config["presets"] = presets

    def get_watch_directory(self) -> str:
        """監視ディレクトリを取得"""
        return self.config.get("watch_directory", "")

    def set_watch_directory(self, directory: str):
        """監視ディレクトリを設定"""
        self.config["watch_directory"] = directory

    def get_vmix_connection(self) -> tuple:
        """
        vMix接続情報を取得

        Returns:
            (host, port) のタプル
        """
        return (
            self.config.get("vmix_host", "localhost"),
            self.config.get("vmix_port", 8088)
        )

    def set_vmix_connection(self, host: str, port: int):
        """
        vMix接続情報を設定

        Args:
            host: ホスト名
            port: ポート番号
        """
        self.config["vmix_host"] = host
        self.config["vmix_port"] = port
