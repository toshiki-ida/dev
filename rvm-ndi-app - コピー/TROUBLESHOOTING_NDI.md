# NDIソースが見つからない問題のトラブルシューティング

## 現状

- NDI SDK 6 インストール済み
- cyndilib 正常にインポート可能
- NDI Finder 作成可能
- **しかし、ソースが0個**

他のアプリ（NDI Studio Monitor等）ではソースが見つかる → NDI送信元は稼働中

## 原因の可能性

### 1. Windowsファイアウォールの問題

Pythonがファイアウォールでブロックされている可能性があります。

#### 解決方法:

1. **Windows Defender ファイアウォールを開く**
   - Windows検索で「ファイアウォール」を検索
   - 「Windows Defender ファイアウォールによるアプリケーションの許可」をクリック

2. **Pythonを許可リストに追加**
   - 「設定の変更」をクリック
   - 「別のアプリの許可」をクリック
   - Python.exeを追加:
     ```
     C:\Users\<ユーザー名>\AppData\Local\Programs\Python\Python313\python.exe
     ```
   - プライベートとパブリック両方にチェック

3. **NDIポートを許可**
   - UDP ポート 5353 (mDNS - NDI Discovery)
   - TCP ポート 5960-5969 (NDI通信)

### 2. NDI Access Managerの設定

NDI 6には「NDI Access Manager」があり、アクセス制御を行います。

#### 確認方法:

1. NDI Access Managerを起動:
   ```
   C:\Program Files\NDI\NDI 6 Tools\Access Manager
   ```

2. 「Public NDI Access」が有効か確認

3. または「Groups」で適切なアクセス権を設定

### 3. ネットワーク設定

#### 確認事項:

1. **同じネットワークにいるか**
   - NDI送信元と受信側が同じLAN/WiFiにいるか

2. **ネットワーク分離**
   - 一部のWiFiルーターは「クライアント分離」機能でデバイス間通信をブロック
   - 有線LAN接続を試す

3. **VPNの影響**
   - VPN接続中はNDI Discoveryが機能しない場合がある
   - VPNを一時的に切断して確認

### 4. cyndilib固有の問題

#### 試すこと:

**Option A: より長い待機時間**

```python
from cyndilib import finder
import time

f = finder.Finder()
time.sleep(10)  # 10秒待つ
sources = f.get_source_names()
print(f"Found: {sources}")
```

**Option B: Finderの設定を確認**

```python
from cyndilib import finder

# Finderに特定の設定があるか確認
f = finder.Finder()
print(f"Finder attributes: {dir(f)}")
print(f"Num sources: {f.num_sources}")
```

**Option C: 低レベルAPIを使用**

cyndilibのドキュメントを確認し、NDI_find_create_v2の設定オプションがないか確認

### 5. NDIバージョンの互換性

#### 確認:

- NDI SDK 6 がインストールされている
- cyndilibが NDI 6 に対応しているか

#### 試すこと:

NDI 5 Runtimeも試す:
```
C:\Program Files\NDI\NDI 5 Runtime\v5
```

---

## デバッグ手順

### ステップ1: NDI送信元を確認

1. **NDI Test Patternsを起動**
   ```
   C:\Program Files\NDI\NDI 6 Tools\Test Patterns
   ```

2. **NDI Studio Monitorで確認**
   ```
   C:\Program Files\NDI\NDI 6 Tools\Studio Monitor
   ```
   - ソースが見えるか確認

### ステップ2: ファイアウォールを一時的に無効化

**警告**: テスト目的のみ。終了後は必ず有効化すること。

1. Windows Defender ファイアウォールを一時的に無効化
2. `python test_ndi_fixed.py` を実行
3. ソースが見つかるか確認
4. ファイアウォールを再度有効化

ソースが見つかった場合 → ファイアウォールが原因

### ステップ3: 詳細ログを取得

```python
import os
os.environ['RUST_LOG'] = 'debug'  # cyndilibがRustベースの場合

from cyndilib import finder
import time

f = finder.Finder()
print(f"Finder created, waiting...")
time.sleep(5)
print(f"Sources: {f.get_source_names()}")
```

### ステップ4: 別のNDI Pythonライブラリを試す

cyndilibで問題が解決しない場合、PyNDIという別のライブラリもあります。

---

## 現在の状況まとめ

✅ NDI SDK 6 インストール済み
✅ cyndilib インストール済み
✅ NDI Runtime DLL 検出可能
✅ Finder作成可能
❌ NDIソースが0個

**次の対処法**:

1. ファイアウォール設定を確認・修正
2. NDI Access Managerの設定確認
3. NDI Test Patternsを起動して再テスト
4. 必要に応じてファイアウォールを一時的に無効化してテスト

---

## クイックフィックス（試す順番）

### 1. NDI Test Patternsを起動

```
start "" "C:\Program Files\NDI\NDI 6 Tools\Test Patterns\Test Patterns.exe"
```

### 2. ファイアウォールにPythonを追加

PowerShellで実行（管理者権限）:

```powershell
New-NetFirewallRule -DisplayName "Python NDI" -Direction Inbound -Program "C:\Users\<username>\AppData\Local\Programs\Python\Python313\python.exe" -Action Allow
```

### 3. テスト再実行

```bash
cd d:\dev\rvm-ndi-app
python test_ndi_fixed.py
```

---

もし上記で解決しない場合は、cyndilibのGitHub Issuesを確認:
https://github.com/nocarryr/cython-ndi/issues
