"""
Extended video reception test with longer timeouts
"""
import os
import sys

# Add NDI Runtime to PATH
ndi_runtime_paths = [
    r"C:\Program Files\NDI\NDI 6 SDK\Bin\x64",
    r"C:\Program Files\NDI\NDI 6 Runtime\v6",
]

for path in ndi_runtime_paths:
    if os.path.exists(path):
        os.environ['PATH'] = path + os.pathsep + os.environ.get('PATH', '')

print("=" * 70)
print("NDI Extended Video Reception Test")
print("=" * 70)

from cyndilib import receiver
from cyndilib.wrapper.ndi_recv import RecvColorFormat, RecvBandwidth, ReceiveFrameType
import time

# Test all three sources with extended timeouts
sources = [
    "CG_DEV_001 (Remote Connection 1)",
    "CG_DEV_001 (Test Pattern)",
    "CG_DEV_001 (vMix - Output 1)",
]

for source_name in sources:
    print(f"\n{'='*70}")
    print(f"Testing: {source_name}")
    print('='*70)

    try:
        print("Creating receiver...")
        recv = receiver.Receiver(
            source_name=source_name,
            color_format=RecvColorFormat.BGRX_BGRA,
            bandwidth=RecvBandwidth.highest
        )
        print("[OK] Receiver created")

        # Wait for connection
        print("Waiting for connection...")
        time.sleep(2)

        # Try to receive frames for 20 seconds
        print("Attempting to receive frames (20 attempts)...")

        for i in range(1, 21):
            result = recv.receive(ReceiveFrameType.recv_video, timeout_ms=1000)

            if result == ReceiveFrameType.recv_video:
                video_frame = recv.video_frame
                print(f"\n[{i:2d}] [SUCCESS] Video frame received!")
                print(f"     Resolution: {video_frame.xres}x{video_frame.yres}")
                print(f"     Format: {video_frame.fourcc}")
                print(f"     Frame rate: {video_frame.frame_rate_N}/{video_frame.frame_rate_D}")

                # Try to get a few more frames to confirm it's working
                print(f"     Getting more frames...")
                for j in range(5):
                    result = recv.receive(ReceiveFrameType.recv_video, timeout_ms=1000)
                    if result == ReceiveFrameType.recv_video:
                        print(f"       Frame {j+1}: OK")
                    else:
                        print(f"       Frame {j+1}: No frame")

                break
            elif result == ReceiveFrameType.recv_status_change:
                print(f"  [{i:2d}] Status change")
            elif result == ReceiveFrameType.recv_audio:
                print(f"  [{i:2d}] Audio frame received (not video)")
            elif result == ReceiveFrameType.nothing:
                print(f"  [{i:2d}] Timeout", end='\r')
            else:
                print(f"  [{i:2d}] Other: {result}")

        else:
            print(f"\n\n[FAIL] No video received after 20 attempts")

    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()

print("\n" + "=" * 70)
print("Test completed")
print("=" * 70)
print("\nIf NO video was received from ANY source:")
print("  This indicates a fundamental incompatibility between")
print("  cyndilib 0.0.9 and NDI SDK 6 on this system.")
print("\nRecommended solution:")
print("  Install NDI SDK 5 Runtime and configure the app to use it.")
