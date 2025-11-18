"""
vMix制御モジュール
vMix Web APIを使用してvMixを制御します。
"""
import requests
import xml.etree.ElementTree as ET
from typing import Optional, Dict, Any
from urllib.parse import quote


class VmixController:
    """vMixを制御するクラス"""

    def __init__(self, host: str = "localhost", port: int = 8088):
        """
        初期化

        Args:
            host: vMixが動作しているホスト
            port: vMix Web APIのポート
        """
        self.host = host
        self.port = port
        self.base_url = f"http://{host}:{port}/api/"

    def ensure_blank_at_input_2(self) -> bool:
        """
        Input 2を必ずBlankにする

        Returns:
            成功した場合True
        """
        print(f"[vMix API] Setting Input 2 to Blank...")

        # まず全てのInputを取得
        xml_str = self.get_xml_status()
        inputs = []

        if xml_str:
            import xml.etree.ElementTree as ET
            root = ET.fromstring(xml_str)

            # 全ての入力を取得
            for input_elem in root.findall('.//input'):
                key = input_elem.get('key', '')
                number = input_elem.get('number', '')
                title = input_elem.get('title', '')
                inputs.append({'key': key, 'number': number, 'title': title})
                print(f"[vMix API] Found input: number={number}, title={title}, key={key}")

        # Input番号2を検索
        input_2_exists = False
        is_blank = False
        for inp in inputs:
            if inp['number'] == '2':
                input_2_exists = True
                if 'blank' in inp['title'].lower() or 'colour' in inp['title'].lower():
                    is_blank = True
                    print(f"[vMix API] Input 2 is already Blank: {inp['title']}")
                else:
                    print(f"[vMix API] Input 2 exists but is not Blank: {inp['title']}")
                break

        # すでにBlankの場合は何もしない
        if input_2_exists and is_blank:
            return True

        # Blankを追加（自動的に次の番号になる）
        print(f"[vMix API] Adding Blank...")
        result = self.send_command("AddInput", Value="Colour")

        if result:
            print(f"[vMix API] Blank added successfully")
            import time
            time.sleep(0.5)
        else:
            print(f"[vMix API] Failed to add Blank")
            return False

        return result

    def send_command(self, function: str, **params) -> bool:
        """
        vMixにコマンドを送信

        Args:
            function: vMix関数名
            **params: 追加パラメータ

        Returns:
            成功した場合True、失敗した場合False
        """
        try:
            # パラメータを準備
            request_params = {"Function": function}
            request_params.update(params)

            print(f"[vMix API] Sending: {self.base_url} with params: {request_params}")
            response = requests.get(self.base_url, params=request_params, timeout=5)
            print(f"[vMix API] Response: {response.status_code} - {response.text[:200]}")
            return response.status_code == 200
        except Exception as e:
            print(f"[vMix API] Error: {e}")
            return False

    def add_input(self, file_path: str) -> bool:
        """
        vMixに入力を追加

        Args:
            file_path: 追加するファイルのパス

        Returns:
            成功した場合True
        """
        # バックスラッシュはそのまま使用（vMixはWindowsパスを期待）
        # スペースや特殊文字が含まれる場合のため、パスをそのまま使用

        # vMix APIの正しい形式を試す
        ext = file_path.lower().split('.')[-1]

        # ビデオファイルの場合
        if ext in ['mp4', 'avi', 'mov', 'wmv', 'mkv', 'flv', 'm4v', 'mpg', 'mpeg']:
            # まず標準的な形式を試す: Video|パス
            value = f"Video|{file_path}"
            print(f"[vMix API] Adding video with Value: {value}")
            if self.send_command("AddInput", Value=value):
                return True

            # 失敗した場合、Inputパラメータで直接パスを指定
            print(f"[vMix API] Retrying with direct path...")
            return self.send_command("AddInput", Input=file_path)

        # 画像ファイルの場合
        elif ext in ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'tiff', 'tif']:
            value = f"Image|{file_path}"
            print(f"[vMix API] Adding image with Value: {value}")
            if self.send_command("AddInput", Value=value):
                return True

            print(f"[vMix API] Retrying with direct path...")
            return self.send_command("AddInput", Input=file_path)

        # その他のファイル
        else:
            # 直接パスを試す
            return self.send_command("AddInput", Input=file_path)

    def set_overlay_position(self, input_name: str, overlay: int = 4,
                            x: float = 0, y: float = 0,
                            width: float = 1920, height: float = 1080) -> bool:
        """
        オーバーレイの位置とサイズを設定

        注意: vMixではオーバーレイ入力のサイズ変更はZoom/Pan/Cropで行います
        このメソッドは位置のみを設定します

        Args:
            input_name: 入力名
            overlay: オーバーレイ番号（1-4、OAは4）
            x: X座標
            y: Y座標
            width: 幅（使用されません）
            height: 高さ（使用されません）

        Returns:
            成功した場合True
        """
        # OverlayInput4に対してSetPosition
        # 注意: この方法では位置のみ変更、サイズ変更はZoom/Cropで行う
        print(f"[vMix API] Setting overlay position: X={x}, Y={y}")

        # Overlay 4 (OA)の位置を設定
        # Input番号を使用（オーバーレイ4は通常"4"）
        success = True

        # X座標を設定
        success &= self.send_command("SetPosition", Input=input_name, SelectedName="PositionX", Value=str(x))
        # Y座標を設定
        success &= self.send_command("SetPosition", Input=input_name, SelectedName="PositionY", Value=str(y))

        return success

    def overlay_input(self, input_name: str, overlay: int = 4) -> bool:
        """
        指定した入力をオーバーレイ（OA）にスタンバイ

        Args:
            input_name: 入力名
            overlay: オーバーレイ番号（デフォルト: 4 = OA）

        Returns:
            成功した場合True
        """
        # まずInputパラメータを使って試す
        result = self.send_command("OverlayInput4", Input=input_name)

        # 失敗した場合、Valueパラメータで試す（vMixのバージョンによって異なる）
        if not result:
            print(f"[vMix API] Retrying with Value parameter...")
            result = self.send_command("OverlayInput4", Value=input_name)

        return result

    def overlay_input_off(self, overlay: int = 4) -> bool:
        """
        オーバーレイをオフにする

        Args:
            overlay: オーバーレイ番号（デフォルト: 4 = OA）

        Returns:
            成功した場合True
        """
        return self.send_command("OverlayInput4Off")

    def set_multiview_overlay(self, input_name: str, destination: str = "4") -> bool:
        """
        マルチビューオーバーレイに設定

        Args:
            input_name: 入力名
            destination: 送信先（"4" = Overlay 4/OA）

        Returns:
            成功した場合True
        """
        return self.send_command("SetMultiViewOverlay", Input=input_name, Value=destination)

    def get_xml_status(self) -> Optional[str]:
        """
        vMixのXMLステータスを取得

        Returns:
            XMLステータス文字列、失敗した場合None
        """
        try:
            url = f"http://{self.host}:{self.port}/api/"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                return response.text
            return None
        except Exception as e:
            print(f"Error getting vMix status: {e}")
            return None

    def get_input_status(self, input_name: str) -> Optional[Dict[str, Any]]:
        """
        特定の入力のステータスを取得

        Args:
            input_name: 入力名

        Returns:
            入力のステータス情報（state, position, duration等）
        """
        try:
            xml_str = self.get_xml_status()
            if not xml_str:
                print(f"[vMix API] No XML status available")
                return None

            root = ET.fromstring(xml_str)

            # 入力を検索
            for input_elem in root.findall('.//input'):
                # タイトルまたはキーで検索
                title = input_elem.get('title', '')
                key = input_elem.get('key', '')

                print(f"[vMix API] Checking input: title={title}, key={key}, searching for={input_name}")

                # 完全一致または部分一致で検索
                if input_name == title or input_name == key or input_name in title:
                    state = input_elem.get('state', 'Paused')
                    print(f"[vMix API] Found match! state={state}")
                    return {
                        'key': key,
                        'title': title,
                        'state': state,  # Playing, Paused, Completed
                        'position': int(input_elem.get('position', 0)),
                        'duration': int(input_elem.get('duration', 0)),
                        'loop': input_elem.get('loop', 'False') == 'True'
                    }

            print(f"[vMix API] Input not found: {input_name}")
            return None
        except Exception as e:
            print(f"[vMix API] Error getting input status: {e}")
            import traceback
            traceback.print_exc()
            return None

    def is_input_playing(self, input_name: str) -> bool:
        """
        入力が再生中かどうかを確認

        Args:
            input_name: 入力名

        Returns:
            再生中の場合True
        """
        status = self.get_input_status(input_name)
        if status:
            return status.get('state') == 'Playing'
        return False

    def play_input(self, input_name: str) -> bool:
        """
        入力を再生

        Args:
            input_name: 入力名

        Returns:
            成功した場合True
        """
        return self.send_command("Play", Input=input_name)

    def pause_input(self, input_name: str) -> bool:
        """
        入力を一時停止

        Args:
            input_name: 入力名

        Returns:
            成功した場合True
        """
        return self.send_command("Pause", Input=input_name)

    def restart_input(self, input_name: str) -> bool:
        """
        入力を頭出し（先頭に戻す）

        Args:
            input_name: 入力名

        Returns:
            成功した場合True
        """
        # SetPosition で位置を0に設定
        return self.send_command("SetPosition", Input=input_name, Value=0)

    def remove_input(self, input_name: str) -> bool:
        """
        入力を削除

        Args:
            input_name: 削除する入力名

        Returns:
            成功した場合True
        """
        return self.send_command("RemoveInput", Input=input_name)

    def frame_forward(self, input_name: str, fps: float = 30.0) -> bool:
        """
        1フレーム送る（30fpsの場合約33ms進める）

        Args:
            input_name: 入力名
            fps: フレームレート（デフォルト: 30fps）

        Returns:
            成功した場合True
        """
        # 現在位置を取得
        status = self.get_input_status(input_name)
        if not status:
            return False

        current_pos = status.get('position', 0)  # ミリ秒
        duration = status.get('duration', 0)

        # 1フレーム分（ミリ秒）を計算
        frame_ms = 1000.0 / fps

        # 新しい位置を計算
        new_pos = min(current_pos + frame_ms, duration)

        # 位置を設定
        return self.send_command("SetPosition", Input=input_name, Value=int(new_pos))

    def frame_backward(self, input_name: str, fps: float = 30.0) -> bool:
        """
        1フレーム戻す（30fpsの場合約33ms戻す）

        Args:
            input_name: 入力名
            fps: フレームレート（デフォルト: 30fps）

        Returns:
            成功した場合True
        """
        # 現在位置を取得
        status = self.get_input_status(input_name)
        if not status:
            return False

        current_pos = status.get('position', 0)  # ミリ秒

        # 1フレーム分（ミリ秒）を計算
        frame_ms = 1000.0 / fps

        # 新しい位置を計算
        new_pos = max(current_pos - frame_ms, 0)

        # 位置を設定
        return self.send_command("SetPosition", Input=input_name, Value=int(new_pos))

    def replace_input_1(self, file_path: str) -> bool:
        """
        Input 1の素材を入れ替える

        vMix構成:
        - Input 1: 素材（この関数で変更）
        - Input 2: 常にBlank（背景）
        - Overlay 4 (OA): Input 2を表示
        - DSK 4: Input 1をオーバーレイ

        Args:
            file_path: 新しいファイルのパス

        Returns:
            成功した場合True
        """
        import time

        print(f"[vMix API] Replacing Input 1 with: {file_path}")

        # ステップ1: 現在のInputs状態を取得
        xml_str = self.get_xml_status()
        input_1_exists = False
        input_2_info = None

        if xml_str:
            root = ET.fromstring(xml_str)
            for input_elem in root.findall('.//input'):
                number = input_elem.get('number', '')
                if number == '1':
                    input_1_exists = True
                    print(f"[vMix API] Input 1 exists: {input_elem.get('title', '')}")
                elif number == '2':
                    input_2_info = {
                        'title': input_elem.get('title', ''),
                        'key': input_elem.get('key', '')
                    }
                    print(f"[vMix API] Input 2 exists: {input_2_info['title']}")

        # ステップ2: Input 1が存在する場合は削除
        if input_1_exists:
            print(f"[vMix API] Removing existing Input 1...")
            if not self.send_command("RemoveInput", Input="1"):
                print(f"[vMix API] Warning: Failed to remove Input 1")
            time.sleep(0.3)

        # ステップ3: 新しいファイルを追加（これがInput 1になる）
        print(f"[vMix API] Adding new file as Input 1...")
        result = self.add_input(file_path)

        if not result:
            print(f"[vMix API] Failed to add new input")
            return False

        time.sleep(0.3)

        # ステップ4: Input 2がBlankであることを確認
        xml_str = self.get_xml_status()
        if xml_str:
            root = ET.fromstring(xml_str)
            input_2_is_blank = False

            for input_elem in root.findall('.//input'):
                number = input_elem.get('number', '')
                if number == '2':
                    title = input_elem.get('title', '').lower()
                    if 'blank' in title or 'colour' in title:
                        input_2_is_blank = True
                        print(f"[vMix API] Input 2 is Blank")
                    break

            if not input_2_is_blank:
                print(f"[vMix API] Input 2 is not Blank, ensuring it...")
                self.ensure_blank_at_input_2()

        # ステップ5: Overlay 4にInput 1を設定
        print(f"[vMix API] Setting up Overlay 4 with Input 1...")
        self.send_command("OverlayInput4", Input="1")
        time.sleep(0.1)

        # Overlay 4を有効化
        self.send_command("OverlayInput4On")

        print(f"[vMix API] Input 1 replaced successfully")
        return True

    def set_input_zoom(self, input_name: str, zoom: float) -> bool:
        """
        入力のZoomを設定

        Args:
            input_name: 入力名
            zoom: ズーム値（0.0-5.0程度）

        Returns:
            成功した場合True
        """
        print(f"[vMix API] Setting zoom for {input_name}: {zoom}")
        # vMixのSetZoomコマンドを使用
        return self.send_command("SetZoom", Input=input_name, Value=zoom)

    def set_input_pan(self, input_name: str, panX: float, panY: float) -> bool:
        """
        入力のPanを設定

        Args:
            input_name: 入力名
            panX: 水平パン（-2.0 ~ 2.0）
            panY: 垂直パン（-2.0 ~ 2.0）

        Returns:
            成功した場合True
        """
        print(f"[vMix API] Setting pan for {input_name}: X={panX}, Y={panY}")
        success = True
        success &= self.send_command("SetPanX", Input=input_name, Value=panX)
        success &= self.send_command("SetPanY", Input=input_name, Value=panY)
        return success

    def set_input_crop(self, input_name: str, x1: float, y1: float, x2: float, y2: float) -> bool:
        """
        入力のCropを設定

        Args:
            input_name: 入力名
            x1: 左端（0.0-1.0）
            y1: 上端（0.0-1.0）
            x2: 右端（0.0-1.0）
            y2: 下端（0.0-1.0）

        Returns:
            成功した場合True
        """
        # vMix APIではCropを4つの値で設定
        crop_value = f"{x1},{y1},{x2},{y2}"
        print(f"[vMix API] Setting crop for {input_name}: {crop_value}")
        return self.send_command("SetCrop", Input=input_name, Value=crop_value)

    def apply_preset(self, input_name: str, preset_config: Dict[str, Any]) -> bool:
        """
        リサイズプリセットを適用

        Args:
            input_name: 入力名
            preset_config: プリセット設定（zoom, pan を含む辞書）

        Returns:
            成功した場合True
        """
        print(f"[vMix API] Applying preset to {input_name}")
        print(f"[vMix API] Preset config: {preset_config}")

        # OAにスタンバイされている入力は通常"1"番
        # 入力名の代わりに入力番号を使用してみる
        # まず入力名で試し、失敗したら"1"で試す

        success = True
        at_least_one_command = False

        # Zoomを設定
        if "zoom" in preset_config:
            zoom_result = self.set_input_zoom(input_name, preset_config["zoom"])
            print(f"[vMix API] Zoom set (by name): {zoom_result}")

            # 失敗した場合、入力番号"1"で試す
            if not zoom_result:
                print(f"[vMix API] Retrying zoom with input number '1'")
                zoom_result = self.set_input_zoom("1", preset_config["zoom"])
                print(f"[vMix API] Zoom set (by number): {zoom_result}")

            success &= zoom_result
            at_least_one_command = True

        # Panを設定
        if "panX" in preset_config and "panY" in preset_config:
            pan_result = self.set_input_pan(input_name, preset_config["panX"], preset_config["panY"])
            print(f"[vMix API] Pan set (by name): {pan_result}")

            # 失敗した場合、入力番号"1"で試す
            if not pan_result:
                print(f"[vMix API] Retrying pan with input number '1'")
                pan_result = self.set_input_pan("1", preset_config["panX"], preset_config["panY"])
                print(f"[vMix API] Pan set (by number): {pan_result}")

            success &= pan_result
            at_least_one_command = True

        if not at_least_one_command:
            print(f"[vMix API] Warning: No commands were executed")
            return False

        print(f"[vMix API] Preset apply result: {success}")
        return success
