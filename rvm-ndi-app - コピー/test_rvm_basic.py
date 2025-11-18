"""
RobustVideoMatting 基本動作テスト
公式のサンプルコードを使用して、モデルが正しく動作するか確認
"""
import sys
import os
import torch
import cv2
import numpy as np

# Add RobustVideoMatting to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'RobustVideoMatting'))

from model import MattingNetwork

# GPU設定
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
MODEL_PATH = 'RobustVideoMatting/rvm_mobilenetv3.pth'

print("=" * 70)
print("RobustVideoMatting 基本動作テスト")
print("=" * 70)
print(f"Device: {DEVICE}")
print(f"Model: {MODEL_PATH}")

# モデル読み込み
print("\n[1] モデル読み込み中...")
model = MattingNetwork('mobilenetv3').eval().to(DEVICE)
model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
print("[OK] モデル読み込み完了")

# テスト画像を生成（人物がいると仮定した簡単な画像）
print("\n[2] テスト画像生成中...")
# 1920x1080のテスト画像（中央に白い四角 = 擬似的な人物）
test_img = np.zeros((1080, 1920, 3), dtype=np.uint8)
# 背景を灰色に
test_img[:, :] = (100, 100, 100)
# 中央に白い四角（人物の代わり）
test_img[300:780, 760:1160] = (255, 255, 255)

print(f"テスト画像サイズ: {test_img.shape}")
cv2.imwrite("test_input.jpg", test_img)
print("[OK] test_input.jpg に保存")

# RVMで処理
print("\n[3] RVM処理実行中...")

# downsample
downsample_ratio = 0.25
h, w = test_img.shape[:2]
new_h = int(h * downsample_ratio)
new_w = int(w * downsample_ratio)
src_small = cv2.resize(test_img, (new_w, new_h), interpolation=cv2.INTER_AREA)

# RGB変換とテンソル化
src_rgb = cv2.cvtColor(src_small, cv2.COLOR_BGR2RGB)
src_tensor = torch.from_numpy(src_rgb).permute(2, 0, 1).unsqueeze(0).float() / 255.0
src_tensor = src_tensor.to(DEVICE)

print(f"入力テンソルサイズ: {src_tensor.shape}")

# モデル実行
rec = [None] * 4
with torch.no_grad():
    pha, *rec = model(src_tensor, *rec, downsample_ratio)

print(f"出力アルファサイズ: {pha.shape}")
print(f"アルファ値の範囲: min={pha.min().item():.3f}, max={pha.max().item():.3f}")

# アルファマスクを元のサイズに戻す
pha_numpy = pha.squeeze(0).cpu().numpy()
pha_numpy = pha_numpy.transpose(1, 2, 0)  # CHW to HWC
pha_resized = cv2.resize(pha_numpy, (w, h), interpolation=cv2.INTER_LINEAR)

print(f"リサイズ後アルファ: {pha_resized.shape}")
print(f"リサイズ後範囲: min={pha_resized.min():.3f}, max={pha_resized.max():.3f}")

# アルファマスクを画像として保存
alpha_vis = (pha_resized[:, :, 0] * 255).astype(np.uint8)
cv2.imwrite("test_alpha_raw.jpg", alpha_vis)
print("[OK] test_alpha_raw.jpg に保存（グレースケールアルファ）")

# 2値化（閾値0.5）
alpha_binary = (pha_resized[:, :, 0] > 0.5).astype(np.uint8) * 255
cv2.imwrite("test_alpha_binary.jpg", alpha_binary)
print("[OK] test_alpha_binary.jpg に保存（2値化アルファ）")

# 元の画像とアルファを合成してBGRA作成
bgra_output = np.zeros((h, w, 4), dtype=np.uint8)
bgra_output[:, :, :3] = test_img  # BGR
bgra_output[:, :, 3] = alpha_binary  # A

# BGRAをプレビュー用に変換（アルファを可視化）
alpha_preview = np.zeros((h, w, 3), dtype=np.uint8)
alpha_preview[:, :, :] = alpha_binary[:, :, np.newaxis]
cv2.imwrite("test_alpha_preview.jpg", alpha_preview)
print("[OK] test_alpha_preview.jpg に保存（アルファプレビュー）")

print("\n" + "=" * 70)
print("結果")
print("=" * 70)
print(f"生成されたファイル:")
print(f"  1. test_input.jpg - 入力画像")
print(f"  2. test_alpha_raw.jpg - RVMが出力した生のアルファ（グレースケール）")
print(f"  3. test_alpha_binary.jpg - 2値化後のアルファ（人物=白、背景=黒）")
print(f"  4. test_alpha_preview.jpg - アルファマスクのプレビュー")
print()
print("これらの画像を確認して、正しくアルファマスクが生成されているか確認してください。")
print()
print("期待される結果:")
print("  - test_alpha_raw.jpg: 中央の四角が白～グレー、周囲が黒")
print("  - test_alpha_binary.jpg: 中央の四角が真っ白、周囲が真っ黒")
