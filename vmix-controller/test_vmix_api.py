"""
vMix API テストスクリプト
"""
import requests

# vMix APIのベースURL
base_url = "http://localhost:8088/api/"

print("=== vMix API Test ===\n")

# 1. XMLステータスを取得
print("1. Getting XML status...")
try:
    response = requests.get(base_url, timeout=5)
    if response.status_code == 200:
        print(f"✓ Connection successful")
        # 最初の入力を取得
        import xml.etree.ElementTree as ET
        root = ET.fromstring(response.text)
        for i, input_elem in enumerate(root.findall('.//input')):
            if i >= 3:  # 最初の3つのみ表示
                break
            title = input_elem.get('title', '')
            key = input_elem.get('key', '')
            print(f"  Input {i+1}: title='{title}', key='{key}'")
    else:
        print(f"✗ Connection failed: {response.status_code}")
except Exception as e:
    print(f"✗ Error: {e}")

print("\n2. Testing SetZoom command...")
test_input = input("Enter input name or number to test (or press Enter to skip): ").strip()

if test_input:
    # Zoomのテスト
    print(f"Testing zoom on '{test_input}'...")
    params = {"Function": "SetZoom", "Input": test_input, "Value": "1.5"}
    try:
        response = requests.get(base_url, params=params, timeout=5)
        print(f"  Response: {response.status_code} - {response.text[:200]}")
    except Exception as e:
        print(f"  Error: {e}")

    # PanXのテスト
    print(f"\nTesting PanX on '{test_input}'...")
    params = {"Function": "SetPanX", "Input": test_input, "Value": "0.5"}
    try:
        response = requests.get(base_url, params=params, timeout=5)
        print(f"  Response: {response.status_code} - {response.text[:200]}")
    except Exception as e:
        print(f"  Error: {e}")

    # Cropのテスト
    print(f"\nTesting SetCrop on '{test_input}'...")
    params = {"Function": "SetCrop", "Input": test_input, "Value": "0.1,0.1,0.9,0.9"}
    try:
        response = requests.get(base_url, params=params, timeout=5)
        print(f"  Response: {response.status_code} - {response.text[:200]}")
    except Exception as e:
        print(f"  Error: {e}")

print("\n=== Test Complete ===")
