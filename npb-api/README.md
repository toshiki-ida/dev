# NPB API Tester

NPB (日本プロ野球) Stats API のテストツール

## 概要

このツールは、NPB Stats API の各種エンドポイントを簡単にテストできるWebベースのGUIアプリケーションです。認証設定からリクエスト送信、レスポンス確認まで、ブラウザ上で完結できます。

## 特徴

- シングルHTMLファイルで動作（外部依存なし）
- 認証情報の安全な管理（LocalStorageに保存）
- 複数の認証方式に対応
  - Basic認証
  - Bearer Token認証
  - 認証なし
- エンドポイントをカテゴリ別に整理
- パラメータ入力フォームの自動生成
- レスポンスのJSON整形表示
- モダンで使いやすいUI

## 使い方

### 1. ファイルを開く

`api-tester.html` をブラウザで開きます。

```bash
# Windowsの場合
start api-tester.html

# macOS/Linuxの場合
open api-tester.html
```

または、ブラウザに直接ドラッグ&ドロップしてください。

### 2. 認証設定

左サイドバーの「認証設定」セクションで設定します：

1. **認証タイプ**を選択
   - なし: 認証不要のエンドポイントをテストする場合
   - Basic Auth: ユーザー名とパスワードで認証
   - Bearer Token: トークンで認証

2. **認証情報**を入力
   - Basic Auth: ユーザー名とパスワードを入力
   - Bearer Token: トークンを入力

3. **ベースURL**を選択
   - Production: `https://stats.npb.jp/`
   - Local: `http://localhost:8080`

4. **「認証設定を保存」**ボタンをクリック

5. **「認証テスト」**ボタンで認証が正しく動作するか確認（オプション）

### 3. エンドポイントをテスト

1. 左サイドバーの**「エンドポイント」**セクションからカテゴリを選択
2. テストしたいエンドポイントをクリック
3. 必要なパラメータを入力
   - パスパラメータ（例: teamId）
   - クエリパラメータ（例: season, group）
4. **「リクエスト送信」**ボタンをクリック
5. レスポンスが画面下部に表示されます

## エンドポイント例

### Authentication（認証）

- `POST /api/dmp/v1/authentication/okta/token` - 認証情報を取得
- `POST /api/dmp/v1/authentication/okta/token/refresh` - 認証情報を更新

### Teams（チーム）

- `GET /api/dmp/v1/teams/{teamId}/alumni` - チームのOBを表示

### Misc（その他）

- `GET /api/dmp/v1/jobTypes` - すべてのジョブタイプを表示
- `GET /api/dmp/v1/gameStatus` - すべてのステータスタイプを表示

## 技術仕様

- **フロントエンド**: Pure HTML/CSS/JavaScript（フレームワーク不要）
- **認証方式**: Basic Auth, Bearer Token
- **データ保存**: LocalStorage（ブラウザ内に保存）
- **CORS**: サーバー側でCORSが有効になっている必要があります

## セキュリティに関する注意

- 認証情報はブラウザのLocalStorageに保存されます
- 本番環境の認証情報を入力する際は注意してください
- 公共のコンピュータでは使用後に設定をクリアすることを推奨します

## カスタマイズ

### エンドポイントの追加

`api-tester.html` の `endpoints` オブジェクトを編集することで、新しいエンドポイントを追加できます：

```javascript
const endpoints = {
    'CategoryName': [
        {
            path: '/api/path/to/endpoint',
            method: 'GET', // or 'POST', 'PUT', 'DELETE'
            summary: 'エンドポイントの概要',
            description: '詳細な説明',
            parameters: [
                {
                    name: 'paramName',
                    in: 'path', // or 'query'
                    description: 'パラメータの説明',
                    required: true, // or false
                    type: 'string' // or 'integer', etc.
                }
            ]
        }
    ]
};
```

## トラブルシューティング

### CORSエラーが発生する場合

APIサーバーでCORSが有効になっていることを確認してください。開発環境では、ブラウザの拡張機能（例: CORS Unblock）を使用することもできます。

### 認証エラーが発生する場合

1. 認証情報が正しいか確認
2. ベースURLが正しいか確認
3. APIサーバーが稼働しているか確認

### パラメータが正しく送信されない場合

1. 必須パラメータがすべて入力されているか確認
2. パラメータの型が正しいか確認（数値は数値として入力）

## ライセンス

このツールは自由に使用・改変できます。

## 更新履歴

- 2025-11-13: 初版リリース
