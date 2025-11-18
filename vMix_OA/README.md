# vMix制御パネル

Python + CustomTkinterで作成したvMix制御デスクトップアプリケーション

## 機能

- vMixへのHTTP API接続設定
- シーン切り替えボタン (X、運転見合わせ、運転再開、欠航、渋滞、通行止め)
- テキスト編集機能 (Input 8のタイトルエディター)
- 設定の保存・読み込み (config.json)
- ダークモード対応

## セットアップ

### 1. 必要なパッケージのインストール

```bash
pip install -r requirements.txt
```

### 2. アプリケーションの起動

```bash
python main.py
```

## 使用方法

### vMix接続設定

1. IPアドレスを入力 (デフォルト: localhost)
2. ポート番号を入力 (デフォルト: 8088)
3. 「設定を保存」ボタンをクリック
4. 接続状態が表示されます

### シーン切り替え

各ボタンをクリックすると、対応するvMix InputにDSK (DownstreamKey) コマンドが送信されます:

| ボタン | Input番号 | DSK | 追加動作 |
|--------|-----------|-----|----------|
| X | Input 1 | DSK1 | - |
| 運転見合わせ | Input 2 | DSK2 | Input 7をDSK4でオーバーレイ |
| 運転再開 | Input 3 | DSK2 | Input 7をDSK4でオーバーレイ |
| 欠航 | Input 4 | DSK2 | Input 7をDSK4でオーバーレイ |
| 渋滞 | Input 5 | DSK2 | Input 7をDSK4でオーバーレイ |
| 通行止め | Input 6 | DSK2 | Input 7をDSK4でオーバーレイ |

**動作仕様:**
- Input 1: DSK1でオーバーレイ
- Input 2-6: DSK2でオーバーレイし、同時にInput 7をDSK4でオーバーレイ

### テキスト更新

1. テキスト入力欄にテキストを入力
2. 「テキスト更新」ボタンをクリック
3. Input 8のテキストが更新されます

## ファイル構成

```
vMix_OA/
├── main.py              # メインアプリケーション
├── vmix_api.py          # vMix API通信クラス
├── config_manager.py    # 設定管理クラス
├── requirements.txt     # 必要パッケージリスト
├── config.json          # 設定ファイル (自動生成)
└── README.md            # このファイル
```

## 技術仕様

- Python 3.8以上
- customtkinter - モダンUIライブラリ
- requests - HTTP通信ライブラリ

## vMix API仕様

- エンドポイント: `http://{IP}:{PORT}/api/`
- DSK1 (OverlayInput1): `?Function=OverlayInput1&Input={番号}`
- DSK2 (OverlayInput2): `?Function=OverlayInput2&Input={番号}`
- DSK4 (OverlayInput4): `?Function=OverlayInput4&Input={番号}`
- テキスト設定: `?Function=SetText&Input=8&Value={テキスト}`
