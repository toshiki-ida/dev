"""
vMix Controller - メインアプリケーション
CustomTkinterを使用したGUIアプリケーション
"""
import customtkinter as ctk
from tkinter import filedialog, messagebox, Tk
import os
import time
import threading
from typing import Optional
from file_watcher import FileWatcher
from vmix_controller import VmixController
from config_manager import ConfigManager
from preset_editor import PresetEditorDialog
# from tkinterdnd2 import DND_FILES, TkinterDnD  # Not compatible with CustomTkinter


class VmixControllerApp(ctk.CTk):
    """vMix Controller メインアプリケーション"""

    def __init__(self):
        super().__init__()

        # 設定マネージャー
        self.config_manager = ConfigManager()

        # ウィンドウ設定
        self.title("vMix Controller")
        geometry = self.config_manager.get("window_geometry", "900x700")
        self.geometry(geometry)

        # テーマ設定
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        # ファイル監視
        self.file_watcher = FileWatcher(callback=self.on_new_file)
        self.current_input_name: Optional[str] = None

        # vMix コントローラー
        host, port = self.config_manager.get_vmix_connection()
        self.vmix = VmixController(host=host, port=port)

        # vMix初期設定: Input 2にBlankを確保
        print("[App] Setting up vMix initial configuration...")
        self.vmix.ensure_blank_at_input_2()
        print("[App] vMix initial setup complete: Input 2 is Blank")

        # ポーリング用
        self.polling_active = False

        # モード管理 (AUTO / MANUAL)
        self.current_mode = "AUTO"  # デフォルトはAUTO
        self.playlist = []  # MANUALモード用のプレイリスト: [{"name": "名前", "path": "パス"}, ...]
        self.reorder_mode = False  # 並び替えモード

        # UI構築
        self._create_widgets()

        # 初期設定を読み込み
        self._load_initial_settings()

        # ポーリング開始
        print("[App] Starting polling...")
        self.start_polling()
        print("[App] Polling started")

        # ウィンドウクローズ時のイベント
        self.protocol("WM_DELETE_WINDOW", self.on_closing)

        print("[App] Initialization complete")

    def _create_widgets(self):
        """ウィジェットを作成"""

        # メインフレーム
        self.main_frame = ctk.CTkFrame(self)
        self.main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        # === vMix接続設定 ===
        connection_frame = ctk.CTkFrame(self.main_frame)
        connection_frame.pack(fill="x", padx=10, pady=5)

        ctk.CTkLabel(connection_frame, text="vMix接続設定", font=("", 16, "bold")).pack(pady=5)

        # ホスト設定
        host_frame = ctk.CTkFrame(connection_frame)
        host_frame.pack(fill="x", padx=10, pady=5)

        ctk.CTkLabel(host_frame, text="ホスト:", width=80).pack(side="left", padx=5)
        self.host_entry = ctk.CTkEntry(host_frame, width=150)
        self.host_entry.pack(side="left", padx=5)

        ctk.CTkLabel(host_frame, text="ポート:", width=80).pack(side="left", padx=5)
        self.port_entry = ctk.CTkEntry(host_frame, width=100)
        self.port_entry.pack(side="left", padx=5)

        self.connect_button = ctk.CTkButton(
            host_frame,
            text="接続テスト",
            command=self.test_connection,
            width=100
        )
        self.connect_button.pack(side="left", padx=5)

        # === モード選択 (AUTO / MANUAL) ===
        mode_frame = ctk.CTkFrame(self.main_frame)
        mode_frame.pack(fill="x", padx=10, pady=5)

        ctk.CTkLabel(mode_frame, text="動作モード", font=("", 16, "bold")).pack(pady=5)

        mode_button_frame = ctk.CTkFrame(mode_frame)
        mode_button_frame.pack(fill="x", padx=10, pady=5)

        self.auto_button = ctk.CTkButton(
            mode_button_frame,
            text="AUTO",
            command=self.switch_to_auto,
            width=150,
            fg_color="green"
        )
        self.auto_button.pack(side="left", padx=5)

        self.manual_button = ctk.CTkButton(
            mode_button_frame,
            text="MANUAL",
            command=self.switch_to_manual,
            width=150,
            fg_color="gray"
        )
        self.manual_button.pack(side="left", padx=5)

        # === AUTOモード: ディレクトリ監視設定 ===
        self.auto_mode_frame = ctk.CTkFrame(self.main_frame)
        self.auto_mode_frame.pack(fill="x", padx=10, pady=5)

        ctk.CTkLabel(self.auto_mode_frame, text="AUTOモード: ディレクトリ監視", font=("", 14, "bold")).pack(pady=5)

        dir_select_frame = ctk.CTkFrame(self.auto_mode_frame)
        dir_select_frame.pack(fill="x", padx=10, pady=5)

        self.dir_entry = ctk.CTkEntry(dir_select_frame, placeholder_text="監視するディレクトリを選択...")
        self.dir_entry.pack(side="left", fill="x", expand=True, padx=5)

        ctk.CTkButton(
            dir_select_frame,
            text="参照",
            command=self.select_directory,
            width=100
        ).pack(side="left", padx=5)

        # === MANUALモード: プレイリスト ===
        self.manual_mode_frame = ctk.CTkFrame(self.main_frame)
        # 最初は非表示

        ctk.CTkLabel(self.manual_mode_frame, text="MANUALモード: プレイリスト", font=("", 14, "bold")).pack(pady=5)

        # プレイリスト操作ボタン
        playlist_buttons_frame = ctk.CTkFrame(self.manual_mode_frame)
        playlist_buttons_frame.pack(fill="x", padx=10, pady=5)

        ctk.CTkButton(
            playlist_buttons_frame,
            text="ファイル追加",
            command=self.add_files_to_playlist,
            width=120
        ).pack(side="left", padx=5)

        ctk.CTkButton(
            playlist_buttons_frame,
            text="選択を削除",
            command=self.remove_from_playlist,
            width=120
        ).pack(side="left", padx=5)

        self.reorder_button = ctk.CTkButton(
            playlist_buttons_frame,
            text="並び替え",
            command=self.toggle_reorder_mode,
            width=100,
            fg_color="gray"
        )
        self.reorder_button.pack(side="left", padx=5)

        ctk.CTkButton(
            playlist_buttons_frame,
            text="保存",
            command=self.save_playlist,
            width=80,
            fg_color="#1976d2"
        ).pack(side="left", padx=5)

        ctk.CTkButton(
            playlist_buttons_frame,
            text="読込",
            command=self.load_playlist,
            width=80,
            fg_color="#388e3c"
        ).pack(side="left", padx=5)

        # プレイリスト表示エリア (Listbox)
        from tkinter import Listbox, Scrollbar, SINGLE, END

        playlist_list_frame = ctk.CTkFrame(self.manual_mode_frame)
        playlist_list_frame.pack(fill="both", expand=True, padx=10, pady=5)

        scrollbar = Scrollbar(playlist_list_frame)
        scrollbar.pack(side="right", fill="y")

        self.playlist_listbox = Listbox(
            playlist_list_frame,
            selectmode=SINGLE,  # 単一選択のみ
            yscrollcommand=scrollbar.set,
            bg="#2b2b2b",
            fg="white",
            font=("", 11),
            height=8
        )
        self.playlist_listbox.pack(side="left", fill="both", expand=True)
        scrollbar.config(command=self.playlist_listbox.yview)

        # ドラッグ&ドロップを有効化
        # 注意: tkinterdnd2はCustomTkinterと互換性の問題があるため
        # ファイル追加は「ファイル追加」ボタンを使用してください
        print(f"[App] Note: Drag and drop from Windows Explorer is not fully supported with CustomTkinter.")
        print(f"[App] Please use the 'ファイル追加' button to add files to the playlist.")

        # 選択時にvMixにスタンバイ
        self.playlist_listbox.bind("<<ListboxSelect>>", self.on_playlist_select)

        # 右クリックで名前編集
        self.playlist_listbox.bind("<Button-3>", self.on_playlist_right_click)

        # === ステータス表示 ===
        status_frame = ctk.CTkFrame(self.main_frame)
        status_frame.pack(fill="x", padx=10, pady=5)

        ctk.CTkLabel(status_frame, text="ステータス", font=("", 16, "bold")).pack(pady=5)

        self.status_label = ctk.CTkLabel(
            status_frame,
            text="待機中...",
            font=("", 12),
            wraplength=800
        )
        self.status_label.pack(pady=5, padx=10)

        self.file_label = ctk.CTkLabel(
            status_frame,
            text="ファイル: なし",
            font=("", 11),
            wraplength=800
        )
        self.file_label.pack(pady=5, padx=10)

        # === 再生制御 ===
        control_frame = ctk.CTkFrame(self.main_frame)
        control_frame.pack(fill="x", padx=10, pady=5)

        ctk.CTkLabel(control_frame, text="再生制御", font=("", 16, "bold")).pack(pady=5)

        button_frame = ctk.CTkFrame(control_frame)
        button_frame.pack(fill="x", padx=10, pady=5)

        self.play_button = ctk.CTkButton(
            button_frame,
            text="再生",
            command=self.play_playback,
            width=120,
            fg_color="#388e3c"
        )
        self.play_button.pack(side="left", padx=5, pady=5)

        self.stop_button = ctk.CTkButton(
            button_frame,
            text="停止",
            command=self.stop_playback,
            width=120,
            fg_color="#d32f2f"
        )
        self.stop_button.pack(side="left", padx=5, pady=5)

        self.restart_button = ctk.CTkButton(
            button_frame,
            text="頭出し",
            command=self.restart_playback,
            width=120,
            fg_color="#1976d2"
        )
        self.restart_button.pack(side="left", padx=5, pady=5)

        # === リサイズプリセット ===
        preset_frame = ctk.CTkFrame(self.main_frame)
        preset_frame.pack(fill="both", expand=True, padx=10, pady=5)

        ctk.CTkLabel(preset_frame, text="リサイズプリセット", font=("", 16, "bold")).pack(pady=5)

        # リアルタイムスライダーエリア
        sliders_frame = ctk.CTkFrame(preset_frame)
        sliders_frame.pack(fill="x", padx=10, pady=5)

        # Zoom スライダー
        zoom_frame = ctk.CTkFrame(sliders_frame)
        zoom_frame.pack(fill="x", padx=5, pady=3)
        ctk.CTkLabel(zoom_frame, text="Zoom:", width=80).pack(side="left", padx=5)
        self.zoom_value_label = ctk.CTkLabel(zoom_frame, text="1.00", width=50)
        self.zoom_value_label.pack(side="right", padx=5)
        self.zoom_slider = ctk.CTkSlider(
            zoom_frame, from_=0.1, to=5.0,
            command=self._on_zoom_change
        )
        self.zoom_slider.set(1.0)
        self.zoom_slider.pack(side="left", fill="x", expand=True, padx=5)

        # PanX スライダー
        panx_frame = ctk.CTkFrame(sliders_frame)
        panx_frame.pack(fill="x", padx=5, pady=3)
        ctk.CTkLabel(panx_frame, text="Pan X:", width=80).pack(side="left", padx=5)
        self.panx_value_label = ctk.CTkLabel(panx_frame, text="0.00", width=50)
        self.panx_value_label.pack(side="right", padx=5)
        self.panx_slider = ctk.CTkSlider(
            panx_frame, from_=-2.0, to=2.0,
            command=self._on_panx_change
        )
        self.panx_slider.set(0.0)
        self.panx_slider.pack(side="left", fill="x", expand=True, padx=5)

        # PanY スライダー
        pany_frame = ctk.CTkFrame(sliders_frame)
        pany_frame.pack(fill="x", padx=5, pady=3)
        ctk.CTkLabel(pany_frame, text="Pan Y:", width=80).pack(side="left", padx=5)
        self.pany_value_label = ctk.CTkLabel(pany_frame, text="0.00", width=50)
        self.pany_value_label.pack(side="right", padx=5)
        self.pany_slider = ctk.CTkSlider(
            pany_frame, from_=-2.0, to=2.0,
            command=self._on_pany_change
        )
        self.pany_slider.set(0.0)
        self.pany_slider.pack(side="left", fill="x", expand=True, padx=5)

        # プリセットボタンエリア
        ctk.CTkLabel(preset_frame, text="保存済みプリセット (右クリックで現在の設定を保存)", font=("", 12)).pack(pady=5)

        self.preset_buttons_frame = ctk.CTkFrame(preset_frame)
        self.preset_buttons_frame.pack(fill="both", expand=True, padx=10, pady=5)

        self.preset_buttons = []
        self._create_preset_buttons()

    def _create_preset_buttons(self):
        """プリセットボタンを作成"""
        # 既存のボタンをクリア
        for button in self.preset_buttons:
            button.destroy()
        self.preset_buttons.clear()

        presets = self.config_manager.get_presets()

        # 3列×2行でボタンを配置
        for i, preset in enumerate(presets):
            row = i // 3
            col = i % 3

            button = ctk.CTkButton(
                self.preset_buttons_frame,
                text=f"{preset['name']}\nZ:{preset.get('zoom', 1.0):.1f} X:{preset.get('panX', 0.0):.1f} Y:{preset.get('panY', 0.0):.1f}",
                command=lambda p=preset: self._load_preset_to_sliders(p),
                height=80,
                font=("", 12)
            )
            button.grid(row=row, column=col, padx=5, pady=5, sticky="nsew")

            # 右クリックで現在のスライダー値を保存
            button.bind("<Button-3>", lambda e, idx=i: self._save_current_to_preset(idx))

            self.preset_buttons.append(button)

        # グリッドの列と行の重みを設定
        for i in range(3):
            self.preset_buttons_frame.grid_columnconfigure(i, weight=1)
        for i in range(2):
            self.preset_buttons_frame.grid_rowconfigure(i, weight=1)

    def _load_initial_settings(self):
        """初期設定を読み込み"""
        host, port = self.config_manager.get_vmix_connection()
        self.host_entry.insert(0, host)
        self.port_entry.insert(0, str(port))

        watch_dir = self.config_manager.get_watch_directory()
        if watch_dir:
            self.dir_entry.insert(0, watch_dir)

    def select_directory(self):
        """ディレクトリ選択ダイアログを表示"""
        directory = filedialog.askdirectory(title="監視するディレクトリを選択")
        if directory:
            self.dir_entry.delete(0, "end")
            self.dir_entry.insert(0, directory)
            self.config_manager.set_watch_directory(directory)
            self.config_manager.save_config()


    def on_new_file(self, file_path: str):
        """
        新しいファイルが検出されたときのコールバック

        Args:
            file_path: 検出されたファイルのパス
        """
        # GUIスレッドで実行
        self.after(0, lambda: self._process_new_file(file_path))

    def _process_new_file(self, file_path: str):
        """
        新しいファイルを処理

        Args:
            file_path: ファイルのパス
        """
        self.file_label.configure(text=f"ファイル: {os.path.basename(file_path)}")

        # 現在の入力が再生中かチェック
        print(f"[App] New file detected: {file_path}")
        print(f"[App] Current input: {self.current_input_name}")

        if self.current_input_name:
            is_playing = self.vmix.is_input_playing(self.current_input_name)
            print(f"[App] Is current input playing? {is_playing}")

            if is_playing:
                # 再生中の場合はスタンバイしない
                self.status_label.configure(
                    text=f"再生中のためスタンバイしません: {os.path.basename(file_path)}"
                )
                print(f"[App] Skipping standby (playback in progress): {file_path}")
                return

        # 再生中でない場合は即座にスタンバイ
        print(f"[App] Proceeding with standby")
        self.status_label.configure(text=f"新しいファイルを検出: {os.path.basename(file_path)}")
        # vMixに追加
        if self.config_manager.get("auto_add_to_vmix", True):
            threading.Thread(target=self._add_to_vmix, args=(file_path,), daemon=True).start()

    def _add_to_vmix(self, file_path: str):
        """
        vMixのInput 1にファイルを設定

        Args:
            file_path: ファイルのパス
        """
        try:
            print(f"[App] Processing file: {file_path}")

            # ファイルパスを正規化
            normalized_path = file_path.replace('/', '\\')  # Windowsパスに統一
            print(f"[App] Setting Input 1 to: {normalized_path}")

            # Input 1を入れ替える（素材は増えない）
            if self.vmix.replace_input_1(normalized_path):
                filename = os.path.basename(file_path)
                self.current_input_name = "1"  # 常にInput 1

                print(f"[App] Input 1 replaced successfully: {filename}")
                self.after(0, lambda: self.status_label.configure(
                    text=f"Input 1に設定: {filename}"
                ))
            else:
                print(f"[App] Failed to replace Input 1")
                self.after(0, lambda: self.status_label.configure(
                    text=f"Input 1の設定に失敗しました"
                ))
        except Exception as e:
            print(f"[App] Exception: {e}")
            import traceback
            traceback.print_exc()
            self.after(0, lambda: self.status_label.configure(
                text=f"エラー: {str(e)}"
            ))

    def _on_zoom_change(self, value):
        """Zoomスライダーが変更されたときのコールバック"""
        zoom = float(value)
        self.zoom_value_label.configure(text=f"{zoom:.2f}")
        # プリセット読み込み中はvMixへの送信をスキップ
        if not getattr(self, '_slider_updating', False):
            self._apply_current_sliders()

    def _on_panx_change(self, value):
        """PanXスライダーが変更されたときのコールバック"""
        panx = float(value)
        self.panx_value_label.configure(text=f"{panx:.2f}")
        # プリセット読み込み中はvMixへの送信をスキップ
        if not getattr(self, '_slider_updating', False):
            self._apply_current_sliders()

    def _on_pany_change(self, value):
        """PanYスライダーが変更されたときのコールバック"""
        pany = float(value)
        self.pany_value_label.configure(text=f"{pany:.2f}")
        # プリセット読み込み中はvMixへの送信をスキップ
        if not getattr(self, '_slider_updating', False):
            self._apply_current_sliders()

    def _apply_current_sliders(self):
        """現在のスライダー値をvMixに適用"""
        input_target = self.current_input_name if self.current_input_name else "1"

        zoom = float(self.zoom_slider.get())
        panx = float(self.panx_slider.get())
        pany = float(self.pany_slider.get())

        # リアルタイム適用
        self.vmix.set_input_zoom(input_target, zoom)
        self.vmix.set_input_pan(input_target, panx, pany)

    def _load_preset_to_sliders(self, preset: dict):
        """プリセットをスライダーにロード"""
        zoom = preset.get('zoom', 1.0)
        panx = preset.get('panX', 0.0)
        pany = preset.get('panY', 0.0)

        # スライダーのコールバックを一時的に無効化
        self._slider_updating = True

        # スライダーに値を設定
        self.zoom_slider.set(zoom)
        self.zoom_value_label.configure(text=f"{zoom:.2f}")

        self.panx_slider.set(panx)
        self.panx_value_label.configure(text=f"{panx:.2f}")

        self.pany_slider.set(pany)
        self.pany_value_label.configure(text=f"{pany:.2f}")

        # コールバックを再有効化
        self._slider_updating = False

        # 一度だけvMixに適用
        self._apply_current_sliders()
        self.status_label.configure(text=f"プリセット読み込み: {preset['name']}")

    def _save_current_to_preset(self, preset_index: int):
        """現在のスライダー値をプリセットに保存"""
        # プリセット名を入力
        from tkinter import simpledialog

        presets = self.config_manager.get_presets()
        if preset_index >= len(presets):
            return

        current_preset = presets[preset_index]

        # ダイアログで名前を入力
        new_name = simpledialog.askstring(
            "プリセット名",
            "プリセット名を入力してください:",
            initialvalue=current_preset['name']
        )

        if new_name is None:  # キャンセルされた
            return

        # 現在のスライダー値を取得
        zoom = float(self.zoom_slider.get())
        panx = float(self.panx_slider.get())
        pany = float(self.pany_slider.get())

        # プリセットを更新
        presets[preset_index]['name'] = new_name
        presets[preset_index]['zoom'] = zoom
        presets[preset_index]['panX'] = panx
        presets[preset_index]['panY'] = pany

        # 保存
        self.config_manager.set_presets(presets)
        self.config_manager.save_config()

        # ボタンを再作成
        self._create_preset_buttons()

        self.status_label.configure(text=f"プリセット保存: {new_name}")
        messagebox.showinfo("成功", f"プリセット '{new_name}' を保存しました。")

    def apply_preset(self, preset: dict):
        """
        リサイズプリセットを適用

        Args:
            preset: プリセット設定
        """
        # 常にInput 1に対してプリセットを適用
        # current_input_nameがある場合はそれを使用し、なければ"1"を使用
        input_target = self.current_input_name if self.current_input_name else "1"

        try:
            if self.vmix.apply_preset(input_target, preset):
                self.status_label.configure(
                    text=f"プリセット適用: {preset['name']} (Input {input_target})"
                )
            else:
                messagebox.showerror("エラー", "プリセットの適用に失敗しました。")
        except Exception as e:
            messagebox.showerror("エラー", f"プリセットの適用中にエラーが発生しました: {e}")

    def _edit_preset(self, preset_index: int):
        """
        プリセットを編集

        Args:
            preset_index: プリセットのインデックス
        """
        presets = self.config_manager.get_presets()
        if preset_index >= len(presets):
            return

        preset = presets[preset_index]

        def on_save(updated_preset: dict):
            """プリセット保存時のコールバック"""
            try:
                print(f"[App] on_save called with preset: {updated_preset}")
                presets[preset_index] = updated_preset
                self.config_manager.set_presets(presets)

                if self.config_manager.save_config():
                    print("[App] Config saved successfully")
                    # ボタンを再作成
                    self._create_preset_buttons()
                    self.status_label.configure(text=f"プリセット '{updated_preset['name']}' を保存しました")
                else:
                    print("[App] Config save failed")
                    messagebox.showerror("エラー", "プリセットの保存に失敗しました")

            except Exception as e:
                print(f"[App] Error in on_save: {e}")
                import traceback
                traceback.print_exc()
                messagebox.showerror("エラー", f"プリセットの保存に失敗しました: {e}")

        # 編集ダイアログを開く
        PresetEditorDialog(self, preset, on_save)

    def play_playback(self):
        """再生を開始"""
        if not self.current_input_name:
            messagebox.showwarning("警告", "スタンバイ中の入力がありません。")
            return

        try:
            if self.vmix.play_input(self.current_input_name):
                self.status_label.configure(text="再生を開始しました")
                print(f"[App] Playback started: {self.current_input_name}")
            else:
                messagebox.showerror("エラー", "再生開始に失敗しました。")
        except Exception as e:
            messagebox.showerror("エラー", f"再生開始中にエラーが発生しました: {e}")

    def stop_playback(self):
        """再生を停止"""
        if not self.current_input_name:
            messagebox.showwarning("警告", "スタンバイ中の入力がありません。")
            return

        try:
            if self.vmix.pause_input(self.current_input_name):
                self.status_label.configure(text="再生を停止しました")
                print(f"[App] Playback stopped: {self.current_input_name}")
            else:
                messagebox.showerror("エラー", "再生停止に失敗しました。")
        except Exception as e:
            messagebox.showerror("エラー", f"再生停止中にエラーが発生しました: {e}")

    def restart_playback(self):
        """頭出し（先頭に戻す）"""
        if not self.current_input_name:
            messagebox.showwarning("警告", "スタンバイ中の入力がありません。")
            return

        try:
            if self.vmix.restart_input(self.current_input_name):
                self.status_label.configure(text="頭出ししました")
                print(f"[App] Playback restarted: {self.current_input_name}")
            else:
                messagebox.showerror("エラー", "頭出しに失敗しました。")
        except Exception as e:
            messagebox.showerror("エラー", f"頭出し中にエラーが発生しました: {e}")

    def start_polling(self):
        """ポーリングを開始"""
        self.polling_active = True
        self._poll_vmix_status()

    def stop_polling(self):
        """ポーリングを停止"""
        self.polling_active = False

    def _poll_vmix_status(self):
        """vMixのステータスをポーリング（1秒間隔）"""
        if not self.polling_active:
            return

        # 現在は再生状態の監視のみ（将来的に必要な処理を追加可能）
        try:
            if self.current_input_name:
                # 再生状態を取得（ログ等で利用可能）
                is_playing = self.vmix.is_input_playing(self.current_input_name)
                print(f"[App] Polling: current_input={self.current_input_name}, is_playing={is_playing}")

        except Exception as e:
            print(f"[App] Polling error: {e}")

        # 1秒後に再度ポーリング
        self.after(1000, self._poll_vmix_status)

    def test_connection(self):
        """vMix接続をテスト"""
        try:
            host = self.host_entry.get()
            port = int(self.port_entry.get())

            # 設定を保存
            self.config_manager.set_vmix_connection(host, port)
            self.config_manager.save_config()

            # vMixコントローラーを更新
            self.vmix = VmixController(host=host, port=port)

            # 接続テスト
            status = self.vmix.get_xml_status()
            if status:
                messagebox.showinfo("成功", f"vMixに接続できました\n({host}:{port})")
            else:
                messagebox.showerror("エラー", f"vMixに接続できませんでした\n({host}:{port})")
        except ValueError:
            messagebox.showerror("エラー", "ポート番号は数値で入力してください。")
        except Exception as e:
            messagebox.showerror("エラー", f"接続テスト中にエラーが発生しました: {e}")

    def switch_to_auto(self):
        """AUTOモードに切り替え"""
        self.current_mode = "AUTO"

        # ボタンの色を変更
        self.auto_button.configure(fg_color="green")
        self.manual_button.configure(fg_color="gray")

        # フレームの表示切り替え
        self.auto_mode_frame.pack(fill="x", padx=10, pady=5, after=self.manual_button.master)
        self.manual_mode_frame.pack_forget()

        # ファイル監視を開始（ディレクトリが設定されている場合）
        directory = self.dir_entry.get()
        if directory and os.path.exists(directory):
            if not self.file_watcher.is_watching():
                self.file_watcher.start_watching(directory)
                self.status_label.configure(text=f"AUTOモード: 監視中 - {directory}")
        else:
            self.status_label.configure(text="AUTOモード: ディレクトリを選択してください")

    def switch_to_manual(self):
        """MANUALモードに切り替え"""
        self.current_mode = "MANUAL"

        # ボタンの色を変更
        self.auto_button.configure(fg_color="gray")
        self.manual_button.configure(fg_color="green")

        # フレームの表示切り替え
        self.auto_mode_frame.pack_forget()
        self.manual_mode_frame.pack(fill="both", expand=True, padx=10, pady=5, after=self.manual_button.master)

        # ファイル監視を停止
        if self.file_watcher.is_watching():
            self.file_watcher.stop_watching()

        self.status_label.configure(text="MANUALモード: プレイリストからファイルを選択")

    def add_files_to_playlist(self):
        """ファイル追加ダイアログを開いてプレイリストに追加"""
        from tkinter import END

        filetypes = [
            ("ビデオファイル", "*.mp4 *.avi *.mov *.wmv *.mkv *.flv *.m4v"),
            ("画像ファイル", "*.jpg *.jpeg *.png *.bmp *.gif"),
            ("すべてのファイル", "*.*")
        ]

        files = filedialog.askopenfilenames(
            title="プレイリストに追加するファイルを選択",
            filetypes=filetypes
        )

        if files:
            for file_path in files:
                # 既に存在するかチェック（パスで比較）
                if not any(item["path"] == file_path for item in self.playlist):
                    # デフォルトの名前はファイル名（拡張子なし）
                    default_name = os.path.splitext(os.path.basename(file_path))[0]

                    item = {"name": default_name, "path": file_path}
                    self.playlist.append(item)

                    # 表示: "名前 - ファイル名"
                    display_text = f"{item['name']} - {os.path.basename(file_path)}"
                    self.playlist_listbox.insert(END, display_text)

            self.status_label.configure(text=f"{len(files)}個のファイルを追加しました")

    def remove_from_playlist(self):
        """選択されたアイテムをプレイリストから削除"""
        selected_indices = self.playlist_listbox.curselection()

        if not selected_indices:
            messagebox.showwarning("警告", "削除するアイテムを選択してください")
            return

        # 逆順で削除（インデックスのずれを防ぐ）
        for index in reversed(selected_indices):
            self.playlist_listbox.delete(index)
            del self.playlist[index]

        self.status_label.configure(text=f"{len(selected_indices)}個のアイテムを削除しました")

    def toggle_reorder_mode(self):
        """並び替えモードの切り替え"""
        self.reorder_mode = not self.reorder_mode

        if self.reorder_mode:
            # 並び替えモードON
            self.reorder_button.configure(fg_color="orange", text="並び替え中")
            self.status_label.configure(text="並び替えモード: アイテムをドラッグして順番を変更")

            # リスト内ドラッグ&ドロップを有効化
            self.playlist_listbox.bind("<Button-1>", self.on_drag_start)
            self.playlist_listbox.bind("<B1-Motion>", self.on_drag_motion)
            self.playlist_listbox.bind("<ButtonRelease-1>", self.on_drag_release)

            # 選択イベントを一時的に無効化（並び替え中はスタンバイしない）
            self.playlist_listbox.unbind("<<ListboxSelect>>")
        else:
            # 並び替えモードOFF
            self.reorder_button.configure(fg_color="gray", text="並び替え")
            self.status_label.configure(text="MANUALモード: プレイリストからファイルを選択")

            # ドラッグ&ドロップを無効化
            self.playlist_listbox.unbind("<Button-1>")
            self.playlist_listbox.unbind("<B1-Motion>")
            self.playlist_listbox.unbind("<ButtonRelease-1>")

            # 選択イベントを再有効化
            self.playlist_listbox.bind("<<ListboxSelect>>", self.on_playlist_select)

    def on_drag_start(self, event):
        """ドラッグ開始"""
        self.drag_start_index = self.playlist_listbox.nearest(event.y)

    def on_drag_motion(self, event):
        """ドラッグ中"""
        # 現在のマウス位置に対応するインデックス
        current_index = self.playlist_listbox.nearest(event.y)

        if hasattr(self, 'drag_start_index') and current_index != self.drag_start_index:
            # 視覚的なフィードバック（カーソル位置をハイライト）
            self.playlist_listbox.selection_clear(0, 'end')
            self.playlist_listbox.selection_set(current_index)

    def on_drag_release(self, event):
        """ドラッグ終了"""
        if not hasattr(self, 'drag_start_index'):
            return

        drop_index = self.playlist_listbox.nearest(event.y)

        if drop_index != self.drag_start_index and 0 <= drop_index < len(self.playlist):
            # アイテムを移動
            item = self.playlist.pop(self.drag_start_index)
            self.playlist.insert(drop_index, item)

            # Listboxを再構築
            self._refresh_playlist_display()

            # 移動後のアイテムを選択
            self.playlist_listbox.selection_set(drop_index)

        del self.drag_start_index

    def _refresh_playlist_display(self):
        """プレイリストの表示を更新"""
        from tkinter import END

        self.playlist_listbox.delete(0, END)

        for item in self.playlist:
            display_text = f"{item['name']} - {os.path.basename(item['path'])}"
            self.playlist_listbox.insert(END, display_text)

    def save_playlist(self):
        """プレイリストをファイルに保存"""
        import json

        if not self.playlist:
            messagebox.showwarning("警告", "プレイリストが空です")
            return

        file_path = filedialog.asksaveasfilename(
            title="プレイリストを保存",
            defaultextension=".json",
            filetypes=[("JSONファイル", "*.json"), ("すべてのファイル", "*.*")]
        )

        if file_path:
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(self.playlist, f, ensure_ascii=False, indent=2)

                messagebox.showinfo("成功", f"プレイリストを保存しました:\n{file_path}")
                self.status_label.configure(text=f"プレイリスト保存: {os.path.basename(file_path)}")
            except Exception as e:
                messagebox.showerror("エラー", f"プレイリストの保存に失敗しました:\n{e}")

    def load_playlist(self):
        """プレイリストをファイルから読み込み"""
        import json
        from tkinter import END

        file_path = filedialog.askopenfilename(
            title="プレイリストを読み込み",
            filetypes=[("JSONファイル", "*.json"), ("すべてのファイル", "*.*")]
        )

        if file_path:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    loaded_playlist = json.load(f)

                # プレイリストをクリアして読み込み
                self.playlist.clear()
                self.playlist_listbox.delete(0, END)

                for item in loaded_playlist:
                    # 辞書形式でない場合（古い形式）は変換
                    if isinstance(item, str):
                        default_name = os.path.splitext(os.path.basename(item))[0]
                        item = {"name": default_name, "path": item}

                    self.playlist.append(item)

                    # 表示: "名前 - ファイル名"
                    display_text = f"{item['name']} - {os.path.basename(item['path'])}"
                    self.playlist_listbox.insert(END, display_text)

                messagebox.showinfo("成功", f"{len(loaded_playlist)}個のアイテムを読み込みました")
                self.status_label.configure(text=f"プレイリスト読込: {os.path.basename(file_path)}")
            except Exception as e:
                messagebox.showerror("エラー", f"プレイリストの読み込みに失敗しました:\n{e}")

    def on_playlist_select(self, event):
        """プレイリストアイテムが選択されたときにvMixにスタンバイ"""
        selected_indices = self.playlist_listbox.curselection()

        print(f"[App] Playlist selection changed: {selected_indices}")

        if not selected_indices:
            return

        # 最初の選択アイテムを使用
        index = selected_indices[0]
        item = self.playlist[index]
        file_path = item["path"]

        print(f"[App] Selected item: {item['name']} - {file_path}")

        # Input 1の素材を入れ替える
        print(f"[App] Replacing Input 1 with: {file_path}")
        if self.vmix.replace_input_1(file_path):
            self.current_input_name = "1"  # Input 1に固定
            filename = os.path.basename(file_path)
            self.file_label.configure(text=f"ファイル: {filename}")
            self.status_label.configure(text=f"スタンバイ: {item['name']}")
            print(f"[App] Input 1 replaced successfully: {item['name']}")
        else:
            # 失敗してもエラーダイアログは表示しない（ログのみ）
            print(f"[App] Failed to replace Input 1: {file_path}")

    def on_playlist_right_click(self, event):
        """プレイリストアイテムを右クリックして名前を編集"""
        from tkinter import simpledialog

        # クリックされた位置のアイテムを取得
        index = self.playlist_listbox.nearest(event.y)

        if index < 0 or index >= len(self.playlist):
            return

        item = self.playlist[index]

        # 名前を入力するダイアログ
        new_name = simpledialog.askstring(
            "名前を編集",
            "アイテムの名前を入力してください:",
            initialvalue=item["name"]
        )

        if new_name is None:  # キャンセルされた
            return

        # 名前を更新
        item["name"] = new_name

        # Listboxの表示を更新
        display_text = f"{item['name']} - {os.path.basename(item['path'])}"
        self.playlist_listbox.delete(index)
        self.playlist_listbox.insert(index, display_text)
        self.playlist_listbox.selection_set(index)

        self.status_label.configure(text=f"名前を変更: {new_name}")

    # def on_drop_files(self, event):
    #     """ファイルがドラッグ&ドロップされたときの処理"""
    #     # Note: This method is not currently used because tkinterdnd2 is not compatible with CustomTkinter
    #     # Use the 'ファイル追加' button instead to add files to the playlist
    #     pass

    def on_closing(self):
        """ウィンドウを閉じるときの処理"""
        # ポーリングを停止
        self.stop_polling()

        # 監視を停止
        if self.file_watcher.is_watching():
            self.file_watcher.stop_watching()

        # ウィンドウサイズを保存
        self.config_manager.set("window_geometry", self.geometry())
        self.config_manager.save_config()

        self.destroy()


def main():
    """メイン関数"""
    print("[App] Creating VmixControllerApp...")
    try:
        app = VmixControllerApp()
        print("[App] App created, starting mainloop...")
        app.mainloop()
        print("[App] Mainloop ended")
    except Exception as e:
        print(f"[App] Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
