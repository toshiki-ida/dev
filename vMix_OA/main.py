import customtkinter as ctk
from tkinter import messagebox
from vmix_api import VmixAPI
from config_manager import ConfigManager


class VmixControlPanel(ctk.CTk):
    """vMix制御パネルアプリケーション"""

    def __init__(self):
        super().__init__()

        # ウィンドウ設定
        self.title("vMix制御パネル")
        self.geometry("500x650")

        # ダークモードを設定
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        # 設定マネージャーとAPIクライアントの初期化
        self.config_manager = ConfigManager()
        config = self.config_manager.load_config()
        self.vmix_api = VmixAPI(config["ip"], config["port"])

        # Input 2-6の状態を追跡（True=ON, False=OFF）
        self.input_states = {
            2: False,
            3: False,
            4: False,
            5: False,
            6: False
        }

        # Input 7の状態を追跡
        self.input7_state = False

        # Input 8の状態を追跡
        self.input8_state = False

        # コマンド実行中フラグ
        self.is_processing = False

        # UIの構築
        self._create_widgets()

        # 初期接続チェック
        self._update_connection_status()

        # 起動時に全状態をリセット
        self._reset_all_states()

    def _create_widgets(self):
        """UI要素を作成"""

        # ===== vMix接続設定エリア =====
        config_frame = ctk.CTkFrame(self)
        config_frame.pack(pady=15, padx=20, fill="x")

        ctk.CTkLabel(config_frame, text="vMix接続設定", font=("", 16, "bold")).pack(pady=5)

        # IPアドレス入力
        ip_frame = ctk.CTkFrame(config_frame, fg_color="transparent")
        ip_frame.pack(pady=5, padx=10, fill="x")
        ctk.CTkLabel(ip_frame, text="IPアドレス:", width=100).pack(side="left", padx=5)
        self.ip_entry = ctk.CTkEntry(ip_frame, placeholder_text="localhost")
        self.ip_entry.pack(side="left", fill="x", expand=True, padx=5)
        config = self.config_manager.load_config()
        self.ip_entry.insert(0, config["ip"])

        # ポート番号入力
        port_frame = ctk.CTkFrame(config_frame, fg_color="transparent")
        port_frame.pack(pady=5, padx=10, fill="x")
        ctk.CTkLabel(port_frame, text="ポート:", width=100).pack(side="left", padx=5)
        self.port_entry = ctk.CTkEntry(port_frame, placeholder_text="8088")
        self.port_entry.pack(side="left", fill="x", expand=True, padx=5)
        self.port_entry.insert(0, str(config["port"]))

        # 設定保存ボタン
        ctk.CTkButton(
            config_frame,
            text="設定を保存",
            command=self._save_config,
            height=35
        ).pack(pady=5, padx=10, fill="x")

        # 接続状態表示
        self.status_label = ctk.CTkLabel(
            config_frame,
            text="接続状態: 未確認",
            font=("", 12)
        )
        self.status_label.pack(pady=5)

        # ===== シーン切り替えボタンエリア =====
        scene_frame = ctk.CTkFrame(self)
        scene_frame.pack(pady=15, padx=20, fill="both", expand=True)

        ctk.CTkLabel(scene_frame, text="シーン切り替え", font=("", 16, "bold")).pack(pady=10)

        # ボタン設定 [ラベル, Input番号, DSKタイプ]
        # DSKタイプ: 1=DSK1のみ, 2=DSK2+Input7(DSK4)
        button_configs = [
            ("X", 1, 1),
            ("運転見合わせ", 2, 2),
            ("運転再開", 3, 2),
            ("欠航", 4, 2),
            ("渋滞", 5, 2),
            ("通行止め", 6, 2)
        ]

        # ボタンを保存しておく（無効化/有効化のため）
        self.scene_buttons = []

        for label, input_num, dsk_type in button_configs:
            btn = ctk.CTkButton(
                scene_frame,
                text=label,
                command=lambda i=input_num, d=dsk_type: self._switch_scene(i, d),
                height=50,
                font=("", 18, "bold"),
                fg_color="#1f6aa5",
                hover_color="#144870"
            )
            btn.pack(pady=5, padx=15, fill="x")
            self.scene_buttons.append(btn)

        # ===== テキスト編集エリア =====
        text_frame = ctk.CTkFrame(self)
        text_frame.pack(pady=15, padx=20, fill="x")

        ctk.CTkLabel(text_frame, text="テキスト編集", font=("", 16, "bold")).pack(pady=5)

        # テキスト入力欄
        self.text_entry = ctk.CTkEntry(
            text_frame,
            placeholder_text="Input 8に設定するテキストを入力",
            height=35
        )
        self.text_entry.pack(pady=5, padx=10, fill="x")

        # テキスト更新ボタン
        ctk.CTkButton(
            text_frame,
            text="テキスト更新",
            command=self._update_text,
            height=40,
            fg_color="#2b5329",
            hover_color="#1a3318"
        ).pack(pady=5, padx=10, fill="x")

    def _save_config(self):
        """設定を保存"""
        try:
            ip = self.ip_entry.get().strip()
            port = int(self.port_entry.get().strip())

            if not ip:
                messagebox.showerror("エラー", "IPアドレスを入力してください")
                return

            if port <= 0 or port > 65535:
                messagebox.showerror("エラー", "有効なポート番号を入力してください (1-65535)")
                return

            config = {"ip": ip, "port": port}

            if self.config_manager.save_config(config):
                self.vmix_api.update_connection(ip, port)
                self._update_connection_status()
                messagebox.showinfo("成功", "設定を保存しました")
            else:
                messagebox.showerror("エラー", "設定の保存に失敗しました")

        except ValueError:
            messagebox.showerror("エラー", "ポート番号は数値で入力してください")

    def _update_connection_status(self):
        """接続状態を更新"""
        if self.vmix_api.test_connection():
            self.status_label.configure(
                text="接続状態: 接続成功 ✓",
                text_color="green"
            )
        else:
            self.status_label.configure(
                text="接続状態: 接続失敗 ✗",
                text_color="red"
            )

    def _reset_all_states(self):
        """起動時にすべてのオーバーレイ状態をリセット"""
        import time

        print("[DEBUG] アプリ起動時の状態リセットを開始...")

        # Input 2-6を明示的にOFFにする
        for input_num in [2, 3, 4, 5, 6]:
            # OverlayInput2Outで明示的にOFFにする
            self.vmix_api._send_command("OverlayInput2Out", input_num)
            time.sleep(0.05)
            self.input_states[input_num] = False
            print(f"[DEBUG] Input {input_num} をOFFに設定")

        # Input 7も明示的にOFFにする (DSK3)
        self.vmix_api.set_downstream_key3_off(7)
        time.sleep(0.05)
        self.input7_state = False
        print(f"[DEBUG] Input 7 をOFFに設定 (DSK3)")

        # Input 8も明示的にOFFにする (DSK4)
        self.vmix_api.set_downstream_key4_off(8)
        time.sleep(0.05)
        self.input8_state = False
        print(f"[DEBUG] Input 8 をOFFに設定 (DSK4)")

        print("[DEBUG] 状態リセット完了")

    def _switch_scene(self, input_num: int, dsk_type: int):
        """シーンを切り替え

        Args:
            input_num: Input番号
            dsk_type: DSKタイプ (1=DSK1のみ, 2=DSK2+Input7)
        """
        # 処理中の場合は無視
        if self.is_processing:
            print("[DEBUG] Processing in progress, ignoring button press")
            return

        # 処理開始 - すべてのボタンを無効化
        self.is_processing = True
        for btn in self.scene_buttons:
            btn.configure(state="disabled")

        try:
            self._execute_switch_scene(input_num, dsk_type)
        finally:
            # 処理完了 - すべてのボタンを有効化
            self.is_processing = False
            for btn in self.scene_buttons:
                btn.configure(state="normal")

    def _execute_switch_scene(self, input_num: int, dsk_type: int):
        """シーンを切り替えの実処理

        Args:
            input_num: Input番号
            dsk_type: DSKタイプ (1=DSK1のみ, 2=DSK2+Input7)
        """
        if dsk_type == 1:
            # Input 1の場合: DSK1のみ
            success = self.vmix_api.set_downstream_key1(input_num)
            if success:
                self.status_label.configure(
                    text="接続状態: コマンド送信成功 ✓",
                    text_color="green"
                )
            else:
                self.status_label.configure(
                    text="接続状態: コマンド送信失敗 ✗",
                    text_color="red"
                )
                messagebox.showerror("エラー", "シーン切り替えに失敗しました")
        elif dsk_type == 2:
            # Input 2-6の場合の処理（排他的動作）
            import time

            # 現在の状態をトグル
            current_state = self.input_states[input_num]
            new_state = not current_state

            print(f"[DEBUG] Input {input_num} current state: {current_state}, new state will be: {new_state}")

            # 他のすべてのInput (2-6)をOFFにする（押したボタン以外）
            for other_input in [2, 3, 4, 5, 6]:
                if other_input != input_num and self.input_states[other_input]:
                    # 現在ONになっている他のInputをOFFにする
                    print(f"[DEBUG] Turning OFF Input {other_input} (exclusive mode)")
                    self.vmix_api.set_downstream_key2(other_input)
                    time.sleep(0.1)  # 100ms待機
                    self.input_states[other_input] = False

            # 押されたボタンの状態を更新
            self.input_states[input_num] = new_state

            # 押されたボタンのオーバーレイを切り替え
            success1 = self.vmix_api.set_downstream_key2(input_num)

            if success1:
                time.sleep(0.1)  # 100ms待機（vMixの処理完了を待つ）

                # Input 7とInput 8の制御: 押したボタンがONなら両方もON、OFFなら両方もOFF
                should_be_on = new_state

                print(f"[DEBUG] Input {input_num} state: {new_state}")
                print(f"[DEBUG] All states: {self.input_states}")
                print(f"[DEBUG] Input 7 current state: {self.input7_state}, Should be ON: {should_be_on}")
                print(f"[DEBUG] Input 8 current state: {self.input8_state}, Should be ON: {should_be_on}")

                # Input 7の状態を管理（DSK3で明示的なON/OFFコマンドを使用）
                success2 = True
                if should_be_on != self.input7_state:
                    if should_be_on:
                        print(f"[DEBUG] Turning Input 7 ON (DSK3)")
                        success2 = self.vmix_api.set_downstream_key3_on(7)
                    else:
                        print(f"[DEBUG] Turning Input 7 OFF (DSK3)")
                        success2 = self.vmix_api.set_downstream_key3_off(7)

                    if success2:
                        self.input7_state = should_be_on
                        print(f"[DEBUG] Input 7 state updated to: {self.input7_state}")
                        time.sleep(0.1)  # Input 7とInput 8の間に待機
                else:
                    print(f"[DEBUG] Input 7 state unchanged (already {self.input7_state})")

                # Input 8の状態を管理（DSK4で明示的なON/OFFコマンドを使用）
                success3 = True
                if should_be_on != self.input8_state:
                    if should_be_on:
                        print(f"[DEBUG] Turning Input 8 ON (DSK4)")
                        success3 = self.vmix_api.set_downstream_key4_on(8)
                    else:
                        print(f"[DEBUG] Turning Input 8 OFF (DSK4)")
                        success3 = self.vmix_api.set_downstream_key4_off(8)

                    if success3:
                        self.input8_state = should_be_on
                        print(f"[DEBUG] Input 8 state updated to: {self.input8_state}")
                else:
                    print(f"[DEBUG] Input 8 state unchanged (already {self.input8_state})")

                if success2 and success3:
                    self.status_label.configure(
                        text="接続状態: コマンド送信成功 ✓",
                        text_color="green"
                    )
                elif not success2:
                    self.status_label.configure(
                        text="接続状態: Input 7の制御に失敗 ✗",
                        text_color="orange"
                    )
                elif not success3:
                    self.status_label.configure(
                        text="接続状態: Input 8の制御に失敗 ✗",
                        text_color="orange"
                    )
                else:
                    self.status_label.configure(
                        text="接続状態: Input 7/8の制御に失敗 ✗",
                        text_color="orange"
                    )
            else:
                self.status_label.configure(
                    text="接続状態: コマンド送信失敗 ✗",
                    text_color="red"
                )
                messagebox.showerror("エラー", "シーン切り替えに失敗しました")

    def _update_text(self):
        """テキストを更新"""
        text = self.text_entry.get()

        if not text:
            messagebox.showwarning("警告", "テキストを入力してください")
            return

        if self.vmix_api.set_text(8, text):
            self.status_label.configure(
                text="接続状態: テキスト更新成功 ✓",
                text_color="green"
            )
            messagebox.showinfo("成功", "テキストを更新しました")
        else:
            self.status_label.configure(
                text="接続状態: テキスト更新失敗 ✗",
                text_color="red"
            )
            messagebox.showerror("エラー", "テキスト更新に失敗しました")


def main():
    app = VmixControlPanel()
    app.mainloop()


if __name__ == "__main__":
    main()
