# RobustVideoMatting NDI Application 🎉

**完成しました！** 人物のアルファマスクをNDI出力するアプリケーション

NDIソース検出の問題を解決し、RobustVideoMattingと統合した完全動作版です。

## ⚡ 完成した機能

- ✅ **すべてのNDIソースを検出** - Test Patterns、vMix Output等も含む
- ✅ **NDIビデオ入力** - 任意のNDIソースから映像を受信
- ✅ **AI人物検出** - RobustVideoMattingによる高精度な人物抽出
- ✅ **アルファマスク生成** - 人物のアルファマスクをリアルタイム生成
- ✅ **NDI出力** - 生成したアルファマスクをNDI経由で配信
- ✅ **GPU加速** - NVIDIA RTX A500でGPU処理
- ✅ **リアルタイムプレビュー** - 入力と出力を同時表示
- ✅ **FPS表示** - リアルタイム処理速度の確認
- ✅ リアルタイム人物マスク生成
- ✅ GPU/CPU自動選択
- ✅ OBS Studio、vMix等と連携可能
- ✅ プロフェッショナルなビデオワークフロー

---

## 🎯 2つのバージョン

### 1. NDI版（メイン・公式SDK使用）
- **公式NDI SDK必須**
- NDI入力/出力に対応
- プロフェッショナルなビデオワークフロー
- OBS Studio、vMixなどと連携可能
- **ファイル**: `main_ndi.py`

### 2. ウェブカメラ版（テスト用）
- ウェブカメラからの映像入力
- NDI SDKのインストール不要
- すぐに使い始められます
- **ファイル**: `main_webcam.py`

---

## 🚀 クイックスタート（NDI版）

### ステップ1: NDI SDKのインストール（必須）

**詳細は [NDI_SETUP_GUIDE.md](NDI_SETUP_GUIDE.md) を参照してください。**

1. https://ndi.video/for-developers/ndi-sdk/ からNDI SDKをダウンロード
2. インストーラーを実行
3. 環境変数が設定されていることを確認

### ステップ2: Pythonパッケージのインストール

```bash
cd rvm-ndi-app
pip install -r requirements.txt
```

### ステップ3: NDI送信元の準備

- NDI Test Patterns（NDI Tools付属）
- OBS Studio + obs-ndiプラグイン
- vMix、Wirecast等

### ステップ4: アプリケーションの起動

```bash
python main_ndi.py
```

### ステップ5: 使い方

1. 「Refresh Sources」ボタンをクリック
2. NDI入力ソースを選択
3. NDI出力名を設定（デフォルト: "RVM Mask Output"）
4. 「Start Processing」をクリック

初回起動時は、RobustVideoMattingのAIモデル（約100MB）を自動ダウンロードします。

## 📋 機能

### NDI版（メイン）
- ✅ **公式NDI SDK使用**（cyndilib）
- ✅ NDI入力ソースの自動検出・選択
- ✅ 入力映像のリアルタイムプレビュー
- ✅ 人物マスク映像のリアルタイムプレビュー
- ✅ マスク結果のNDI出力（カスタム名設定可能）
- ✅ 開始/停止コントロール
- ✅ FPS表示、解像度表示
- ✅ GPU/CPU自動選択
- ✅ RobustVideoMatting AI統合

### ウェブカメラ版（テスト用）
- ✅ ウェブカメラからの映像入力
- ✅ リアルタイム人物マスク生成
- ✅ 3つの出力モード
  - **Mask Only**: マスクのみ表示
  - **Composite**: 背景色と合成（グリーンバック、ブルーバック等）
  - **Side by Side**: 入力とマスクを並べて表示
- ✅ 背景色の選択（グリーン、ブルー、ホワイト、ブラック）
- ✅ FPS表示、GPU/CPU自動選択

## 💻 技術スタック

- **UI**: CustomTkinter
- **映像処理**: OpenCV, NumPy
- **AI**: RobustVideoMatting (PyTorch)
- **NDI**: **公式NDI SDK + cyndilib**（Cythonベースの高性能ラッパー）

## 📦 必要な環境

- **Python 3.8 以上**（Python 3.13.3で動作確認済み）
- **NDI SDK 5.x または 6.x**（公式サイトから無料ダウンロード）
- CUDA対応GPU (オプション、高速処理のため推奨)
- Windows 10/11 (64-bit)

## 📖 詳細なインストール手順

### NDI版（メイン）
**[NDI_SETUP_GUIDE.md](NDI_SETUP_GUIDE.md)** を参照してください。

- NDI SDKのダウンロード・インストール
- 環境変数の設定
- cyndilibのインストール
- トラブルシューティング
- 推奨スペック

### ウェブカメラ版（テスト用）
**[INSTALL_GUIDE.md](INSTALL_GUIDE.md)** を参照してください。

---

## 📡 NDI出力について

このアプリケーションは指定した名前（デフォルト: "RVM Mask Output"）でNDI出力を提供します。

### 他のソフトウェアで受信する方法

#### OBS Studio
1. obs-ndiプラグインをインストール
2. ソース追加 > NDI Source
3. "RVM Mask Output" を選択

#### vMix
1. 入力追加 > NDI
2. "RVM Mask Output" を選択

#### その他
- Wirecast、Resolume、TouchDesigner等、多数のNDI対応ソフトウェアで受信可能

## パフォーマンス

- **CPU**: リアルタイム処理には高性能なCPUが必要
- **GPU**: CUDA対応GPUを使用すると大幅に高速化されます
- **FPS**: システムの性能とビデオ解像度によって異なります

## トラブルシューティング

### NDIソースが見つからない

- NDI Toolsが正しくインストールされているか確認
- NDI送信元とこのアプリケーションが同じネットワークにあるか確認
- ファイアウォール設定を確認

### モデルのロードに失敗

- インターネット接続を確認
- PyTorchが正しくインストールされているか確認
- 十分なディスク容量があるか確認

### 処理が遅い

- CUDA対応GPUを使用していることを確認
- 入力映像の解像度を下げることを検討
- 他のアプリケーションを閉じてリソースを解放

## 📁 ファイル構成

```
rvm-ndi-app/
├── main_ndi.py             # NDI版アプリケーション（メイン・公式SDK使用）
├── main_webcam.py          # ウェブカメラ版アプリケーション（テスト用）
├── main.py                 # 旧NDI版（非推奨、ndi-python使用）
├── requirements.txt        # NDI版依存パッケージ（cyndilib使用）
├── requirements_webcam.txt # ウェブカメラ版依存パッケージ
├── NDI_SETUP_GUIDE.md      # NDI SDK詳細セットアップガイド（重要）
├── INSTALL_GUIDE.md        # ウェブカメラ版インストールガイド
└── README.md               # このファイル
```

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## クレジット

- **RobustVideoMatting**: https://github.com/PeterL1n/RobustVideoMatting
- **CustomTkinter**: https://github.com/TomSchimansky/CustomTkinter
- **NDI SDK**: NewTek/Vizrt - https://ndi.video/
- **cyndilib**: https://github.com/nocarryr/cython-ndi

## 注意事項

### NDI SDKについて
- NDI SDKは無料で使用できますが、NewTek/Vizrtの利用規約に従う必要があります
- 商用利用の場合は、NDIの利用規約を必ず確認してください
- NDI SDKのダウンロードには無料のアカウント登録が必要です

### このアプリケーションについて
- 教育・研究目的で作成されています
- 商用利用の場合は、各ライブラリのライセンスを確認してください

### サポート
- NDI SDK関連: https://ndi.video/support/
- cyndilib関連: https://github.com/nocarryr/cython-ndi/issues
- RobustVideoMatting関連: https://github.com/PeterL1n/RobustVideoMatting/issues
