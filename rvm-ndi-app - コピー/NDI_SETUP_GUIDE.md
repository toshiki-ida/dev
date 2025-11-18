# NDI SDK セットアップガイド（必須）

このアプリケーションは **公式NDI SDK** を使用します。NDI SDKのインストールは必須です。

## 📋 必要な環境

- Windows 10/11 (64-bit)
- Python 3.8以上（Python 3.13.3で動作確認済み）
- NDI SDK 5.x または 6.x

---

## ステップ1: NDI SDK のダウンロード

### 1.1 NDI公式サイトへアクセス

https://ndi.video/for-developers/ndi-sdk/

### 1.2 アカウント登録

- NDI SDKをダウンロードするには無料のアカウント登録が必要です
- メールアドレスを登録し、確認メールのリンクをクリック

### 1.3 NDI SDK のダウンロード

1. ログイン後、**Download SDK** をクリック
2. 利用規約に同意
3. **NDI SDK for Windows** をダウンロード
4. インストーラー（.exe）を実行

### 1.4 インストール

1. ダウンロードした `.exe` ファイルを実行
2. インストールウィザードに従ってインストール
3. デフォルトのインストール先：
   ```
   C:\Program Files\NDI\NDI 6 SDK
   ```
   または
   ```
   C:\Program Files\NDI\NDI 5 SDK
   ```

---

## ステップ2: 環境変数の設定（重要）

NDI SDKが正しくインストールされると、通常は自動的に環境変数が設定されます。
確認方法：

### 2.1 PowerShellで確認

```powershell
$env:NDI_SDK_DIR
```

何も表示されない場合は、手動で設定してください：

### 2.2 手動設定（必要な場合のみ）

1. Windowsキー + `システム環境変数の編集` を検索
2. 「環境変数」ボタンをクリック
3. 「システム環境変数」セクションで「新規」をクリック
4. 以下を追加：
   - 変数名: `NDI_SDK_DIR`
   - 変数値: `C:\Program Files\NDI\NDI 6 SDK`（実際のパスに合わせて変更）

### 2.3 PATH環境変数の追加

1. システム環境変数から `Path` を選択し「編集」をクリック
2. 「新規」をクリックして以下を追加：
   ```
   C:\Program Files\NDI\NDI 6 SDK\Bin\x64
   ```

### 2.4 変更を反映

- PowerShellやコマンドプロンプトを再起動
- または、PCを再起動

---

## ステップ3: Pythonパッケージのインストール

### 3.1 プロジェクトディレクトリへ移動

```bash
cd rvm-ndi-app
```

### 3.2 依存パッケージのインストール

```bash
pip install -r requirements.txt
```

これにより以下がインストールされます：
- `cyndilib` - 公式NDI SDKのPythonラッパー
- `customtkinter` - GUIフレームワーク
- `opencv-python` - 映像処理
- `torch` / `torchvision` - AI推論
- `pillow` - 画像処理
- `numpy` - 数値計算

### 3.3 GPU版PyTorch（オプション、推奨）

より高速な処理のためにGPU版PyTorchをインストール：

```bash
# CUDA 11.8の場合
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

# CUDA 12.1の場合
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

---

## ステップ4: 動作確認

### 4.1 cyndilib のインポートテスト

```bash
python -c "import cyndilib; print('cyndilib version:', cyndilib.__version__)"
```

成功すれば、バージョン番号が表示されます。

### 4.2 NDI SDKの動作確認

```bash
python -c "from cyndilib import finder; f = finder.Finder(); print('NDI SDK loaded successfully')"
```

エラーが出なければ成功です。

---

## ステップ5: アプリケーションの起動

### 5.1 NDI送信元の準備

アプリケーションを起動する前に、NDI送信元（ソース）が必要です：

**オプション1: NDI Test Patternsを使用**
- NDI Tools（SDK付属）に含まれる `NDI Test Patterns` を起動
- テストパターンを選択して送信

**オプション2: OBS Studioを使用**
- OBS Studioに「obs-ndi」プラグインをインストール
- ツール > NDI Output を有効化

**オプション3: 他のNDI対応ソフトウェア**
- vMix
- Wirecast
- NewTek TriCaster
など

### 5.2 アプリケーションの起動

```bash
python main_ndi.py
```

### 5.3 使い方

1. 「Refresh Sources」ボタンをクリック
2. NDI入力ソースを選択
3. NDI出力名を設定（デフォルト: "RVM Mask Output"）
4. 「Start Processing」をクリック

初回起動時は、RobustVideoMattingのAIモデル（約100MB）を自動ダウンロードします。

---

## トラブルシューティング

### エラー: "cyndilib not found"

**原因**: cyndilibがインストールされていない

**解決策**:
```bash
pip install cyndilib
```

### エラー: "NDI SDK not found" または "Failed to initialize NDI"

**原因**: NDI SDKがインストールされていない、または環境変数が設定されていない

**解決策**:
1. NDI SDKが正しくインストールされているか確認
2. 環境変数 `NDI_SDK_DIR` が設定されているか確認
3. PATH に NDI の Bin ディレクトリが含まれているか確認
4. PCを再起動

### エラー: "No NDI sources found"

**原因**: ネットワーク上にNDIソースがない

**解決策**:
1. NDI送信元が起動しているか確認
2. ファイアウォール設定を確認
   - UDP ポート 5353 (mDNS)
   - TCP ポート 5960-5969
3. 送信元とPCが同じネットワークにあるか確認

### 処理が遅い

**解決策**:
1. GPU版PyTorchを使用（上記 3.3 参照）
2. デバイス情報を確認：
   ```python
   python -c "import torch; print('CUDA available:', torch.cuda.is_available())"
   ```
3. 入力解像度を下げる（NDI送信側で調整）

### DLLエラーが発生する

**原因**: Visual C++ Redistributableが不足

**解決策**:
Microsoft Visual C++ Redistributable をインストール：
https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist

---

## NDI出力の受信方法

このアプリケーションからの出力（デフォルト名: "RVM Mask Output"）は、
他のNDI対応ソフトウェアで受信できます：

### OBS Studio
1. obs-ndiプラグインをインストール
2. ソース追加 > NDI Source
3. "RVM Mask Output" を選択

### vMix
1. 入力追加 > NDI
2. "RVM Mask Output" を選択

### その他のNDI対応ソフトウェア
- Wirecast
- vMix
- Resolume
- TouchDesigner
など、多数のソフトウェアがNDIに対応しています。

---

## システム要件

### 最小要件
- CPU: Intel Core i5 8世代以上
- RAM: 8GB
- ネットワーク: 1Gbps Ethernet（有線推奨）

### 推奨要件
- CPU: Intel Core i7 10世代以上
- GPU: NVIDIA GTX 1660以上（CUDA対応）
- RAM: 16GB
- ネットワーク: 1Gbps Ethernet（有線）

### 最適環境
- CPU: Intel Core i9 / AMD Ryzen 9
- GPU: NVIDIA RTX 3060以上
- RAM: 32GB
- ネットワーク: 10Gbps Ethernet

---

## 参考リンク

- **NDI公式サイト**: https://ndi.video/
- **NDI SDK**: https://ndi.video/for-developers/ndi-sdk/
- **cyndilib GitHub**: https://github.com/nocarryr/cython-ndi
- **cyndilib ドキュメント**: https://cyndilib.readthedocs.io/
- **RobustVideoMatting**: https://github.com/PeterL1n/RobustVideoMatting

---

## ライセンスと注意事項

### NDI SDK
- NDI SDKは無料で使用できますが、NewTek/Vizrtの利用規約に従う必要があります
- 商用利用の場合は、NDIの利用規約を必ず確認してください

### このアプリケーション
- 教育・研究目的で作成されています
- 商用利用の場合は、各ライブラリのライセンスを確認してください

---

## サポート

問題が解決しない場合：

1. cyndilib の Issue: https://github.com/nocarryr/cython-ndi/issues
2. NDI 公式サポート: https://ndi.video/support/
3. このプロジェクトの Issue（あれば）
