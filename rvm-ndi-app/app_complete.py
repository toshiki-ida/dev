"""
RobustVideoMatting NDI Application - Complete Version
人物のアルファマスクをNDI出力
"""
import sys
import os
import time
import threading
import json
import numpy as np
import torch
import cv2
from PIL import Image
import customtkinter as ctk
from concurrent.futures import ThreadPoolExecutor

# スレッド数制限（CPU使用率制御）
torch.set_num_threads(4)  # PyTorchのスレッド数を4に制限
cv2.setNumThreads(4)  # OpenCVのスレッド数を4に制限
os.environ['OMP_NUM_THREADS'] = '4'  # OpenMPのスレッド数を4に制限
os.environ['MKL_NUM_THREADS'] = '4'  # Intel MKLのスレッド数を4に制限

# Get base path (works for both script and PyInstaller exe)
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    BASE_PATH = sys._MEIPASS
else:
    # Running as script
    BASE_PATH = os.path.dirname(os.path.abspath(__file__))

# Add RobustVideoMatting to path
sys.path.insert(0, os.path.join(BASE_PATH, 'RobustVideoMatting'))

from model import MattingNetwork
from ndi_wrapper import NDIFinder, NDIReceiver, NDISender

# GPU設定（詳細ログ付き）
print("[INFO] Checking CUDA availability...")
print(f"[INFO] torch.cuda.is_available() = {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"[INFO] CUDA device count: {torch.cuda.device_count()}")
    print(f"[INFO] CUDA device name: {torch.cuda.get_device_name(0)}")
    print(f"[INFO] CUDA version: {torch.version.cuda}")
    DEVICE = 'cuda'
else:
    print("[WARNING] CUDA not available - will use CPU (slower)")
    DEVICE = 'cpu'

print(f"[INFO] Selected device: {DEVICE}")

MODEL_PATH = os.path.join(BASE_PATH, 'RobustVideoMatting', 'rvm_mobilenetv3.pth')
SETTINGS_FILE = 'rvm_settings.json'


class RVMNDIApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        print("=" * 70)
        print("RobustVideoMatting NDI Application - Starting")
        print("=" * 70)

        self.title("RobustVideoMatting NDI Application")
        self.geometry("1920x1080")

        # NDI関連
        self.finder = None
        self.receiver = None
        self.sender = None
        self.preview_receiver = None  # プレビュー専用レシーバー
        self.ndi_sources = []
        self.selected_source = None

        # AI Model
        self.model = None
        self.rec = [None] * 4  # Recurrent states

        # RVM Parameters
        self.downsample_ratio = 0.2  # 0.25→0.2に変更 (高速化のため解像度をさらに下げる)
        self.prev_downsample_ratio = 0.2  # 前回の値を保存
        self.alpha_threshold = 0.5
        self.use_soft_alpha = False  # ソフトアルファ（グラデーション）を使用
        self.alpha_contrast = 1.0  # アルファコントラスト調整
        self.smoothing_enabled = False
        self.smoothing_alpha = 0.3
        self.edge_refinement = False
        self.edge_kernel_size = 3
        self.use_fp16 = True  # FP16 (半精度) モード - GPU演算を2倍高速化

        # Processing
        self.is_processing = False
        self.processing_thread = None

        # Stats
        self.fps_counter = 0
        self.fps_time = time.time()
        self.current_fps = 0

        # Preview control
        self.preview_thread = None
        self.preview_running = False
        self.preview_lock = threading.Lock()  # プレビュー操作の排他制御

        # Load settings
        self.load_settings()

        # Build UI
        self.create_ui()

        # Initialize NDI
        self.initialize_ndi()

    def create_ui(self):
        # メインフレーム
        self.main_frame = ctk.CTkFrame(self)
        self.main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        # タイトル
        title_label = ctk.CTkLabel(
            self.main_frame,
            text="RobustVideoMatting NDI Application",
            font=("Arial", 24, "bold")
        )
        title_label.pack(pady=20)

        # NDIソース選択フレーム
        source_frame = ctk.CTkFrame(self.main_frame)
        source_frame.pack(fill="x", padx=20, pady=10)

        ctk.CTkLabel(source_frame, text="NDI Source:", font=("Arial", 14)).pack(side="left", padx=10)

        self.source_menu = ctk.CTkOptionMenu(
            source_frame,
            values=["Loading..."],
            width=300,
            command=self.on_source_selected
        )
        self.source_menu.pack(side="left", padx=10)

        self.refresh_btn = ctk.CTkButton(
            source_frame,
            text="Refresh",
            command=self.refresh_sources,
            width=100
        )
        self.refresh_btn.pack(side="left", padx=10)

        # モデル設定フレーム
        model_frame = ctk.CTkFrame(self.main_frame)
        model_frame.pack(fill="x", padx=20, pady=10)

        ctk.CTkLabel(model_frame, text="Model:", font=("Arial", 14)).pack(side="left", padx=10)

        self.model_status_label = ctk.CTkLabel(
            model_frame,
            text="Not Loaded",
            font=("Arial", 12)
        )
        self.model_status_label.pack(side="left", padx=10)

        self.load_model_btn = ctk.CTkButton(
            model_frame,
            text="Load Model",
            command=self.load_model,
            width=120
        )
        self.load_model_btn.pack(side="left", padx=10)

        # 出力設定フレーム
        output_frame = ctk.CTkFrame(self.main_frame)
        output_frame.pack(fill="x", padx=20, pady=10)

        ctk.CTkLabel(output_frame, text="NDI Output Name:", font=("Arial", 14)).pack(side="left", padx=10)

        self.output_name_entry = ctk.CTkEntry(
            output_frame,
            width=200,
            placeholder_text="RVM Alpha Mask"
        )
        self.output_name_entry.insert(0, "RVM Alpha Mask")
        self.output_name_entry.pack(side="left", padx=10)

        # 処理開始/停止ボタン
        control_frame = ctk.CTkFrame(self.main_frame)
        control_frame.pack(fill="x", padx=20, pady=10)

        self.start_btn = ctk.CTkButton(
            control_frame,
            text="Start Processing",
            command=self.start_processing,
            width=200,
            height=50,
            font=("Arial", 16, "bold"),
            fg_color="green"
        )
        self.start_btn.pack(side="left", padx=10)

        self.stop_btn = ctk.CTkButton(
            control_frame,
            text="Stop Processing",
            command=self.stop_processing,
            width=200,
            height=50,
            font=("Arial", 16, "bold"),
            fg_color="red",
            state="disabled"
        )
        self.stop_btn.pack(side="left", padx=10)

        # ステータス表示
        self.status_label = ctk.CTkLabel(
            self.main_frame,
            text="Ready",
            font=("Arial", 14)
        )
        self.status_label.pack(pady=10)

        # FPS表示
        self.fps_label = ctk.CTkLabel(
            self.main_frame,
            text="FPS: 0",
            font=("Arial", 12)
        )
        self.fps_label.pack(pady=5)

        # プレビューフレーム
        preview_frame = ctk.CTkFrame(self.main_frame)
        preview_frame.pack(fill="both", expand=True, padx=20, pady=10)

        # 入力プレビュー
        input_preview_frame = ctk.CTkFrame(preview_frame)
        input_preview_frame.pack(side="left", fill="both", expand=True, padx=5)

        ctk.CTkLabel(input_preview_frame, text="Input", font=("Arial", 14, "bold")).pack(pady=5)

        self.input_preview = ctk.CTkLabel(input_preview_frame, text="No input")
        self.input_preview.pack(fill="both", expand=True)

        # 出力プレビュー
        output_preview_frame = ctk.CTkFrame(preview_frame)
        output_preview_frame.pack(side="left", fill="both", expand=True, padx=5)

        ctk.CTkLabel(output_preview_frame, text="Output (Alpha Mask)", font=("Arial", 14, "bold")).pack(pady=5)

        self.output_preview = ctk.CTkLabel(output_preview_frame, text="No output")
        self.output_preview.pack(fill="both", expand=True)

        # RVMパラメータ調整フレーム（最下部に配置）
        self.create_parameter_panel()

    def create_parameter_panel(self):
        """RVMパラメータ調整パネル作成"""
        param_frame = ctk.CTkFrame(self.main_frame)
        param_frame.pack(fill="x", padx=20, pady=5, side="bottom")

        # タイトル
        title_label = ctk.CTkLabel(param_frame, text="RVM Parameters", font=("Arial", 14, "bold"))
        title_label.pack(pady=5)

        # パラメータ用スクロールフレーム（高さを150に縮小）
        scroll_frame = ctk.CTkScrollableFrame(param_frame, height=150)
        scroll_frame.pack(fill="x", padx=10, pady=5)

        # 1. Downsample Ratio
        self.create_slider_with_tooltip(
            scroll_frame,
            "Downsample Ratio",
            0.1, 1.0, 0.25,
            "処理速度とメモリ使用量を調整\n小さい値 = 高速・低品質\n大きい値 = 低速・高品質\n推奨: 0.25-0.5\n注意: 変更するとrecurrent statesがリセットされます",
            self.on_downsample_change
        )

        # 2. Soft Alpha (Gradient Alpha)
        soft_alpha_frame = ctk.CTkFrame(scroll_frame)
        soft_alpha_frame.pack(fill="x", pady=5)

        self.soft_alpha_check = ctk.CTkCheckBox(
            soft_alpha_frame,
            text="Use Soft Alpha (Gradient)",
            command=self.on_soft_alpha_toggle
        )
        self.soft_alpha_check.pack(side="left", padx=10)
        self.create_tooltip(
            self.soft_alpha_check,
            "ソフトアルファを使用（グラデーション）\n人物の境界をふわふわと柔らかく表現\nOFF = 二値化（白黒のみ）\nON = 0-255のグラデーション\n推奨: ONで自然な合成が可能"
        )

        # 3. Alpha Threshold (二値化モード時のみ有効)
        self.create_slider_with_tooltip(
            scroll_frame,
            "Alpha Threshold (Binary)",
            0.0, 1.0, 0.5,
            "人物と背景の境界閾値（二値化モード時のみ）\n小さい値 = より多くを人物として検出\n大きい値 = より厳密に人物を検出\n推奨: 0.3-0.7\n※ Soft Alpha使用時は無効",
            lambda v: setattr(self, 'alpha_threshold', v)
        )

        # 4. Alpha Contrast (ソフトアルファモード時)
        self.create_slider_with_tooltip(
            scroll_frame,
            "Alpha Contrast (Soft)",
            0.1, 3.0, 1.0,
            "アルファのコントラスト調整（ソフトアルファ時）\n小さい値 = ふわふわ（境界が広い）\n1.0 = 標準\n大きい値 = シャープ（境界が狭い）\n推奨: 0.8-1.5\n※ Soft Alpha使用時のみ有効",
            lambda v: setattr(self, 'alpha_contrast', v)
        )

        # 3. Temporal Smoothing
        smooth_frame = ctk.CTkFrame(scroll_frame)
        smooth_frame.pack(fill="x", pady=5)

        self.smooth_check = ctk.CTkCheckBox(
            smooth_frame,
            text="Temporal Smoothing",
            command=self.on_smoothing_toggle
        )
        self.smooth_check.pack(side="left", padx=10)
        self.create_tooltip(self.smooth_check, "時間的平滑化を有効化\nフレーム間のちらつきを軽減\n有効化すると少し遅延が発生する可能性あり")

        self.create_slider_with_tooltip(
            scroll_frame,
            "Smoothing Alpha",
            0.0, 1.0, 0.3,
            "平滑化の強度\n小さい値 = 強い平滑化（遅延大）\n大きい値 = 弱い平滑化（遅延小）\n推奨: 0.2-0.5",
            lambda v: setattr(self, 'smoothing_alpha', v)
        )

        # 4. Edge Refinement
        edge_frame = ctk.CTkFrame(scroll_frame)
        edge_frame.pack(fill="x", pady=5)

        self.edge_check = ctk.CTkCheckBox(
            edge_frame,
            text="Edge Refinement",
            command=self.on_edge_toggle
        )
        self.edge_check.pack(side="left", padx=10)
        self.create_tooltip(self.edge_check, "エッジ精緻化処理\nマスクの境界をより滑らかに\n処理負荷が増加します")

        self.create_slider_with_tooltip(
            scroll_frame,
            "Edge Kernel Size",
            1, 9, 3,
            "エッジ処理のカーネルサイズ（奇数のみ）\n小さい値 = 細かいエッジ処理\n大きい値 = 広範囲のエッジ処理\n推奨: 3-5",
            lambda v: setattr(self, 'edge_kernel_size', int(v) if int(v) % 2 == 1 else int(v) + 1)
        )

        # ボタンフレーム
        button_frame = ctk.CTkFrame(param_frame)
        button_frame.pack(pady=10)

        # リセットボタン
        reset_btn = ctk.CTkButton(
            button_frame,
            text="Reset to Defaults",
            command=self.reset_parameters,
            width=150
        )
        reset_btn.pack(side="left", padx=5)

        # 設定保存ボタン
        save_btn = ctk.CTkButton(
            button_frame,
            text="Save Settings",
            command=self.save_settings,
            width=150,
            fg_color="darkblue"
        )
        save_btn.pack(side="left", padx=5)

        # 設定読み込みボタン
        load_btn = ctk.CTkButton(
            button_frame,
            text="Load Settings",
            command=self.load_settings_btn,
            width=150,
            fg_color="darkgreen"
        )
        load_btn.pack(side="left", padx=5)

    def create_slider_with_tooltip(self, parent, label, from_, to, default, tooltip, command):
        """スライダーとツールチップを作成"""
        frame = ctk.CTkFrame(parent)
        frame.pack(fill="x", pady=5, padx=5)

        # ラベル
        label_widget = ctk.CTkLabel(frame, text=label, font=("Arial", 12), width=150, anchor="w")
        label_widget.pack(side="left", padx=5)
        self.create_tooltip(label_widget, tooltip)

        # 値表示ラベル
        value_label = ctk.CTkLabel(frame, text=f"{default:.2f}", font=("Arial", 12), width=60)
        value_label.pack(side="right", padx=5)

        # スライダー
        slider = ctk.CTkSlider(
            frame,
            from_=from_,
            to=to,
            number_of_steps=100,
            command=lambda v: [command(v), value_label.configure(text=f"{v:.2f}")]
        )
        slider.set(default)
        slider.pack(side="right", fill="x", expand=True, padx=5)
        self.create_tooltip(slider, tooltip)

    def on_downsample_change(self, value):
        """Downsample ratio変更時の処理"""
        # 値のみ更新（recurrent statesのリセットはprocess_frameで行う）
        self.downsample_ratio = value

    def on_soft_alpha_toggle(self):
        """Soft Alpha有効/無効切替"""
        self.use_soft_alpha = bool(self.soft_alpha_check.get())
        mode = "Soft Alpha (Gradient)" if self.use_soft_alpha else "Binary (Hard Edge)"
        print(f"[INFO] Alpha mode changed to: {mode}")

    def on_smoothing_toggle(self):
        """Smoothing有効/無効切替"""
        self.smoothing_enabled = bool(self.smooth_check.get())

    def on_edge_toggle(self):
        """Edge refinement有効/無効切替"""
        self.edge_refinement = bool(self.edge_check.get())

    def create_tooltip(self, widget, text):
        """ツールチップを作成（ホバー時に表示）"""
        def on_enter(event):
            try:
                # 既存のツールチップを削除
                if hasattr(widget, '_tooltip') and widget._tooltip:
                    try:
                        widget._tooltip.destroy()
                    except:
                        pass

                # ツールチップウィンドウ作成
                tooltip = ctk.CTkToplevel(widget)
                tooltip.wm_overrideredirect(True)
                tooltip.wm_geometry(f"+{event.x_root+10}+{event.y_root+10}")

                # 最前面に表示
                tooltip.attributes('-topmost', True)

                label = ctk.CTkLabel(
                    tooltip,
                    text=text,
                    font=("Arial", 10),
                    fg_color=("gray75", "gray25"),
                    corner_radius=5,
                    padx=10,
                    pady=5
                )
                label.pack()

                widget._tooltip = tooltip
            except Exception as e:
                print(f"Tooltip error: {e}")

        def on_leave(event):
            try:
                if hasattr(widget, '_tooltip') and widget._tooltip:
                    widget._tooltip.destroy()
                    widget._tooltip = None
            except Exception as e:
                print(f"Tooltip cleanup error: {e}")

        widget.bind("<Enter>", on_enter)
        widget.bind("<Leave>", on_leave)

    def save_settings(self):
        """設定をJSONファイルに保存"""
        try:
            settings = {
                'downsample_ratio': self.downsample_ratio,
                'alpha_threshold': self.alpha_threshold,
                'use_soft_alpha': self.use_soft_alpha,
                'alpha_contrast': self.alpha_contrast,
                'smoothing_enabled': self.smoothing_enabled,
                'smoothing_alpha': self.smoothing_alpha,
                'edge_refinement': self.edge_refinement,
                'edge_kernel_size': self.edge_kernel_size
            }

            with open(SETTINGS_FILE, 'w') as f:
                json.dump(settings, f, indent=2)

            print(f"[INFO] Settings saved to {SETTINGS_FILE}")
            self.status_label.configure(text="Settings saved successfully")
        except Exception as e:
            print(f"[ERROR] Failed to save settings: {e}")
            self.status_label.configure(text=f"Save failed: {e}")

    def load_settings(self):
        """設定をJSONファイルから読み込み"""
        try:
            if not os.path.exists(SETTINGS_FILE):
                print(f"[INFO] Settings file not found, using defaults")
                return

            with open(SETTINGS_FILE, 'r') as f:
                settings = json.load(f)

            # パラメータを復元
            self.downsample_ratio = settings.get('downsample_ratio', 0.25)
            self.prev_downsample_ratio = self.downsample_ratio
            self.alpha_threshold = settings.get('alpha_threshold', 0.5)
            self.use_soft_alpha = settings.get('use_soft_alpha', False)
            self.alpha_contrast = settings.get('alpha_contrast', 1.0)
            self.smoothing_enabled = settings.get('smoothing_enabled', False)
            self.smoothing_alpha = settings.get('smoothing_alpha', 0.3)
            self.edge_refinement = settings.get('edge_refinement', False)
            self.edge_kernel_size = settings.get('edge_kernel_size', 3)

            print(f"[INFO] Settings loaded from {SETTINGS_FILE}")
        except Exception as e:
            print(f"[ERROR] Failed to load settings: {e}")

    def load_settings_btn(self):
        """設定読み込みボタン用（UIも更新）"""
        self.load_settings()

        # UIコンポーネントの更新
        if hasattr(self, 'soft_alpha_check'):
            if self.use_soft_alpha:
                self.soft_alpha_check.select()
            else:
                self.soft_alpha_check.deselect()

        if hasattr(self, 'smooth_check'):
            if self.smoothing_enabled:
                self.smooth_check.select()
            else:
                self.smooth_check.deselect()

        if hasattr(self, 'edge_check'):
            if self.edge_refinement:
                self.edge_check.select()
            else:
                self.edge_check.deselect()

        self.status_label.configure(text="Settings loaded successfully")
        print("[INFO] Settings loaded and UI updated")

    def reset_parameters(self):
        """パラメータをデフォルト値にリセット"""
        self.downsample_ratio = 0.25
        self.alpha_threshold = 0.5
        self.use_soft_alpha = False
        self.alpha_contrast = 1.0
        self.smoothing_enabled = False
        self.smoothing_alpha = 0.3
        self.edge_refinement = False
        self.edge_kernel_size = 3

        # チェックボックスの状態を更新
        if hasattr(self, 'soft_alpha_check'):
            self.soft_alpha_check.deselect()
        if hasattr(self, 'smooth_check'):
            self.smooth_check.deselect()
        if hasattr(self, 'edge_check'):
            self.edge_check.deselect()

        self.status_label.configure(text="Parameters reset to defaults")

    def on_source_selected(self, source_name):
        """NDIソース選択時のコールバック"""
        print(f"[INFO] Source selected: {source_name}")
        print(f"[DEBUG] Available sources: {len(self.ndi_sources)}")

        # 排他制御でプレビュー操作
        with self.preview_lock:
            # 既存のプレビューを停止
            self.stop_preview()

            # 選択されたソースを検索
            selected_source = None
            for src in self.ndi_sources:
                print(f"[DEBUG] Checking source: {src['name']}")
                if src['name'] == source_name:
                    selected_source = src
                    print(f"[DEBUG] Match found!")
                    break

            if selected_source:
                self.selected_source = selected_source
                self.start_preview()
            else:
                print(f"[WARNING] Source '{source_name}' not found in sources list")

    def start_preview(self):
        """プレビュー開始（入力映像のみ）"""
        if not self.selected_source:
            print("[WARNING] start_preview called but no source selected")
            return

        try:
            print(f"[INFO] Starting preview for source: {self.selected_source['name']}")

            # プレビュー用レシーバー作成
            self.preview_receiver = NDIReceiver(self.selected_source)
            self.preview_receiver.initialize()
            print("[INFO] Preview receiver initialized")

            # 接続確認（最大3秒待機）
            print("[INFO] Waiting for connection...")
            for i in range(30):  # 30 x 100ms = 3秒
                time.sleep(0.1)
                num_conn = self.preview_receiver.get_num_connections()
                if num_conn > 0:
                    print(f"[INFO] Connected to source (took {(i+1)*100}ms)")
                    break
            else:
                print("[WARNING] No connection established yet, but starting preview anyway")

            # プレビュースレッド開始
            self.preview_running = True
            self.preview_thread = threading.Thread(target=self.preview_loop, daemon=True)
            self.preview_thread.start()

            print("[INFO] Preview thread started")
        except Exception as e:
            import traceback
            print(f"[ERROR] Failed to start preview: {e}")
            traceback.print_exc()

    def stop_preview(self):
        """プレビュー停止（lockの中で呼び出される前提）"""
        if not self.preview_running and not self.preview_receiver:
            return  # 既に停止済み

        print("[INFO] Stopping preview...")
        self.preview_running = False

        # スレッドが終了するのを待つ
        if self.preview_thread:
            print("[DEBUG] Waiting for preview thread to stop...")
            self.preview_thread.join(timeout=2)
            self.preview_thread = None
            print("[DEBUG] Preview thread stopped")

        # レシーバーをクローズ
        if self.preview_receiver:
            try:
                print("[DEBUG] Closing preview receiver...")
                self.preview_receiver.close()
                print("[DEBUG] Preview receiver closed")
            except Exception as e:
                print(f"[WARNING] Error closing preview receiver: {e}")
            self.preview_receiver = None

        # NDIリソースが完全に解放されるまで待機
        time.sleep(0.3)
        print("[INFO] Preview stopped")

    def preview_loop(self):
        """プレビューループ（入力映像のみ、60fps目標）"""
        frame_time = 1.0 / 60.0  # 60fps
        frame_count = 0
        first_frame_received = False

        print("[INFO] Preview loop started")

        while self.preview_running:
            start_time = time.time()

            try:
                # レシーバーの状態確認
                if not self.preview_receiver or not self.preview_receiver._is_initialized:
                    print("[ERROR] Preview receiver not initialized in loop")
                    break

                # フレーム受信（短いタイムアウト）
                frame = self.preview_receiver.receive_video(timeout_ms=16)

                if frame is not None:
                    if not first_frame_received:
                        print(f"[INFO] First preview frame received: {frame.shape}")
                        first_frame_received = True

                    frame_count += 1
                    # 入力プレビューのみ更新
                    self.update_input_preview(frame)

                    # 1秒ごとにフレーム数を表示
                    if frame_count % 60 == 0:
                        print(f"[DEBUG] Preview frames: {frame_count}")

                # フレームレート制御
                elapsed = time.time() - start_time
                sleep_time = frame_time - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)

            except Exception as e:
                import traceback
                print(f"[ERROR] Preview loop error: {e}")
                traceback.print_exc()
                time.sleep(0.1)
                # エラーが発生したらループを終了
                break

        print("[INFO] Preview loop ended")

    def update_input_preview(self, input_frame):
        """入力プレビューのみ更新"""
        try:
            preview_w = 800  # 320から800に拡大
            h, w = input_frame.shape[:2]
            preview_h = int(h * preview_w / w)

            # RGB変換とリサイズ
            input_rgb = cv2.cvtColor(input_frame[:, :, :3], cv2.COLOR_BGR2RGB)
            input_small = cv2.resize(input_rgb, (preview_w, preview_h), interpolation=cv2.INTER_LINEAR)
            input_img = Image.fromarray(input_small)
            input_photo = ctk.CTkImage(light_image=input_img, dark_image=input_img, size=(preview_w, preview_h))

            # UIスレッドで更新
            def update():
                self.input_preview.configure(image=input_photo, text="")
                self.input_preview.image = input_photo

            self.after(0, update)

        except Exception as e:
            print(f"Input preview error: {e}")

    def initialize_ndi(self):
        """NDI初期化"""
        try:
            print("[INFO] Initializing NDI...")
            self.finder = NDIFinder()
            self.finder.initialize()
            self.status_label.configure(text="NDI Initialized")
            print("[INFO] NDI initialized successfully")

            # ソースリスト更新
            print("[INFO] Scheduling source refresh in 1 second...")
            self.after(1000, self.refresh_sources)
        except Exception as e:
            import traceback
            print(f"[ERROR] NDI initialization failed: {e}")
            traceback.print_exc()
            self.status_label.configure(text=f"NDI Error: {e}")

    def refresh_sources(self):
        """NDIソースリスト更新"""
        print("[INFO] refresh_sources called")
        if not self.finder:
            print("[WARNING] Finder not initialized")
            return

        try:
            print("[INFO] Waiting 0.5s for source discovery...")
            time.sleep(0.5)  # Wait for source discovery

            print("[INFO] Getting NDI sources...")
            self.ndi_sources = self.finder.get_sources()
            print(f"[INFO] Found {len(self.ndi_sources)} source(s)")

            if self.ndi_sources:
                source_names = [src['name'] for src in self.ndi_sources]
                print(f"[INFO] Sources: {source_names}")
                self.source_menu.configure(values=source_names)

                # 映像があるソースを優先的に選択（Test Pattern, vMix Outputなど）
                preferred_source = None
                for src in self.ndi_sources:
                    if any(keyword in src['name'] for keyword in ['Test Pattern', 'vMix', 'Output']):
                        preferred_source = src
                        break

                # 優先ソースがなければ最初のソースを使用
                if not preferred_source:
                    preferred_source = self.ndi_sources[0]

                self.source_menu.set(preferred_source['name'])
                self.status_label.configure(text=f"Found {len(self.ndi_sources)} source(s)")

                # 選択されたソースでプレビュー開始（排他制御）
                print(f"[INFO] Auto-selecting source: {preferred_source['name']}")
                with self.preview_lock:
                    self.selected_source = preferred_source
                    print(f"[INFO] Starting preview for: {self.selected_source['name']}")
                    self.start_preview()
            else:
                print("[WARNING] No NDI sources found")
                self.source_menu.configure(values=["No sources found"])
                self.status_label.configure(text="No NDI sources found")
        except Exception as e:
            import traceback
            print(f"[ERROR] refresh_sources error: {e}")
            traceback.print_exc()
            self.status_label.configure(text=f"Error: {e}")

    def load_model(self):
        """RVMモデル読み込み"""
        try:
            self.model_status_label.configure(text="Loading...")
            self.load_model_btn.configure(state="disabled")

            # GPU情報を表示
            if DEVICE == 'cuda':
                gpu_name = torch.cuda.get_device_name(0)
                print(f"[INFO] Using GPU: {gpu_name}")
                print(f"[INFO] CUDA Version: {torch.version.cuda}")
                # CUDAの最適化設定
                torch.backends.cudnn.benchmark = True  # 自動最適化
            else:
                print(f"[WARNING] CUDA not available, using CPU (will be slower)")

            # Load model
            self.model = MattingNetwork('mobilenetv3').eval().to(DEVICE)
            self.model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))

            # FP16モード (半精度) で高速化
            if DEVICE == 'cuda' and self.use_fp16:
                self.model = self.model.half()
                print("[INFO] Model converted to FP16 (half precision) for faster inference")

            self.model_status_label.configure(text=f"Loaded (Device: {DEVICE}, FP16: {self.use_fp16})")
            self.status_label.configure(text="Model loaded successfully")
        except Exception as e:
            self.model_status_label.configure(text="Error")
            self.load_model_btn.configure(state="normal")
            self.status_label.configure(text=f"Model Error: {e}")

    def start_processing(self):
        """処理開始"""
        if not self.model:
            self.status_label.configure(text="Please load model first")
            return

        if not self.ndi_sources:
            self.status_label.configure(text="No NDI sources available")
            return

        # Get selected source
        selected_name = self.source_menu.get()
        selected_source = None
        for src in self.ndi_sources:
            if src['name'] == selected_name:
                selected_source = src
                break

        if not selected_source:
            self.status_label.configure(text="Invalid source selection")
            return

        try:
            # プレビューを停止（処理専用のレシーバーを使用）
            with self.preview_lock:
                self.stop_preview()

            # Create receiver
            self.receiver = NDIReceiver(selected_source)
            self.receiver.initialize()

            # Create sender
            output_name = self.output_name_entry.get() or "RVM Alpha Mask"
            self.sender = NDISender(output_name)
            self.sender.initialize()

            # Start processing thread immediately
            self.is_processing = True
            self.processing_thread = threading.Thread(target=self.processing_loop, daemon=True)
            self.processing_thread.start()

            # Update UI
            self.start_btn.configure(state="disabled")
            self.stop_btn.configure(state="normal")
            self.status_label.configure(text="Waiting for video frames...")

        except Exception as e:
            self.status_label.configure(text=f"Start Error: {e}")

    def stop_processing(self):
        """処理停止"""
        self.is_processing = False

        if self.processing_thread:
            self.processing_thread.join(timeout=2)
            self.processing_thread = None

        if self.receiver:
            self.receiver.close()
            self.receiver = None

        if self.sender:
            self.sender.close()
            self.sender = None

        # Reset recurrent states
        self.rec = [None] * 4

        # Reset smoothing history
        if hasattr(self, '_prev_alpha'):
            delattr(self, '_prev_alpha')
        if hasattr(self, '_debug_printed'):
            delattr(self, '_debug_printed')

        # プレビューを再開
        if self.selected_source:
            self.start_preview()

        # Update UI
        self.start_btn.configure(state="normal")
        self.stop_btn.configure(state="disabled")
        self.status_label.configure(text="Stopped")
        self.fps_label.configure(text="FPS: 0")

    def processing_loop(self):
        """メイン処理ループ（60fps目標）"""
        first_frame_received = False
        connection_check_time = time.time()
        frame_wait_timeout = 10.0
        frame_time = 1.0 / 60.0  # 60fps目標

        # パフォーマンス計測用
        timing_log_interval = 100  # 100フレームごとにログ出力
        timing_counter = 0
        timing_stats = {
            'ndi_receive': [],
            'rvm_process': [],
            'ndi_send': [],
            'preview_update': [],
            'total': []
        }

        while self.is_processing:
            loop_start = time.time()

            try:
                # Receive video frame
                t0 = time.time()
                frame = self.receiver.receive_video(timeout_ms=16)
                t1 = time.time()
                timing_stats['ndi_receive'].append((t1 - t0) * 1000)

                if frame is None:
                    if not first_frame_received:
                        elapsed = time.time() - connection_check_time
                        if elapsed > frame_wait_timeout:
                            print(f"[WARNING] No frames received after {frame_wait_timeout} seconds")
                            self.after(0, lambda: self.status_label.configure(text="No video frames (check NDI source)"))
                            connection_check_time = time.time()
                    continue

                # 最初のフレーム受信時の通知
                if not first_frame_received:
                    first_frame_received = True
                    print("[INFO] First frame received, processing started")
                    self.after(0, lambda: self.status_label.configure(text="Processing..."))

                # Process with RVM
                t2 = time.time()
                alpha_mask = self.process_frame(frame)
                t3 = time.time()
                timing_stats['rvm_process'].append((t3 - t2) * 1000)

                if alpha_mask is not None:
                    # Send alpha mask via NDI
                    t4 = time.time()
                    self.sender.send_video(alpha_mask)
                    t5 = time.time()
                    timing_stats['ndi_send'].append((t5 - t4) * 1000)

                    # Update FPS
                    self.fps_counter += 1
                    current_time = time.time()
                    if current_time - self.fps_time >= 1.0:
                        self.current_fps = self.fps_counter
                        self.fps_counter = 0
                        self.fps_time = current_time
                        self.after(0, lambda fps=self.current_fps: self.fps_label.configure(text=f"FPS: {fps}"))

                    # Update preview (5フレームに1回 - カクついてもOK) - 並列処理
                    t6 = time.time()
                    if self.fps_counter % 5 == 0:
                        # 並列処理: プレビュー更新をメインループをブロックせずに実行
                        if not hasattr(self, '_preview_executor'):
                            self._preview_executor = ThreadPoolExecutor(max_workers=1)
                        # 前のフレームをコピーして渡す (参照を切る)
                        frame_copy = frame.copy()
                        alpha_copy = alpha_mask.copy()
                        self._preview_executor.submit(self.update_both_previews, frame_copy, alpha_copy)
                    t7 = time.time()
                    if self.fps_counter % 5 == 0:
                        timing_stats['preview_update'].append((t7 - t6) * 1000)

                # Total timing
                loop_end = time.time()
                timing_stats['total'].append((loop_end - loop_start) * 1000)

                # ログ出力
                timing_counter += 1
                if timing_counter >= timing_log_interval:
                    import statistics
                    print(f"\n[PERFORMANCE] Average timing over {timing_log_interval} frames (ms):")
                    for key, values in timing_stats.items():
                        if values:
                            avg = statistics.mean(values)
                            max_val = max(values)
                            min_val = min(values)
                            print(f"  {key:15s}: avg={avg:6.2f}ms, min={min_val:6.2f}ms, max={max_val:6.2f}ms")

                    total_avg = statistics.mean(timing_stats['total']) if timing_stats['total'] else 0
                    theoretical_fps = 1000.0 / total_avg if total_avg > 0 else 0
                    print(f"  Target: 16.67ms (60fps), Actual: {total_avg:.2f}ms ({theoretical_fps:.1f}fps)")

                    if DEVICE == 'cuda':
                        print(f"  GPU Memory: {torch.cuda.memory_allocated(0) / 1024**2:.1f}MB / {torch.cuda.max_memory_allocated(0) / 1024**2:.1f}MB (max)")
                        torch.cuda.reset_peak_memory_stats()

                    # Reset stats
                    timing_counter = 0
                    timing_stats = {k: [] for k in timing_stats.keys()}

                # フレームレート制御
                elapsed = loop_end - loop_start
                sleep_time = frame_time - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)

            except Exception as e:
                print(f"Processing error: {e}")
                import traceback
                traceback.print_exc()
                time.sleep(0.1)  # エラー時は100msスリープしてCPU負荷を軽減

    def process_frame(self, frame):
        """フレーム処理 - RVMでアルファマスク生成"""
        try:
            # 詳細タイミング計測
            if not hasattr(self, '_rvm_timing_counter'):
                self._rvm_timing_counter = 0
                self._rvm_timings = {
                    'prepare': [],
                    'cpu_to_gpu': [],
                    'model_inference': [],
                    'gpu_postprocess': [],
                    'gpu_to_cpu': [],
                    'cpu_postprocess': []
                }

            t_start = time.time()

            # Check if model is loaded
            if self.model is None:
                print("[ERROR] Model is not loaded!")
                return None

            # BGR to RGB - 最速化
            h, w = frame.shape[:2]

            # Check if downsample_ratio changed
            if abs(self.downsample_ratio - self.prev_downsample_ratio) > 0.01:
                print(f"[INFO] Downsample ratio changed from {self.prev_downsample_ratio:.2f} to {self.downsample_ratio:.2f}, resetting states")
                self.rec = [None] * 4
                if hasattr(self, '_prev_alpha_gpu'):
                    delattr(self, '_prev_alpha_gpu')
                self.prev_downsample_ratio = self.downsample_ratio

            t1 = time.time()
            self._rvm_timings['prepare'].append((t1 - t_start) * 1000)

            # 最速変換: BGR→RGB、numpy→tensor、CPU→GPU
            # 高速化: 連続メモリ配列を作成してからGPU転送 (non_blockingの効果を最大化)
            src_bgr = np.ascontiguousarray(frame[:, :, :3])

            # CPU側でBGR→RGB変換 (メモリレイアウトを最適化)
            # RGB順に並び替え: [..., 0] = B, [..., 1] = G, [..., 2] = R
            src_rgb = src_bgr[:, :, ::-1].copy()  # コピーして連続メモリにする

            # PyTorch tensor作成とGPU転送を1ステップで
            src_tensor = torch.from_numpy(src_rgb).permute(2, 0, 1).unsqueeze(0).float()

            # GPU転送とスケーリングを分離
            if DEVICE == 'cuda':
                src_tensor = src_tensor.cuda(non_blocking=False).div_(255.0)  # 同期転送で確実に
                # FP16モード (半精度) で高速化
                if self.use_fp16:
                    src_tensor = src_tensor.half()
            else:
                src_tensor = src_tensor.div_(255.0)

            # GPU上でダウンサンプル (cv2.resizeをGPU処理に置き換え)
            if self.downsample_ratio != 1.0:
                new_h = max(16, int(h * self.downsample_ratio))
                new_w = max(16, int(w * self.downsample_ratio))
                src_tensor = torch.nn.functional.interpolate(
                    src_tensor,
                    size=(new_h, new_w),
                    mode='bilinear',
                    align_corners=False
                )

            t2 = time.time()
            self._rvm_timings['cpu_to_gpu'].append((t2 - t1) * 1000)

            # First frame GPU check
            if not hasattr(self, '_gpu_check_printed'):
                print(f"[GPU CHECK] Input tensor device: {src_tensor.device}")
                print(f"[GPU CHECK] Input tensor dtype: {src_tensor.dtype}")
                print(f"[GPU CHECK] Input tensor shape: {src_tensor.shape}")
                print(f"[GPU CHECK] Model device: {next(self.model.parameters()).device}")
                if DEVICE == 'cuda':
                    print(f"[GPU CHECK] CUDA memory allocated: {torch.cuda.memory_allocated(0) / 1024**2:.1f} MB")
                    print(f"[GPU CHECK] CUDA memory reserved: {torch.cuda.memory_reserved(0) / 1024**2:.1f} MB")
                self._gpu_check_printed = True

            # Run model
            # Reset recurrent states if they contain invalid data
            if any(r is not None and not isinstance(r, torch.Tensor) for r in self.rec):
                self.rec = [None] * 4

            # Ensure recurrent states are on the same device as input
            rec_on_device = []
            for r in self.rec:
                if r is not None:
                    if r.device != src_tensor.device:
                        print(f"[WARNING] Moving recurrent state from {r.device} to {src_tensor.device}")
                        r = r.to(src_tensor.device)
                rec_on_device.append(r)

            t3 = time.time()

            # CUDAストリームを明示的に同期 (モデル推論前に転送完了を保証)
            if DEVICE == 'cuda':
                torch.cuda.synchronize()

            with torch.no_grad():
                _, pha, *self.rec = self.model(src_tensor, *rec_on_device, self.downsample_ratio)

                # GPU上でリサイズ (CPU転送を最小化)
                if pha.shape[-2:] != (h, w):
                    pha = torch.nn.functional.interpolate(
                        pha,
                        size=(h, w),
                        mode='bilinear',
                        align_corners=False
                    )

            # モデル推論完了を待つ
            if DEVICE == 'cuda':
                torch.cuda.synchronize()

            t4 = time.time()
            self._rvm_timings['model_inference'].append((t4 - t3) * 1000)

            # Get alpha (GPU→CPU転送は最後の1回のみ)
            pha = pha.squeeze(0).squeeze(0)  # (1, 1, H, W) -> (H, W) - まだGPU上

            # Temporal Smoothing（時間的平滑化） - GPU上で実行
            if self.smoothing_enabled:
                if not hasattr(self, '_prev_alpha_gpu'):
                    self._prev_alpha_gpu = pha
                else:
                    # EMA (Exponential Moving Average) - GPU演算
                    pha = self.smoothing_alpha * pha + (1 - self.smoothing_alpha) * self._prev_alpha_gpu
                    self._prev_alpha_gpu = pha

            t5 = time.time()
            self._rvm_timings['gpu_postprocess'].append((t5 - t4) * 1000)

            # アルファ処理をGPU上で実行 (CPU転送を最小化)
            if self.use_soft_alpha:
                # ソフトアルファモード（グラデーション） - GPU上で処理
                if self.alpha_contrast != 1.0:
                    # GPU上でコントラスト調整
                    pha = torch.clamp((pha - 0.5) * self.alpha_contrast + 0.5, 0.0, 1.0)

                # GPU上で0-255に変換してからCPU転送
                pha_uint8 = (pha * 255.0).to(torch.uint8)
                alpha_final = pha_uint8.cpu().numpy()

                # Debug: Print alpha value range (first frame only)
                if not hasattr(self, '_debug_printed'):
                    print(f"[DEBUG] Alpha shape: {alpha_final.shape}")
                    print(f"[DEBUG] Alpha mode: Soft (Gradient)")
                    self._debug_printed = True
            else:
                # 二値化モード - GPU上で処理してからCPU転送
                pha_binary = (pha > self.alpha_threshold).to(torch.uint8) * 255
                alpha_final = pha_binary.cpu().numpy()

                # Debug (first frame only)
                if not hasattr(self, '_debug_printed'):
                    print(f"[DEBUG] Alpha shape: {alpha_final.shape}")
                    print(f"[DEBUG] Alpha mode: Binary (Hard)")
                    self._debug_printed = True

            t6 = time.time()
            self._rvm_timings['gpu_to_cpu'].append((t6 - t5) * 1000)

            # Edge Refinement（CPU側で実行）
            if self.edge_refinement:
                if self.use_soft_alpha:
                    # ソフトアルファのエッジ精緻化
                    alpha_final = cv2.GaussianBlur(alpha_final, (self.edge_kernel_size, self.edge_kernel_size), 0)
                else:
                    # 二値化モードのエッジ精緻化
                    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (self.edge_kernel_size, self.edge_kernel_size))
                    alpha_final = cv2.morphologyEx(alpha_final, cv2.MORPH_OPEN, kernel)  # ノイズ除去
                    alpha_final = cv2.morphologyEx(alpha_final, cv2.MORPH_CLOSE, kernel)  # 穴埋め
                    alpha_final = cv2.GaussianBlur(alpha_final, (self.edge_kernel_size, self.edge_kernel_size), 0)
                    alpha_final = (alpha_final > 127).astype(np.uint8) * 255

            # Create BGRA output - 高速化: numpy broadcasting
            alpha_mask = np.empty((h, w, 4), dtype=np.uint8)
            alpha_mask[:, :, :3] = alpha_final[:, :, np.newaxis]  # BGR全チャンネルに一括設定
            alpha_mask[:, :, 3] = 255  # A

            t7 = time.time()
            self._rvm_timings['cpu_postprocess'].append((t7 - t6) * 1000)

            # 100フレームごとに詳細ログを出力
            self._rvm_timing_counter += 1
            if self._rvm_timing_counter >= 100:
                import statistics
                print(f"\n[RVM DETAILED TIMING] Average over 100 frames:")
                for key, values in self._rvm_timings.items():
                    if values:
                        avg = statistics.mean(values)
                        print(f"  {key:18s}: {avg:6.2f}ms")

                # Reset
                self._rvm_timing_counter = 0
                self._rvm_timings = {k: [] for k in self._rvm_timings.keys()}

            return alpha_mask

        except Exception as e:
            import traceback
            print(f"[ERROR] Frame processing error: {e}")
            print(traceback.format_exc())
            return None

    def update_both_previews(self, input_frame, output_frame):
        """両方のプレビューを更新（60fps目標）"""
        try:
            preview_w = 800  # 320から800に拡大
            h, w = input_frame.shape[:2]
            preview_h = int(h * preview_w / w)

            # Input preview
            input_rgb = cv2.cvtColor(input_frame[:, :, :3], cv2.COLOR_BGR2RGB)
            input_small = cv2.resize(input_rgb, (preview_w, preview_h), interpolation=cv2.INTER_LINEAR)
            input_img = Image.fromarray(input_small)
            input_photo = ctk.CTkImage(light_image=input_img, dark_image=input_img, size=(preview_w, preview_h))

            # Output preview
            output_rgb = cv2.cvtColor(output_frame[:, :, :3], cv2.COLOR_BGR2RGB)
            output_small = cv2.resize(output_rgb, (preview_w, preview_h), interpolation=cv2.INTER_LINEAR)
            output_img = Image.fromarray(output_small)
            output_photo = ctk.CTkImage(light_image=output_img, dark_image=output_img, size=(preview_w, preview_h))

            # UIスレッドで更新
            def update():
                self.input_preview.configure(image=input_photo, text="")
                self.input_preview.image = input_photo
                self.output_preview.configure(image=output_photo, text="")
                self.output_preview.image = output_photo

            self.after(0, update)

        except Exception as e:
            print(f"Preview update error: {e}")

    def on_closing(self):
        """ウィンドウクローズ処理"""
        self.stop_processing()
        self.stop_preview()

        # プレビューExecutorのシャットダウン
        if hasattr(self, '_preview_executor'):
            self._preview_executor.shutdown(wait=False)

        if self.finder:
            self.finder.close()

        self.destroy()


if __name__ == "__main__":
    # Set appearance
    ctk.set_appearance_mode("dark")
    ctk.set_default_color_theme("blue")

    # Run app
    app = RVMNDIApp()
    app.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.mainloop()
