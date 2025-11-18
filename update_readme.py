#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('st2110-rds-manager/README.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Quick start section
quick_start = """
## クイックスタート

### 🚀 一発起動 (推奨)

**Windowsユーザー:**
```bash
# すべてのサーバーを起動
start-all.bat

# モックRDSサーバー付きで起動
start-all-with-mock.bat

# クイックスタート (最小限のプロンプト)
quick-start.bat

# すべて停止
stop-all.bat
```

**手動起動:**

1. バックエンドとフロントエンドを別々のターミナルで起動:
```bash
# ターミナル1: バックエンド
cd backend
npm install  # 初回のみ
npm run dev

# ターミナル2: フロントエンド
cd frontend
npm install  # 初回のみ
npm run dev
```

2. ブラウザで開く: http://localhost:5173

### バッチファイル説明

| ファイル名 | 説明 |
|-----------|------|
| `start-all.bat` | バックエンド・フロントエンドを起動 |
| `start-all-with-mock.bat` | すべて + モックRDSサーバー2台を起動 |
| `quick-start.bat` | 最小限のプロンプトでクイック起動 |
| `stop-all.bat` | すべてのサーバーを停止 |

"""

# Insert before setup section
content = content.replace('## セットアップ', quick_start + '## セットアップ')

with open('st2110-rds-manager/README.md', 'w', encoding='utf-8') as f:
    f.write(content)

print('README.md updated successfully')
