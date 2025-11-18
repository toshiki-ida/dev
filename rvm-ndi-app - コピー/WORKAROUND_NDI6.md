# NDI 6 とcyndilib の互換性問題 - 回避策

## 問題

cyndilib 0.0.9 は NDI SDK 6 の一部のローカルソースを検出できない可能性があります。

**症状**:
- NDI Studio Monitor では複数のソースが見える
- cyndilib では一部のソースしか見つからない
- 特にローカルPC上の複数のNDIソースが検出されない

## 確認されている状況

- **PC名**: CG_DEV_001
- **検出できているソース**: CG_DEV_001 (Remote Connection 1) - 1つのみ
- **NDI Studio Monitorで見えるソース**: 複数（vMix出力、Test Patternsなど）

## 回避策

### オプション1: NDI SDK 5 をインストール (推奨)

NDI SDK 5 の方が cyndilib との互換性が高い可能性があります。

1. NDI SDK 5 をダウンロード
   https://ndi.video/for-developers/ndi-sdk/download/

2. NDI 5 Runtime をインストール

3. 環境変数を NDI 5 に変更:
   ```python
   ndi_runtime_paths = [
       r"C:\Program Files\NDI\NDI 5 Runtime\v5",
       r"C:\Program Files\NDI\NDI 6 Runtime\v6",  # フォールバック
   ]
   ```

### オプション2: 別のPython NDI ライブラリを使用

**PyNDI** や他のライブラリを試す:

```bash
# PyNDI (もし利用可能な場合)
pip install PyNDI
```

### オプション3: NDI SDK の C API を直接使用

cyndilibを介さず、ctypes で NDI SDK を直接呼び出す。
(実装が複雑になるため、最後の手段)

### オプション4: 特定のソース名で直接接続

NDI Studio Monitor で確認したソース名を使って、Finderを使わず直接Receiverを作成:

```python
from cyndilib import receiver
from cyndilib.wrapper.ndi_recv import RecvColorFormat, RecvBandwidth

# ソース名を直接指定
recv = receiver.Receiver(
    source_name="完全なソース名をここに入力",
    color_format=RecvColorFormat.BGRX_BGRA,
    bandwidth=RecvBandwidth.highest
)
```

## 診断

### NDI Studio Monitor で見えるソースを確認

1. NDI Studio Monitor を起動
2. 表示されるすべてのソース名を **正確に** 記録
3. どれがローカル、どれがリモートか確認

### cyndilib で見えるソースを確認

```bash
python test_local_sources.py
```

## 次のステップ

1. **NDI Studio Monitorで見えるソース名を教えてください**
   - 完全な名前（スペースや括弧を含めて正確に）
   - どれがこのPC (CG_DEV_001) からのソースか

2. **vMixの設定を確認**
   - vMix → Settings → Output → NDI
   - NDI出力が有効になっているか
   - 出力名は何か

3. **NDI Test Patterns が起動しているか確認**
   - タスクマネージャーで確認
   - NDI Studio Monitor で見えるか

この情報があれば、適切な解決策を提案できます。
