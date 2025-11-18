# NDI SDK 5 のインストール手順

## 問題

cyndilib 0.0.9 は NDI SDK 6 と互換性の問題があります：
- Finder が一部のソースしか検出しない
- Receiver がビデオフレームを受信できない

NDI Studio Monitor では映像が見えるのに、cyndilib では受信できません。

## 解決策: NDI SDK 5 をインストール

### ステップ1: NDI 5 Tools Redistributable のダウンロード

1. ブラウザで以下にアクセス:
   https://ndi.video/tools/

2. **NDI 5 Tools** を探す（NDI 6ではなく）

3. または直接:
   https://downloads.ndi.tv/Tools/NDI%205%20Tools.exe

### ステップ2: インストール

1. ダウンロードした `NDI 5 Tools.exe` を実行
2. インストールウィザードに従う
3. **デフォルトのインストール場所を使用**:
   ```
   C:\Program Files\NDI\NDI 5 Runtime\v5
   ```

### ステップ3: アプリケーションの設定変更

インストール後、自動的にNDI 5が優先されます。
環境変数が自動設定されるはずですが、念のため確認:

```bash
echo %NDI_RUNTIME_DIR_V5%
```

出力: `C:\Program Files\NDI\NDI 5 Runtime\v5`

### ステップ4: テスト

```bash
cd d:\dev\rvm-ndi-app
python test_ndi_open.py
```

NDI 5 Runtime を使用しているか確認してください。

---

## 代替方法: 手動でDLLパスを変更

もしNDI 5 Toolsがインストールできない場合、NDI 5 Runtimeのみをインストールして
アプリケーションのコードで優先順位を変更できます。

現在のコード (main_ndi.py):
```python
ndi_runtime_paths = [
    r"C:\Program Files\NDI\NDI 6 Runtime\v6",
    r"C:\Program Files\NDI\NDI 5 Runtime\v5",
    r"C:\Program Files\NDI\NDI 6 SDK\Bin\x64",
]
```

↓ NDI 5 を最優先に変更:
```python
ndi_runtime_paths = [
    r"C:\Program Files\NDI\NDI 5 Runtime\v5",  # NDI 5を最優先
    r"C:\Program Files\NDI\NDI 6 Runtime\v6",
    r"C:\Program Files\NDI\NDI 6 SDK\Bin\x64",
]
```

---

## トラブルシューティング

### NDI 5 と NDI 6 が競合する場合

1. 環境変数を確認:
   ```bash
   set | findstr NDI
   ```

2. NDI 6 の環境変数が優先されている場合、手動で変更

3. または、アプリケーション起動時に明示的に設定:
   ```python
   os.environ['NDILIB_REDIST_FOLDER'] = r'C:\Program Files\NDI\NDI 5 Runtime\v5'
   ```

### それでも動かない場合

NDI 6 を完全にアンインストールして、NDI 5 のみをインストール。
