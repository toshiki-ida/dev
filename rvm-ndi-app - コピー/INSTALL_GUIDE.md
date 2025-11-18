# インストールガイド

## ウェブカメラ版（推奨 - NDI不要）

NDI SDKのインストールが難しい場合は、まずウェブカメラ版から始めることをお勧めします。

### ステップ1: 必要なパッケージのインストール

```bash
cd rvm-ndi-app
pip install -r requirements_webcam.txt
```

### ステップ2: アプリケーションの起動

```bash
python main_webcam.py
```

### 機能

- ウェブカメラからの映像入力
- リアルタイム人物マスク生成
- 3つの出力モード：
  - **Mask Only**: マスクのみ表示
  - **Composite**: 背景色と合成（グリーンバック、ブルーバック等）
  - **Side by Side**: 入力とマスクを並べて表示
- 背景色の選択（グリーン、ブルー、ホワイト、ブラック）
- FPS表示
- GPU/CPU自動選択

---

## NDI版（上級者向け）

NDI入力/出力が必要な場合は、以下の手順に従ってください。

### 前提条件

- Visual Studio 2019以降（C++ビルドツール）
- CMake 3.15以降
- NDI SDK 5.x以降

### ステップ1: NDI SDKのインストール

1. https://www.ndi.tv/tools/ から NDI Tools をダウンロード
2. インストーラーを実行し、NDI SDKを含めてインストール
3. 環境変数 `NDI_SDK_DIR` を設定（通常は `C:\Program Files\NDI\NDI 6 SDK`）

### ステップ2: ビルドツールのインストール

```bash
# Visual Studio Build Tools がない場合
# https://visualstudio.microsoft.com/downloads/ から
# "Build Tools for Visual Studio" をダウンロード・インストール

# CMake がない場合
# https://cmake.org/download/ からダウンロード・インストール
```

### ステップ3: ndi-pythonのインストール

```bash
pip install ndi-python
```

エラーが出る場合は、以下を試してください：

```bash
# pybind11を先にインストール
pip install pybind11

# または、ソースからビルド
git clone https://github.com/buresu/ndi-python.git
cd ndi-python
git submodule update --init --recursive
pip install .
```

### ステップ4: その他のパッケージのインストール

```bash
pip install -r requirements.txt
```

### ステップ5: NDI版アプリケーションの起動

```bash
python main.py
```

---

## トラブルシューティング

### ndi-pythonのビルドエラー

**エラー**: `add_subdirectory given source "lib/pybind11" which is not an existing directory`

**解決策**: submoduleが初期化されていません

```bash
git clone https://github.com/buresu/ndi-python.git
cd ndi-python
git submodule update --init --recursive
pip install .
```

### NDI SDKが見つからない

**エラー**: `Could not find NDI SDK`

**解決策**: 環境変数を設定

```bash
# PowerShellで
$env:NDI_SDK_DIR = "C:\Program Files\NDI\NDI 6 SDK"

# またはシステム環境変数に追加
```

### PyTorchのインストールエラー

**GPU版が必要な場合**:

```bash
# CUDA 11.8の場合
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

# CUDA 12.1の場合
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

**CPU版で十分な場合**:

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

### カメラが見つからない

1. 他のアプリケーションがカメラを使用していないか確認
2. カメラのドライバーが最新か確認
3. プライバシー設定でカメラのアクセスが許可されているか確認（Windows設定 > プライバシー > カメラ）

### 処理が遅い

1. **GPU版PyTorchを使用**: 上記のCUDA版インストール手順を参照
2. **解像度を下げる**: `main_webcam.py` の `CAP_PROP_FRAME_WIDTH/HEIGHT` を変更
3. **バックグラウンドアプリを終了**: 他のアプリケーションを閉じてリソースを確保

---

## 推奨スペック

### 最小スペック
- CPU: Intel Core i5 8世代以上
- RAM: 8GB
- Python: 3.8以上

### 推奨スペック
- CPU: Intel Core i7 10世代以上
- GPU: NVIDIA GTX 1660以上（CUDA対応）
- RAM: 16GB
- Python: 3.9-3.11

### 最適スペック
- CPU: Intel Core i9 / AMD Ryzen 9
- GPU: NVIDIA RTX 3060以上
- RAM: 32GB
- Python: 3.10
