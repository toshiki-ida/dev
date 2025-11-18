import json
import os
from typing import Dict, Any


class ConfigManager:
    """設定ファイルの読み書きを管理するクラス"""

    def __init__(self, config_file: str = "config.json"):
        """
        Args:
            config_file: 設定ファイル名
        """
        self.config_file = config_file
        self.default_config = {
            "ip": "localhost",
            "port": 8088
        }

    def load_config(self) -> Dict[str, Any]:
        """設定を読み込む"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading config: {e}")
                return self.default_config.copy()
        return self.default_config.copy()

    def save_config(self, config: Dict[str, Any]) -> bool:
        """設定を保存する"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving config: {e}")
            return False
