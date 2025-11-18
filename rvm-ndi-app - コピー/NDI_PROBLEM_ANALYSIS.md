# NDI受信問題の詳細分析

## ユーザーの質問
> "いえ、テストパターンはNDI6で出ているはずなので、このアプリもNDI6が入っていれば正常に見えるはずですよね？何が問題でしょう"

**ユーザーは完全に正しいです。** NDI 6 の互換性問題ではありません。

## 調査結果

### 1. NDI SDK バージョン確認
- **cyndilib 0.0.9 に bundled されている DLL**: `Processing.NDI.Lib.x64.dll` バージョン **6.1.1.0**
- **システムにインストールされた NDI SDK**: バージョン **6.1.1.0**
- **NDI Studio Monitor が使用**:  NDI SDK 6.1.1.0

**結論**: すべて同じバージョン (6.1.1.0) を使用しており、バージョン不一致ではありません。

### 2. 実際に読み込まれている DLL
```
Loaded NDI DLLs:
  - C:\Users\ida\AppData\Local\Programs\Python\Python313\Lib\site-packages\cyndilib\wrapper\bin\Processing.NDI.Lib.x64.dll
```

cyndilib は自身に bundled された DLL (6.1.1.0) を読み込んでおり、これは NDI Studio Monitor と同じバージョンです。

### 3. 根本原因: Receiver が接続できていない

`test_minimal_receive.py` の結果:
```
[Step 5] Waiting for connection...
  is_connected: False
  num_connections: 0

[Step 6] Attempting to receive video frames (10 attempts)...
  [ 1] [TIMEOUT] No data
  [ 2] [TIMEOUT] No data
  ...
```

**問題**:
- Finder はソース "CG_DEV_001 (Remote Connection 1)" を発見できる
- しかし、Receiver.connect_to(source) を呼んでも **接続が確立されない**
- `is_connected: False` のまま
- 結果として、video frame を受信できない

## なぜ NDI Studio Monitor は動作するのに、cyndilib は動作しないのか？

### 可能性のある原因

#### 1. **NDI Groups または Access Manager の制限**
NDI Access Manager で特定のアプリケーションのみアクセスを許可している可能性があります。

**確認方法**:
```cmd
"C:\Program Files\NDI\NDI 6 Tools\Access Manager\NDI Access Manager.exe"
```

アプリケーション名 "Python" や "python.exe" がブロックされていないか確認してください。

#### 2. **ソースが新しい接続を拒否している**
- vMix や Test Patterns が最大接続数に達している
- または、特定のアプリケーションからの接続のみを受け付ける設定になっている

#### 3. **cyndilib 0.0.9 の Receiver 初期化の問題**
cyndilib の Receiver は NDI SDK 6 の新しい接続方法に完全に対応していない可能性があります。

具体的には、`receiver.pyx` の lines 131-172 の初期化コードで:
- `NDIlib_recv_create_v3()` は呼ばれている
- しかし、source を接続する際の `NDIlib_recv_connect()` (line 237) が正しく機能していない可能性

## 解決策

### 方法1: NDI Access Manager をチェック ★推奨
1. NDI Access Manager を開く
2. Python がブロックされていないか確認
3. "Public" グループに設定されているか確認

### 方法2: NDI SDK 5 をインストール
cyndilib 0.0.9 は NDI SDK 5 で開発・テストされた可能性が高いため、NDI SDK 5 Runtime を試してみる価値があります。

**インストール手順**: `INSTALL_NDI5.md` を参照

### 方法3: 別の Python NDI ライブラリを試す
cyndilib 以外の選択肢:
- **PyNDI** (https://github.com/buresu/PyNDI)
- **ndi-python** (ビルドできれば)
- **NDI SDK C API を ctypes で直接呼び出す**

### 方法4: 詳細デバッグ
NDI SDK のログを有効にして、接続失敗の詳細な理由を確認:

```python
import os
os.environ['NDILIB_DISCOVERY_TIMEOUT'] = '5000'  # 5秒に延長
os.environ['NDILIB_RECV_TIMEOUT'] = '5000'  # 受信タイムアウトを延長
```

## 次のステップ

**最優先**:
1. NDI Access Manager を確認してください
2. Python アプリケーションがブロックされていないか
3. NDI Groups の設定を確認

これらが問題なければ、NDI SDK 5 を試すか、または別の Python NDI ライブラリへの移行を検討する必要があります。

---

## テクニカル詳細

### Finder vs Receiver の違い
- **Finder (Discovery)**: mDNS/Bonjour で NDI ソースをスキャン → **動作している**
- **Receiver (Connection)**: 実際にソースと TCP 接続を確立 → **動作していない**

つまり、問題は **発見 (Discovery)** ではなく、**接続 (Connection)** にあります。

### NDI Studio Monitor が動作する理由
- NDI 公式ツールは NDI Access Manager に事前登録されている
- または、NDI Groups の "Public" に属している
- SDK の C++ コードを直接使用しており、Python wrapper のバグの影響を受けない

### cyndilib が動作しない理由
- Python アプリケーションが NDI Access Manager で認識されていない可能性
- または、cyndilib 0.0.9 の Cython wrapper に NDI SDK 6 との完全な互換性がない
