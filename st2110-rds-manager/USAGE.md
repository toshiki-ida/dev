# ST2110 RDS Manager - 使い方ガイド

## 起動方法

### 🚀 簡単起動 (推奨)

**1. すべてのサーバーを起動**
```
start-all.bat
```
- バックエンド (Port 3000)
- フロントエンド (Port 5173)
- 自動的にブラウザが開きます

**2. テスト用モックRDS付きで起動**
```
start-all-with-mock.bat
```
- 上記に加えて
- モックRDS 1 (Port 8080)
- モックRDS 2 (Port 8081)
- デフォルトで各RDSに3つのテストノードが登録されます

**3. クイック起動**
```
quick-start.bat
```
- 最小限のプロンプトで素早く起動
- Test RDS画面が自動的に開きます

**4. すべて停止**
```
stop-all.bat
```
- すべてのサーバーとプロセスを停止

---

## 主要機能

### 1. テスト用RDSサーバー (Test RDS)
**URL**: http://localhost:5173/test-rds

#### モックRDSサーバーの起動
1. ポート番号を入力 (例: 8080)
2. "Start"ボタンをクリック
3. サーバーが起動し、デフォルトで3つのノードが自動登録されます

#### テストノードの追加
1. 起動中のサーバーを選択
2. フォームに入力:
   - **Label**: ノード名 (例: "Test Camera 2")
   - **Type**: sender/receiver/source/flow/device/node
   - **Description**: 説明
   - **Location**: 場所タグ (例: "Studio A")
3. "Add Node"ボタンをクリック

#### ノードの削除
- ノードカードのゴミ箱アイコンをクリック

#### サーバーの停止
- サーバー一覧の停止ボタンをクリック

---

### 2. RDS接続管理 (RDS Management)
**URL**: http://localhost:5173/rds

#### RDS接続の追加
1. "Add RDS Connection"ボタンをクリック
2. 接続情報を入力:
   - **Connection Name**: 接続名
   - **IP Address**: RDSサーバーのIPアドレス
   - **Port**: ポート番号
   - **Timeout**: タイムアウト (秒)
   - **Enabled**: 有効/無効
3. "Create"ボタンをクリック

#### RDS接続のテスト
- 各RDSカードの"Test"ボタンをクリック
- NMOS IS-04 APIへの接続確認が実行されます

#### RDS接続の編集・削除
- 鉛筆アイコン: 編集
- ゴミ箱アイコン: 削除

---

### 3. ノード操作 (Node Operations)
**URL**: http://localhost:5173/nodes

現在プレースホルダーです。今後実装予定:
- RDSからのノード取得
- ノードのコピー
- ノードの削除
- フィルタリング

---

### 4. スケジュール管理 (Schedules)
**URL**: http://localhost:5173/schedules

現在プレースホルダーです。今後実装予定:
- 定期的なノードコピー
- 定期的なノード削除
- cron式によるスケジューリング

---

### 5. ログ (Logs)
**URL**: http://localhost:5173/logs

現在プレースホルダーです。今後実装予定:
- 操作ログ
- スケジュール実行履歴
- エラーログ

---

## API エンドポイント

### RDS管理
```
GET    /api/rds           - RDS一覧取得
POST   /api/rds           - RDS登録
PUT    /api/rds/:id       - RDS更新
DELETE /api/rds/:id       - RDS削除
POST   /api/rds/:id/test  - 接続テスト
```

### モックRDS管理
```
GET    /api/mock-rds                      - モックRDSサーバー一覧
POST   /api/mock-rds/start                - モックRDS起動
POST   /api/mock-rds/:port/stop           - モックRDS停止
GET    /api/mock-rds/:port/nodes          - ノード一覧取得
POST   /api/mock-rds/:port/nodes          - ノード追加
DELETE /api/mock-rds/:port/nodes/:nodeId  - ノード削除
```

### NMOS IS-04 API (モックRDS)
```
GET    http://localhost:8080/x-nmos/registration/v1.3/resource
GET    http://localhost:8080/x-nmos/registration/v1.3/resource/{type}
GET    http://localhost:8080/x-nmos/registration/v1.3/resource/{type}/{id}
POST   http://localhost:8080/x-nmos/registration/v1.3/resource
DELETE http://localhost:8080/x-nmos/registration/v1.3/resource/{type}/{id}
```

---

## トラブルシューティング

### ポートが既に使用されている
```
Error: listen EADDRINUSE: address already in use :::3000
```
**解決策:**
1. `stop-all.bat` を実行
2. タスクマネージャーでNode.jsプロセスを手動で終了
3. または異なるポートを使用

### 依存関係のエラー
```
Error: Cannot find module 'xxx'
```
**解決策:**
```bash
cd backend
npm install

cd ../frontend
npm install
```

### データベースエラー
```
Error: SQLITE_ERROR: table xxx already exists
```
**解決策:**
```bash
# backend/database.sqlite を削除して再起動
cd backend
del database.sqlite  # Windows
rm database.sqlite   # Mac/Linux
npm run dev
```

---

## 開発ワークフロー

### 通常の開発
1. `start-all.bat` で起動
2. コード編集 (ホットリロード対応)
3. ブラウザで確認
4. `stop-all.bat` で停止

### テスト用RDSでの動作確認
1. `start-all-with-mock.bat` で起動
2. Test RDS画面でノード追加
3. RDS Management画面で接続追加
   - IP: localhost
   - Port: 8080 (または8081)
4. "Test"ボタンで接続確認

---

## ファイル構成

```
st2110-rds-manager/
├── start-all.bat              # 通常起動
├── start-all-with-mock.bat    # モックRDS付き起動
├── quick-start.bat            # クイック起動
├── stop-all.bat               # 停止
├── README.md                  # プロジェクト概要
├── USAGE.md                   # このファイル
├── backend/                   # バックエンド
│   ├── src/
│   │   ├── controllers/       # コントローラー
│   │   ├── services/          # サービス (NMOS, Mock RDS)
│   │   ├── models/            # データモデル
│   │   ├── routes/            # APIルート
│   │   └── database/          # DB初期化
│   ├── database.sqlite        # SQLiteデータベース
│   └── package.json
└── frontend/                  # フロントエンド
    ├── src/
    │   ├── components/        # コンポーネント
    │   ├── pages/             # ページ
    │   ├── services/          # API通信
    │   └── types/             # 型定義
    └── package.json
```

---

## よくある質問 (FAQ)

### Q: モックRDSサーバーとは？
A: テスト用のNMOS IS-04準拠RDSサーバーです。実際のハードウェアなしでアプリケーションの動作確認ができます。

### Q: 複数のモックRDSを起動できますか？
A: はい、異なるポート番号を指定すれば複数起動できます。

### Q: 実際のRDSサーバーに接続できますか？
A: はい、RDS Management画面で実際のRDSサーバーのIPアドレスとポートを登録すれば接続できます。

### Q: データは保存されますか？
A: RDS接続情報はSQLiteデータベースに保存されます。モックRDS上のノードはメモリ上のみで、サーバー停止時に消えます。

---

## サポート

問題が発生した場合:
1. まず `stop-all.bat` で全プロセスを停止
2. 再度 `start-all.bat` で起動
3. ブラウザのキャッシュをクリア
4. コンソールでエラーメッセージを確認

それでも解決しない場合は、backend/frontend のコンソール出力を確認してください。
