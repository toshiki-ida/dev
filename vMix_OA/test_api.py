"""vMix API テスト用スクリプト"""
import sys
from vmix_api import VmixAPI

def main():
    print("=" * 60)
    print("vMix API テストスクリプト")
    print("=" * 60)

    # API初期化
    api = VmixAPI("localhost", 8088)

    # 接続テスト
    print("\n[1] 接続テスト")
    if api.test_connection():
        print("✓ vMixへの接続に成功しました")
    else:
        print("✗ vMixへの接続に失敗しました")
        print("vMixが起動していることを確認してください")
        return

    # DSK1テスト
    print("\n[2] DSK1テスト (Input 1)")
    result = api.set_downstream_key1(1)
    print(f"結果: {'成功' if result else '失敗'}")

    # DSK2テスト
    print("\n[3] DSK2テスト (Input 2)")
    result = api.set_downstream_key2(2)
    print(f"結果: {'成功' if result else '失敗'}")

    # DSK2テスト (Input 7)
    print("\n[4] DSK2テスト (Input 7)")
    result = api.set_downstream_key2(7)
    print(f"結果: {'成功' if result else '失敗'}")

    # DSK4 ON テスト (Input 7)
    print("\n[5] DSK4 ON テスト (Input 7)")
    result = api.set_downstream_key4_on(7)
    print(f"結果: {'成功' if result else '失敗'}")

    # 少し待機
    import time
    print("\n3秒待機...")
    time.sleep(3)

    # DSK4 OFF テスト (Input 7)
    print("\n[6] DSK4 OFF テスト (Input 7)")
    result = api.set_downstream_key4_off(7)
    print(f"結果: {'成功' if result else '失敗'}")

    # テキスト設定テスト
    print("\n[7] テキスト設定テスト (Input 7)")
    result = api.set_text(7, "テスト文字列")
    print(f"結果: {'成功' if result else '失敗'}")

    print("\n" + "=" * 60)
    print("テスト完了")
    print("=" * 60)

if __name__ == "__main__":
    main()
