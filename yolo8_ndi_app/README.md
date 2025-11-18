# YOLOv8 Segmentation NDI Application

YOLOv8のセグメンテーション機能を使ってNDI映像から人物を抽出し、セグメンテーションマスクをNDI出力するアプリケーションです。

## 特徴

- **YOLOv8-seg**: 最新のYOLOv8セグメンテーションモデルを使用
- **リアルタイム処理**: GPU対応で60fps目標の高速処理
- **NDI入出力**: NDI経由で映像を入力・出力
- **柔軟なパラメータ調整**: UIから各種パラメータをリアルタイムに調整可能
- **セグメンテーションマスク出力**: 人物のマスクを白黒画像として出力

## RVM-NDI-Appとの違い

| 項目 | RVM-NDI-App | YOLO8-NDI-App |
|------|-------------|---------------|
| モデル | RobustVideoMatting | YOLOv8-seg |
| 処理対象 | 人物マッティング専用 | 人物+80クラス対応 |
| 処理方式 | リカレントネットワーク | オブジェクト検出+セグメンテーション |
| メモリ使用量 | リカレント状態を保持 | フレーム単位で処理 |
| エッジ品質 | 髪の毛など細部まで高精度 | やや粗めだが高速 |

## 必要要件

- Python 3.8以上
- NDI 5 Tools (Runtime必須)
- NVIDIA GPU (CUDA対応) - オプション、CPUでも動作可能

## インストール

1. リポジトリをクローン
```bash
cd d:\dev\yolo8_ndi_app
```

2. 依存パッケージをインストール
```bash
pip install -r requirements.txt
```

3. NDI 5 Toolsがインストールされていることを確認
- インストールパス: `C:\Program Files\NDI\NDI 5 Tools\Runtime\Processing.NDI.Lib.x64.dll`

## 使い方

1. アプリケーションを起動
```bash
python app_complete.py
```

2. NDIソースを選択
   - 起動後、自動的にNDIソースを検索します
   - プルダウンメニューから入力ソースを選択

3. モデルをロード
   - "Load Model"ボタンをクリック
   - 初回起動時は自動的にYOLOv8n-segモデルをダウンロードします

4. 処理を開始
   - "Start Processing"ボタンをクリック
   - セグメンテーションマスクがNDI出力されます

## パラメータ説明

### Confidence Threshold (0.1-1.0)
- 検出の信頼度閾値
- 小さい値: より多くの物体を検出（誤検出増加）
- 大きい値: より厳密に検出（検出漏れ増加）
- 推奨: 0.3-0.7

### IOU Threshold (0.1-0.95)
- 重複検出の除去閾値
- 小さい値: 重複を厳しく除去
- 大きい値: 重複を許容
- 推奨: 0.4-0.6

### Detect Person Only
- 人物(person)のみを検出
- OFF: 全80クラスを検出
- ON: 人物のみを検出
- 推奨: ON

### Use Soft Alpha (Gradient)
- ソフトアルファを使用（グラデーション）
- OFF: 二値化（白黒のみ）
- ON: 0-255のグラデーション
- 推奨: ONで自然な合成が可能

### Alpha Contrast (0.1-3.0)
- アルファのコントラスト調整（ソフトアルファ時のみ有効）
- 小さい値: ふわふわ（境界が広い）
- 1.0: 標準
- 大きい値: シャープ（境界が狭い）
- 推奨: 0.8-1.5

### Temporal Smoothing
- 時間的平滑化を有効化
- フレーム間のちらつきを軽減
- 有効化すると少し遅延が発生する可能性あり

### Edge Refinement
- エッジ精緻化処理
- マスクの境界をより滑らかに
- 処理負荷が増加します

## 設定の保存/読み込み

- **Save Settings**: 現在のパラメータをJSONファイルに保存
- **Load Settings**: 保存したパラメータを読み込み
- **Reset to Defaults**: デフォルト値に戻す

設定ファイル: `yolo8_settings.json`

## トラブルシューティング

### NDIソースが見つからない
- NDI 5 Toolsが正しくインストールされているか確認
- NDIソース（vMix、OBSなど）が起動しているか確認
- "Refresh"ボタンをクリック

### モデルの読み込みに失敗
- インターネット接続を確認（初回はモデルをダウンロード）
- PyTorchが正しくインストールされているか確認

### 処理が遅い
- GPU（CUDA）が利用可能か確認
- YOLOv8のモデルサイズを小さくする（yolov8n-seg → yolov8s-seg）
- Confidence Thresholdを上げる

## ライセンス

このプロジェクトは参考用のサンプルコードです。

## 参考

- [Ultralytics YOLOv8](https://github.com/ultralytics/ultralytics)
- [NDI SDK](https://ndi.tv/sdk/)
