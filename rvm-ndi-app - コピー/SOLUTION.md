# NDI受信問題の解決方法

## 問題の本質

**Discovery(発見)は成功するが、Connection(接続)が失敗**しています。

```
Finder: ✓ 動作 (ソースを発見できる)
Receiver: ✗ 失敗 (num_connections: 0のまま)
```

これは以下を試してもすべて同じ結果でした:
- ✗ cyndilib 0.0.9 (Cython wrapper)
- ✗ ctypes直接呼び出し (Python wrapper なし)
- ✗ 異なるグループ設定

## なぜNDI Studio Monitorは動作するのか？

NDI公式ツール(Studio Monitor, Test Patterns等)は:
1. NDI Access Managerに事前登録されている
2. Windowsファイアウォールで自動許可されている
3. NDI Groupsの"Public"に属している

一方、Python(python.exe)は:
1. NDI Access Managerに登録されていない
2. Windowsファイアウォールでブロックされている可能性
3. NDI接続が拒否されている

## 解決方法

### 方法1: Windowsファイアウォールの設定 ★最優先★

1. **Windowsファイアウォールを開く**
   ```
   コントロールパネル > システムとセキュリティ > Windows Defender ファイアウォール
   > 詳細設定
   ```

2. **受信の規則を追加**
   - 左側の「受信の規則」をクリック
   - 右側の「新しい規則...」をクリック
   - 「プログラム」を選択 → 次へ
   - 「このプログラムのパス」を選択:
     ```
     C:\Users\ida\AppData\Local\Programs\Python\Python313\python.exe
     ```
   - 「接続を許可する」を選択 → 次へ
   - すべてチェック(ドメイン、プライベート、パブリック) → 次へ
   - 名前: "Python NDI" → 完了

3. **送信の規則も同様に追加**
   - 左側の「送信の規則」をクリック
   - 同じ手順を繰り返す

### 方法2: NDI Access Manager (存在する場合)

NDI Access Managerがインストールされている場合:

```
"C:\Program Files\NDI\NDI 6 Tools\Access Manager\NDI Access Manager.exe"
```

1. アプリケーションを開く
2. Python (python.exe) を見つける
3. "Allow" または "Public" グループに設定

**注意**: 現在のシステムではNDI Access Managerの実行ファイルが見つかりませんでした。
NDI 6 Runtimeには含まれていない可能性があります。

### 方法3: NDI Groupsの設定を変更

vMixやTest Patternsの送信設定で:
1. NDI出力設定を開く
2. Groups設定を"Public"に変更
3. アクセス制限を"すべて許可"に変更

### 方法4: 一時的にファイアウォールを無効化してテスト

**テスト目的のみ**:
```powershell
# ファイアウォールを一時的に無効化(管理者権限)
netsh advfirewall set allprofiles state off

# テストスクリプトを実行
python test_minimal_receive.py

# ファイアウォールを再度有効化
netsh advfirewall set allprofiles state on
```

**警告**: 本番環境では絶対にファイアウォールを無効化しないでください！

## 推奨する検証手順

1. **まず、Windowsファイアウォールの設定を確認・追加してください**
   - Python.exeの受信/送信規則を追加

2. **設定後、テスト**:
   ```cmd
   cd d:\dev\rvm-ndi-app
   python test_minimal_receive.py
   ```

3. **確認ポイント**:
   ```
   is_connected: True  (← これがTrueになればOK!)
   num_connections: 1 or more
   ```

4. **成功したら、アプリケーションを実行**:
   ```cmd
   python main_ndi.py
   ```

## トラブルシューティング

### それでも接続できない場合

1. **NDIソース側を再起動**
   - vMix を再起動
   - Test Patterns を再起動
   - NDI出力を一度停止して再開

2. **Pythonを管理者権限で実行**
   ```cmd
   # コマンドプロンプトを管理者として実行
   cd d:\dev\rvm-ndi-app
   python test_minimal_receive.py
   ```

3. **ネットワークインターフェースを確認**
   - 複数のネットワークアダプタがある場合、NDIが正しいアダプタを使用しているか確認
   - ループバック (127.0.0.1) ではなく、実際のネットワークインターフェースを使用

4. **NDI 5 Runtimeをインストール**
   - NDI 6に問題がある場合の回避策
   - ダウンロード: https://downloads.ndi.tv/Tools/NDI%205%20Tools.exe
   - インストール後、`INSTALL_NDI5.md`の手順に従う

## 次のステップ

Windowsファイアウォールの設定を追加してから、再度テストしてください。

結果を教えていただければ、さらなるサポートができます！
