import requests
from typing import Optional


class VmixAPI:
    """vMix HTTP API通信クラス"""

    def __init__(self, ip: str = "localhost", port: int = 8088):
        """
        Args:
            ip: vMixのIPアドレス
            port: vMixのポート番号
        """
        self.ip = ip
        self.port = port
        self.base_url = f"http://{ip}:{port}/api/"

    def update_connection(self, ip: str, port: int) -> None:
        """接続設定を更新"""
        self.ip = ip
        self.port = port
        self.base_url = f"http://{ip}:{port}/api/"

    def test_connection(self) -> bool:
        """接続テスト"""
        try:
            response = requests.get(self.base_url, timeout=2)
            return response.status_code == 200
        except Exception:
            return False

    def overlay_input1(self, input_number: int) -> bool:
        """OverlayInput1を実行"""
        return self._send_command("OverlayInput1", input_number)

    def overlay_input2(self, input_number: int) -> bool:
        """OverlayInput2を実行"""
        return self._send_command("OverlayInput2", input_number)

    def set_downstream_key1(self, input_number: int) -> bool:
        """DownstreamKey1 (DSK1) でオーバーレイ"""
        return self._send_command("OverlayInput1", input_number)

    def set_downstream_key2(self, input_number: int) -> bool:
        """DownstreamKey2 (DSK2) でオーバーレイ"""
        return self._send_command("OverlayInput2", input_number)

    def set_downstream_key3(self, input_number: int) -> bool:
        """DownstreamKey3 (DSK3) でオーバーレイ"""
        return self._send_command("OverlayInput3", input_number)

    def set_downstream_key3_on(self, input_number: int) -> bool:
        """DownstreamKey3 (DSK3) を明示的にON"""
        return self._send_command("OverlayInput3In", input_number)

    def set_downstream_key3_off(self, input_number: int) -> bool:
        """DownstreamKey3 (DSK3) を明示的にOFF"""
        return self._send_command("OverlayInput3Out", input_number)

    def set_downstream_key4(self, input_number: int) -> bool:
        """DownstreamKey4 (DSK4) でオーバーレイ"""
        return self._send_command("OverlayInput4", input_number)

    def set_downstream_key4_on(self, input_number: int) -> bool:
        """DownstreamKey4 (DSK4) を明示的にON"""
        return self._send_command("OverlayInput4In", input_number)

    def set_downstream_key4_off(self, input_number: int) -> bool:
        """DownstreamKey4 (DSK4) を明示的にOFF"""
        return self._send_command("OverlayInput4Out", input_number)

    def set_text(self, input_number: int, text: str) -> bool:
        """テキストを設定"""
        try:
            params = {
                "Function": "SetText",
                "Input": str(input_number),
                "Value": text
            }
            print(f"[DEBUG] Setting text on Input {input_number}: '{text}'")
            response = requests.get(self.base_url, params=params, timeout=5)
            print(f"[DEBUG] Response status: {response.status_code}")
            return response.status_code == 200
        except Exception as e:
            print(f"[ERROR] Error setting text: {e}")
            return False

    def _send_command(self, function: str, input_number: int) -> bool:
        """コマンド送信共通処理"""
        try:
            params = {
                "Function": function,
                "Input": str(input_number)
            }
            url = f"{self.base_url}?Function={function}&Input={input_number}"
            print(f"[DEBUG] Sending request to: {url}")
            response = requests.get(self.base_url, params=params, timeout=5)
            print(f"[DEBUG] Response status: {response.status_code}")
            print(f"[DEBUG] Response body: {response.text[:200]}")
            return response.status_code == 200
        except Exception as e:
            print(f"[ERROR] Error sending command '{function}' to Input {input_number}: {e}")
            return False
