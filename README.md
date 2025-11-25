# RobustVideoMatting - DeckLink SDI

TensorRT + DeckLink SDI によるリアルタイム人物セグメンテーション

## 機能

- **TensorRT推論**: FP16モードで高速推論
- **DeckLink SDI入出力**: 非圧縮SDI入出力 (1080p60対応)
- **3ステージパイプライン**: 推論・後処理・出力を並列処理
- **低遅延**: 3フレーム遅延 (~50ms)

## 必要条件

### ハードウェア
- NVIDIA GPU (RTX A6000推奨)
- Blackmagic DeckLink カード (Mini Monitor, Quad, 8Kなど)

### ソフトウェア
- Windows 10/11 64-bit
- .NET 8.0 Runtime
- NVIDIA Driver (最新版推奨)
- CUDA Toolkit 12.x
- Blackmagic DeckLink SDK (Desktop Video)
- Blackmagic Desktop Video ドライバー

## インストール

### 1. Blackmagic ソフトウェアのインストール

1. [Blackmagic Design サポート](https://www.blackmagicdesign.com/support/) からダウンロード
2. **Desktop Video** をインストール (ドライバー含む)
3. **DeckLink SDK** をインストール

### 2. ビルド

```bash
cd d:\dev\rvm-decklink-app
dotnet restore
dotnet build -c Release
```

### 3. 実行

```bash
dotnet run -c Release
```

または `bin\Release\net8.0-windows\RvmDecklink.exe` を実行

## 使い方

1. **Load Model** をクリックしてTensorRTモデルをロード
   - 初回は5-10分かかります (TensorRTエンジンのコンパイル)
   - 2回目以降はキャッシュを使用して高速起動

2. 入力/出力のDeckLinkデバイスを選択

3. **Start Processing** をクリックして処理開始

4. SDI出力にアルファマスクが出力されます

## 性能

### RTX A6000 での期待性能

| 項目 | 値 |
|------|-----|
| FPS | 60+ fps |
| 遅延 | 3 frames (~36ms) |
| 推論時間 | ~12ms |
| 後処理時間 | ~4ms |
| SDI出力時間 | ~6ms |

### パイプライン構成

```
Stage 1: TensorRT推論 (GPU)
    ↓ (非同期)
Stage 2: 後処理 (GPU/CPU)
    ↓ (非同期)
Stage 3: SDI出力 (DeckLink)
```

## ファイル構成

```
rvm-decklink-app/
├── RvmDecklink.csproj     # プロジェクトファイル
├── MainWindow.xaml        # GUIレイアウト
├── MainWindow.xaml.cs     # GUIロジック
├── DeckLinkWrapper.cs     # DeckLink SDI制御
├── DeckLinkInterop.cs     # DeckLink COM定義
├── TensorRTInference.cs   # TensorRT推論エンジン
├── PipelineProcessor.cs   # 3ステージパイプライン
├── Models/
│   └── rvm_mobilenetv3_stateless.onnx
└── trt_cache/             # TensorRTエンジンキャッシュ
```

## トラブルシューティング

### DeckLinkデバイスが見つからない

- Blackmagic Desktop Video ドライバーがインストールされているか確認
- デバイスマネージャーでDeckLinkが認識されているか確認
- Blackmagic Desktop Video Setup でデバイスが表示されるか確認

### TensorRTエラー

- NVIDIA ドライバーが最新か確認
- CUDA Toolkit 12.x がインストールされているか確認
- `trt_cache` フォルダを削除して再ビルドを試す

### SDI出力が表示されない

- 出力デバイスが正しく選択されているか確認
- SDIケーブルが正しく接続されているか確認
- モニターが1080p60に対応しているか確認

## ライセンス

RobustVideoMatting モデル: Apache 2.0
