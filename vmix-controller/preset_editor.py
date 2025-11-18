"""
プリセット編集ダイアログ
"""
import customtkinter as ctk
from typing import Dict, Any, Callable, Optional


class PresetEditorDialog(ctk.CTkToplevel):
    """プリセット編集ダイアログ"""

    def __init__(self, parent, preset: Dict[str, Any], on_save: Optional[Callable[[Dict[str, Any]], None]] = None):
        """
        初期化

        Args:
            parent: 親ウィンドウ
            preset: 編集するプリセット
            on_save: 保存時のコールバック
        """
        super().__init__(parent)

        self.preset = preset.copy()
        self.on_save = on_save

        self.title(f"プリセット編集: {preset['name']}")
        self.geometry("600x800")

        # モーダルダイアログにする
        self.transient(parent)
        self.grab_set()

        self._create_widgets()

    def _create_widgets(self):
        """ウィジェットを作成"""

        # メインフレーム
        main_frame = ctk.CTkScrollableFrame(self)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        # 名前
        name_frame = ctk.CTkFrame(main_frame)
        name_frame.pack(fill="x", pady=5)

        ctk.CTkLabel(name_frame, text="プリセット名:", width=100).pack(side="left", padx=5)
        self.name_entry = ctk.CTkEntry(name_frame, width=300)
        self.name_entry.insert(0, self.preset.get("name", ""))
        self.name_entry.pack(side="left", padx=5)

        # 位置とサイズ
        self._create_section(main_frame, "位置とサイズ")

        self.x_slider = self._create_slider(main_frame, "X座標", 0, 1920, self.preset.get("x", 0))
        self.y_slider = self._create_slider(main_frame, "Y座標", 0, 1080, self.preset.get("y", 0))
        self.width_slider = self._create_slider(main_frame, "幅", 100, 1920, self.preset.get("width", 1920))
        self.height_slider = self._create_slider(main_frame, "高さ", 100, 1080, self.preset.get("height", 1080))

        # Zoom
        self._create_section(main_frame, "Zoom")
        zoom_value = self.preset.get("zoom", 1.0)
        print(f"[PresetEditor] Loading zoom: {zoom_value}")
        self.zoom_slider = self._create_slider(main_frame, "Zoom", 0.1, 5.0, zoom_value, 0.01)

        # Pan
        self._create_section(main_frame, "Pan")
        panX_value = self.preset.get("panX", 0.0)
        panY_value = self.preset.get("panY", 0.0)
        print(f"[PresetEditor] Loading pan: X={panX_value}, Y={panY_value}")
        self.panX_slider = self._create_slider(main_frame, "Pan X", -2.0, 2.0, panX_value, 0.01)
        self.panY_slider = self._create_slider(main_frame, "Pan Y", -2.0, 2.0, panY_value, 0.01)

        # Crop
        self._create_section(main_frame, "Crop (0.0-1.0)")
        cropX1_value = self.preset.get("cropX1", 0.0)
        cropY1_value = self.preset.get("cropY1", 0.0)
        cropX2_value = self.preset.get("cropX2", 1.0)
        cropY2_value = self.preset.get("cropY2", 1.0)
        print(f"[PresetEditor] Loading crop: X1={cropX1_value}, Y1={cropY1_value}, X2={cropX2_value}, Y2={cropY2_value}")
        self.cropX1_slider = self._create_slider(main_frame, "Crop X1 (左)", 0.0, 1.0, cropX1_value, 0.01)
        self.cropY1_slider = self._create_slider(main_frame, "Crop Y1 (上)", 0.0, 1.0, cropY1_value, 0.01)
        self.cropX2_slider = self._create_slider(main_frame, "Crop X2 (右)", 0.0, 1.0, cropX2_value, 0.01)
        self.cropY2_slider = self._create_slider(main_frame, "Crop Y2 (下)", 0.0, 1.0, cropY2_value, 0.01)

        # ボタン
        button_frame = ctk.CTkFrame(self)
        button_frame.pack(fill="x", padx=10, pady=10)

        ctk.CTkButton(
            button_frame,
            text="保存",
            command=self._save,
            fg_color="green",
            width=150
        ).pack(side="left", padx=5)

        ctk.CTkButton(
            button_frame,
            text="キャンセル",
            command=self.destroy,
            fg_color="gray",
            width=150
        ).pack(side="left", padx=5)

    def _create_section(self, parent, title: str):
        """セクションヘッダーを作成"""
        label = ctk.CTkLabel(parent, text=title, font=("", 14, "bold"))
        label.pack(pady=(15, 5), anchor="w")

    def _create_slider(self, parent, label: str, from_: float, to: float,
                      initial_value: float, resolution: float = 1.0) -> tuple:
        """スライダーを作成"""
        frame = ctk.CTkFrame(parent)
        frame.pack(fill="x", pady=5)

        # ラベル
        label_widget = ctk.CTkLabel(frame, text=label, width=120)
        label_widget.pack(side="left", padx=5)

        # 値表示
        value_label = ctk.CTkLabel(frame, text=f"{initial_value:.2f}", width=60)
        value_label.pack(side="right", padx=5)

        # スライダー
        slider = ctk.CTkSlider(
            frame,
            from_=from_,
            to=to,
            number_of_steps=int((to - from_) / resolution)
        )
        slider.set(initial_value)
        slider.pack(side="left", fill="x", expand=True, padx=5)

        # スライダーの値が変更されたら表示を更新
        def update_label(value):
            value_label.configure(text=f"{float(value):.2f}")

        slider.configure(command=update_label)

        return slider, value_label

    def _save(self):
        """プリセットを保存"""
        try:
            print("[PresetEditor] Saving preset...")

            # すべての値を取得
            self.preset["name"] = self.name_entry.get()
            self.preset["x"] = int(self.x_slider[0].get())
            self.preset["y"] = int(self.y_slider[0].get())
            self.preset["width"] = int(self.width_slider[0].get())
            self.preset["height"] = int(self.height_slider[0].get())
            self.preset["zoom"] = float(self.zoom_slider[0].get())
            self.preset["panX"] = float(self.panX_slider[0].get())
            self.preset["panY"] = float(self.panY_slider[0].get())
            self.preset["cropX1"] = float(self.cropX1_slider[0].get())
            self.preset["cropY1"] = float(self.cropY1_slider[0].get())
            self.preset["cropX2"] = float(self.cropX2_slider[0].get())
            self.preset["cropY2"] = float(self.cropY2_slider[0].get())

            print(f"[PresetEditor] Preset values: {self.preset}")

            # コールバックを呼び出し
            if self.on_save:
                self.on_save(self.preset)

            self.destroy()

        except Exception as e:
            print(f"[PresetEditor] Error saving preset: {e}")
            import traceback
            traceback.print_exc()
