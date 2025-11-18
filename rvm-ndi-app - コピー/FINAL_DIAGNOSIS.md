# NDI受信問題 - 最終診断と解決

## 確定した事実

### 動作するもの
✓ NDI Studio Monitor - すべてのソース(Remote Connection 1, Test Patterns)を検出・表示できる
✓ NDI SDK 6.1.1.0 自体は正常に動作

### 動作しないもの
✗ cyndilib 0.0.9 Finder - Test Patternsを検出できない（Remote Connection 1のみ検出）
✗ cyndilib 0.0.9 Receiver - どのソースにも接続できない（`num_connections: 0`）
✗ 直接ソース名指定 - Finderを使わずに名前指定しても接続できない

## 根本原因

**cyndilib 0.0.9 は NDI SDK 6 と完全な互換性がありません。**

具体的な問題:
1. **Discovery (Finder)**: 一部のソースしか検出できない
2. **Connection (Receiver)**: 検出したソースにも接続できない（`NDIlib_recv_get_no_connections()`が常に0）

## なぜNDI Studio Monitorは動作するのか

- NDI Studio MonitorはC++で書かれた公式ツール
- NDI SDKのネイティブAPIを直接使用
- Python wrapperのバグの影響を受けない

## 解決策

### 解決策1: NDI SDK 5へのダウングレード ★最も確実★

cyndilib 0.0.9はNDI SDK 5で開発・テストされた可能性が高いです。

#### 手順:

1. **NDI SDK 5 Toolsをダウンロード**
   ```
   https://downloads.ndi.tv/Tools/NDI%205%20Tools.exe
   ```

2. **インストール**
   - デフォルトのインストール先を使用:
     ```
     C:\Program Files\NDI\NDI 5 Runtime\v5
     ```

3. **main_ndi.pyを更新** (既に準備済み)
   - NDI 5 Runtimeが優先されるように設定済み
   ```python
   ndi_runtime_paths = [
       r"C:\Program Files\NDI\NDI 5 Runtime\v5",  # NDI 5を最優先
       r"C:\Program Files\NDI\NDI 6 Runtime\v6",
       r"C:\Program Files\NDI\NDI 6 SDK\Bin\x64",
   ]
   ```

4. **テスト**
   ```cmd
   cd d:\dev\rvm-ndi-app
   python test_connection_debug.py
   ```

### 解決策2: 別のPython NDI libraryを使用

cyndilib以外の選択肢:

#### A. ndi-python (buresu)
- GitHub: https://github.com/buresu/ndi-python
- 以前ビルドエラーがあったが、再試行の価値あり

#### B. NDI SDK C APIを直接ctypesで使用
- `ndi_ctypes.py`を作成済み（ただしsegmentation fault発生）
- 構造体の定義を修正すれば動作する可能性あり

#### C. 自作wrapper
- pybind11またはctypesでシンプルなwrapperを作成
- 必要最小限の機能のみ実装

### 解決策3: C++拡張モジュールを作成

Pythonから呼び出せるC++拡張を作成:
- NDI SDKのC++ APIを直接使用
- pybind11でPythonバインディング
- 最も確実だが開発時間が必要

## 推奨する次のアクション

### 最優先: NDI SDK 5をインストール

1. NDI SDK 5 Toolsをダウンロード・インストール
2. `python test_connection_debug.py`を実行
3. `num_connections: 1`になるか確認

**もしNDI SDK 5で動作すれば**:
→ 問題解決。アプリケーション開発を継続できます。

**もしNDI SDK 5でも動作しなければ**:
→ より深刻な問題。別のライブラリまたはC++拡張が必要です。

## テスト済みの内容

- ✓ cyndilib 0.0.9 インストール成功
- ✓ NDI SDK 6.1.1.0 ロード成功
- ✓ Finderによるソース検出（一部のみ）
- ✓ Receiverオブジェクト作成成功
- ✓ `connect_to()`呼び出し成功
- ✗ `NDIlib_recv_get_no_connections()`が常に0
- ✗ ビデオフレーム受信失敗

## 技術的詳細

### Finderの問題
```python
# 期待: すべてのNDIソースを検出
# 実際: "Remote Connection 1"のみ検出、"Test Patterns"は検出されない
```

これは、cyndilib FinderがNDI SDK 6の新しいdiscoveryプロトコルと互換性がない可能性を示唆。

### Receiverの問題
```python
# 期待: NDIlib_recv_connect()呼び出し後、num_connections > 0
# 実際: NDIlib_recv_get_no_connections()が常に0を返す
```

これは、NDI SDK 6がTCP/UDP接続を確立していないことを意味します。

可能性:
1. cyndilib 0.0.9のReceiver初期化コードがNDI SDK 6の新しい要件を満たしていない
2. NDI SDK 6が新しい認証・承認メカニズムを導入している
3. 構造体のサイズ・レイアウトがNDI SDK 5と6で変更され、ミスマッチが発生

## 結論

**cyndilib 0.0.9とNDI SDK 6の組み合わせでは、このシステムでNDI受信ができません。**

最も現実的な解決策は**NDI SDK 5へのダウングレード**です。

NDI SDK 5をインストールして試してみてください。

---

## ✅ 解決済み (2025-11-14)

### 根本原因の特定

**cyndilib 0.0.9にバンドルされているNDI SDK 6.1.1.0に、ローカルNDIソースを検出できないバグがあることを確認しました。**

#### 検証結果:

1. **cyndilib (NDI SDK 6.1.1.0内蔵) の場合:**
   - 検出されたソース: 1個 (Remote Connection 1のみ)
   - Test Patterns, vMix Output が検出されない ❌

2. **NDI SDK 5を直接ctypesで使用した場合:**
   - 検出されたソース: 4個 ✅
     - CG_DEV_001 (Remote Connection 1)
     - CG_DEV_001 (Test Pattern 2)
     - CG_DEV_001 (Test Pattern)
     - CG_DEV_001 (vMix - Output 1)
   - 接続成功 ✅
   - ビデオフレーム受信成功 (1920x1080, BGRA) ✅

### 実装した解決策

**`ndi_wrapper.py`** を作成しました。これはNDI SDK 5をctypesで直接使用する完全に動作するNDIラッパーです。

#### 特徴:
- ✅ すべてのNDIソースを正しく検出
- ✅ ローカル・リモート両方のソースに接続可能
- ✅ ビデオフレームをnumpy配列として受信
- ✅ cyndilib不要 - NDI SDK 5を直接使用

#### 使用方法:

```python
from ndi_wrapper import NDIFinder, NDIReceiver
import time

# Finderを初期化
finder = NDIFinder()
finder.initialize()

# ソースを取得
time.sleep(3)  # ソース検出待機
sources = finder.get_sources()

# 最初のソースに接続
receiver = NDIReceiver(sources[0])
receiver.initialize()

# ビデオフレーム受信
frame = receiver.receive_video(timeout_ms=2000)
# frame is numpy array (H, W, 4) in BGRA format

# クリーンアップ
receiver.close()
finder.close()
```

### 次のステップ

1. ✅ NDI SDK 5 Tools インストール済み
2. ✅ `ndi_wrapper.py` 作成・テスト完了
3. **次:** `main_ndi.py`を`ndi_wrapper.py`を使用するように更新
4. RobustVideoMattingモデル統合
5. NDI Sender実装（出力用）

### テスト結果

```
[OK] Finder initialized
Found 4 source(s):
  1. CG_DEV_001 (Remote Connection 1)
  2. CG_DEV_001 (Test Pattern 2)
  3. CG_DEV_001 (Test Pattern)
  4. CG_DEV_001 (vMix - Output 1)

Connecting to: CG_DEV_001 (Test Pattern 2)
[OK] Receiver created
[SUCCESS] Connected after 1 seconds!

Attempting to receive video frames...
  Frame 1: (1080, 1920, 4), dtype=uint8
  Frame 2: (1080, 1920, 4), dtype=uint8
  Frame 3: (1080, 1920, 4), dtype=uint8
  Frame 4: (1080, 1920, 4), dtype=uint8
  Frame 5: (1080, 1920, 4), dtype=uint8
```

**問題は完全に解決しました。アプリケーション開発を継続できます。**
