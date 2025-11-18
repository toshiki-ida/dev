# NDI接続問題の真の原因

## 調査結果まとめ

### 確認できたこと
1. ✓ cyndilib 0.0.9がロード成功
2. ✓ NDI SDK 6.1.1.0が正しくロード
3. ✓ Finder (Discovery) が動作 - ソースを発見できる
4. ✓ Source objectは`valid: True`
5. ✓ Receiverオブジェクトの作成成功
6. ✓ `connect_to()`の呼び出し成功
7. ✗ **`NDIlib_recv_get_no_connections()`が常に0を返す**

### 問題の本質

**NDI SDKレベルで接続が確立されていません。**

`NDIlib_recv_connect()`は呼ばれていますが、実際のTCP/UDP接続が確立されていません。

## なぜNDI Studio Monitorは動作するのか？

重要な観察:
- NDI Studio Monitorで「CG_DEV_001 (Remote Connection 1)」が**映像付きで**見えている
- Pythonでは同じソースに接続できない

### 考えられる原因

#### 1. **"Remote Connection 1"はリモートソース**

このソース名から分かること:
- これはvMixからの"Remote Connection"
- つまり、別のマシンからのNDI接続を経由している
- ローカルソースではない

**可能性**:
- vMixがRemote Connectionに接続数制限を設定している
- NDI Studio Monitorが既に接続しているため、新しい接続を拒否している
- Remote Connectionが特定のアプリケーションのみ許可している

#### 2. **NDI接続の認証/承認の問題**

NDI SDKには以下の機能があります:
- Connection authorization (接続の承認)
- Source-side connection limiting (送信側の接続数制限)
- Application whitelisting (アプリケーションホワイトリスト)

NDI Studio Monitorは公式ツールなので自動承認されますが、
Pythonアプリケーションは承認されていない可能性があります。

#### 3. **受信側の名前が問題**

NDI Receiverの名前 ("Python NDI Receiver")が:
- vMixで認識されていない
- または、ブロックリストに入っている

## 検証方法

### テスト1: ローカルNDIソースで試す

vMixの"Remote Connection 1"ではなく、**ローカルのNDI Test Patterns**で試してください:

1. NDI Test Patternsアプリケーションを起動:
   ```
   "C:\Program Files\NDI\NDI 6 Tools\Test Patterns\Test Patterns.exe"
   ```

2. 新しいソースが表示されるまで待つ (例: "CG_DEV_001 (Test Patterns v1)")

3. テストスクリプトを実行:
   ```
   python test_connection_debug.py
   ```

4. ローカルソースで`num_connections: 1`になるか確認

### テスト2: vMixの設定を確認

vMixで:
1. "Remote Connection 1"の設定を開く
2. "Maximum connections"設定を確認
3. "Allow all connections"が有効か確認
4. NDI Studio Monitorを閉じてから、Pythonで再試行

### テスト3: 別のReceiver名を使う

```python
receiver = Receiver(
    source=src,
    color_format=RecvColorFormat.BGRX_BGRA,
    bandwidth=RecvBandwidth.highest,
    recv_name="NDI Studio Monitor"  # ← 公式ツールの名前を模倣
)
```

## 推奨する次のステップ

### 最優先: ローカルソースでテスト

1. **NDI Test Patternsを起動**
2. **新しいローカルソースが表示されるのを確認**
3. **そのソースで接続テスト**

ローカルソースで接続できれば:
→ 問題は"Remote Connection 1"の設定にある

ローカルソースでも接続できなければ:
→ より深刻な問題 (NDI SDK 5へのダウングレードが必要かも)

### 次に試すこと

1. **Receiver名の変更**
   ```python
   recv_name="NDI Studio Monitor"  # または "vMix"
   ```

2. **vMixの接続制限を確認**
   - Remote Connection 1の設定
   - Maximum connectionsを増やす
   - または、NDI Studio Monitorを閉じる

3. **NDI Groupsの確認**
   ```python
   finder = Finder(groups="")  # または "public"
   ```

4. **NDI SDK 5へのダウングレード**
   - `INSTALL_NDI5.md`の手順に従う
   - NDI SDK 5はより広く互換性がある

## 結論

現時点での仮説:
1. **"Remote Connection 1"が追加の接続を拒否している** (最も可能性が高い)
2. vMixまたはソース側の設定で接続数が制限されている
3. NDI Studio Monitorが既に接続しているため、新規接続がブロックされている

**次のアクション**: NDI Test Patternsでローカルソースを作成し、そのソースで接続テストを行ってください。
