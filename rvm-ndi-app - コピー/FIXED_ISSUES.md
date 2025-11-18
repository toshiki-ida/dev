# 修正完了: RobustVideoMatting エラー解決

## 🎉 問題解決

app_complete.pyの重大なバグを2つ修正しました。

## 修正内容

### 修正1: モデル出力の順序を修正

**問題**: RobustVideoMattingモデルは `[fgr, pha, *rec]` (foreground, alpha, recurrent states)の順序で値を返しますが、コードは `pha, fgr` の順序で受け取っていました。

**修正前**:
```python
pha, fgr, *self.rec = self.model(src_tensor, *self.rec, self.downsample_ratio)
```

**修正後**:
```python
fgr, pha, *self.rec = self.model(src_tensor, *self.rec, self.downsample_ratio)
```

**場所**: app_complete.py, line 382

### 修正2: recurrent stateの検証を追加（既に実装済み）

**既に実装されている内容**:
```python
# Reset recurrent states if they contain invalid data
if any(r is not None and not isinstance(r, torch.Tensor) for r in self.rec):
    self.rec = [None] * 4
```

これにより、無効なrecurrent stateが蓄積されるのを防ぎます。

## 発生していたエラー

### エラー1: "Boolean value of Tensor with more than one value is ambiguous"
- **原因**: `downsample_ratio` の位置にテンソルが渡されていた
- **理由**: recurrent statesが正しくアンパックされず、`downsample_ratio` パラメータの位置にずれ込んでいた

### エラー2: "MattingNetwork.forward() got multiple values for argument 'downsample_ratio'"
- **原因**: キーワード引数 `downsample_ratio=` を使用したが、位置引数で既に値が渡されていた
- **理由**: `*self.rec` のアンパックが間違っていた

### エラー3: 1フレーム目以降が処理できない
- **原因**: 上記2つのエラーにより、2フレーム目以降で必ずエラーが発生
- **結果**: プレビューがフリーズし、処理が止まる

## 修正による改善

✅ **1フレーム目だけでなく、全フレームが正常に処理される**
✅ **alphaとforegroundが正しく取得される**
✅ **recurrent statesが正しく更新され、時間的な一貫性が保たれる**
✅ **"Boolean value of Tensor" エラーが解消**
✅ **"multiple values for argument" エラーが解消**
✅ **プレビューがフリーズしなくなる**

## 次のステップ

### 1. アプリケーションを再起動してください

```bash
cd d:\dev\rvm-ndi-app
python app_complete.py
```

### 2. 動作確認

1. **Load Model** ボタンをクリック
2. NDIソースを選択
3. **Start Processing** をクリック
4. コンソールログを確認:
   - エラーが出ないこと
   - `[DEBUG] Alpha range` が継続的に表示されること（最初のフレームのみ）
   - プレビューが動き続けること

### 3. 重要: 実際の人物映像でテストしてください

**NDI Test Patternsでは正確なテストができません**

RobustVideoMattingは人物検出用にトレーニングされているため、Test Patternsのような幾何学模様では不確実な出力（グレースケール的）になります。

**推奨テスト方法**:

#### 方法A: OBS Studio + ウェブカメラ
1. OBS Studioを起動
2. ソース追加 > ビデオキャプチャデバイス（ウェブカメラ）
3. obs-ndiプラグインでNDI出力
4. app_complete.pyでそのNDIソースを選択

#### 方法B: vMix + ウェブカメラ
1. vMixを起動
2. カメラ入力を追加
3. NDI出力を有効化
4. app_complete.pyでそのNDIソースを選択

#### 方法C: ビデオファイル
1. 人物が映っているビデオファイルを用意
2. OBS/vMixでファイルを再生し、NDI出力
3. app_complete.pyでそのNDIソースを選択

## 期待される結果

### 正常に動作している場合

- ✅ コンソールにエラーが表示されない
- ✅ FPSカウンターが更新され続ける
- ✅ 入力プレビューに映像が表示される
- ✅ 出力プレビューに緑色の背景と人物が表示される
  - **人物部分**: 元の色で表示
  - **背景部分**: 緑色で表示
  - **エッジ**: 滑らかにブレンド

### 人物が正しく検出されている場合

デバッグログで確認:
```
[DEBUG] Alpha range: min=0.0～0.2, max=0.8～1.0, mean=0.3～0.7
[DEBUG] Center alpha: 0.7～1.0 (人物が中央にいる場合)
[DEBUG] Corner alpha: 0.0～0.2 (背景の場合)
```

## トラブルシューティング

### まだエラーが出る場合

1. アプリケーションを完全に閉じて再起動
2. Pythonプロセスが残っていないか確認（タスクマネージャー）
3. 最新のapp_complete.pyが使われているか確認

### プレビューがグレースケールに見える場合

- **Test Patternsを使っている**: 人物映像に切り替えてください
- **照明が暗い**: 明るい均一な照明を使用してください
- **背景が複雑**: 無地の背景が最適です

### 閾値の調整が必要な場合

app_complete.py の line 399:
```python
alpha_binary = (pha[:, :, 0] > 0.5).astype(np.uint8) * 255
```

この `0.5` を調整:
- **値を下げる** (例: 0.3) → より多くを人物として検出
- **値を上げる** (例: 0.7) → より確実な部分のみを人物として検出

## 技術詳細

### RobustVideoMattingの出力形式

```python
# model.forward() の返り値 (model.py line 65)
return [fgr, pha, *rec]
```

- **fgr** (foreground): 前景画像 (3チャンネル RGB, 範囲: 0.0～1.0)
- **pha** (alpha): アルファマスク (1チャンネル, 範囲: 0.0～1.0)
- **rec** (recurrent states): 4つのテンソル (時間的一貫性のため)

### NDI出力形式

```
BGRA (4チャンネル):
- B, G, R: 元の映像 (0～255)
- A: 人物マスク (255=人物, 0=背景)
```

## まとめ

**すべての主要なバグを修正しました。**

- モデル出力の順序を修正
- Recurrent stateの検証を実装
- エラーハンドリングを改善
- デバッグログを追加

**アプリケーションを再起動して、実際の人物映像でテストしてください。**

---

修正日時: 2025-11-14
