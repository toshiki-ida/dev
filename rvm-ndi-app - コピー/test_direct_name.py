"""
Connect directly to NDI source by name (bypass Finder)
This tests if Finder is the problem
"""
import os
import sys
import time

# Add NDI Runtime to PATH
ndi_runtime_paths = [
    r"C:\Program Files\NDI\NDI 6 SDK\Bin\x64",
    r"C:\Program Files\NDI\NDI 6 Runtime\v6",
]

for path in ndi_runtime_paths:
    if os.path.exists(path):
        os.environ['PATH'] = path + os.pathsep + os.environ.get('PATH', '')

print("=" * 70)
print("NDI Direct Connection by Source Name")
print("=" * 70)

from cyndilib.receiver import Receiver, ReceiveFrameType
from cyndilib.video_frame import VideoRecvFrame
from cyndilib.audio_frame import AudioRecvFrame
from cyndilib.wrapper.ndi_recv import RecvColorFormat, RecvBandwidth

print("\n[IMPORTANT] Please provide the EXACT source name from NDI Monitor")
print("\nCommon formats:")
print("  - CG_DEV_001 (Test Patterns v1)")
print("  - CG_DEV_001 (Test Pattern)")
print("  - CG_DEV_001 (NDI Test Patterns)")
print("  - COMPUTERNAME (Test Patterns v1)")
print()

# Try multiple possible Test Patterns names
test_names = [
    "CG_DEV_001 (Test Patterns v1)",
    "CG_DEV_001 (Test Pattern)",
    "CG_DEV_001 (NDI Test Patterns)",
    "CG_DEV_001 (Test Patterns)",
    os.environ.get('COMPUTERNAME', 'CG_DEV_001') + " (Test Patterns v1)",
    os.environ.get('COMPUTERNAME', 'CG_DEV_001') + " (Test Pattern)",
]

print("Trying these source names:")
for name in test_names:
    print(f"  - {name}")

print("\n" + "=" * 70)
print("Testing each source name...")
print("=" * 70)

for source_name in test_names:
    print(f"\n[Testing] {source_name}")
    print("-" * 70)

    try:
        # Create receiver with direct source name (no Finder)
        receiver = Receiver(
            source_name=source_name,  # ← Direct name, no Finder
            color_format=RecvColorFormat.BGRX_BGRA,
            bandwidth=RecvBandwidth.highest
        )

        video_frame = VideoRecvFrame()
        audio_frame = AudioRecvFrame()
        receiver.set_video_frame(video_frame)
        receiver.set_audio_frame(audio_frame)

        print("  Receiver created successfully")
        print("  Waiting 3 seconds for connection...")
        time.sleep(3)

        num_conn = receiver.get_num_connections()
        is_conn = receiver.is_connected()
        print(f"  num_connections: {num_conn}")
        print(f"  is_connected: {is_conn}")

        if num_conn > 0:
            print(f"\n  [SUCCESS] Connected!")

            # Try to receive
            print("  Attempting to receive video...")
            for i in range(1, 6):
                result = receiver.receive(ReceiveFrameType.recv_video, timeout_ms=1000)

                if result == ReceiveFrameType.recv_video:
                    vf = receiver.video_frame
                    print(f"\n  [SUCCESS] Received video frame!")
                    print(f"    Resolution: {vf.xres}x{vf.yres}")
                    print(f"    Format: {vf.fourcc}")
                    print(f"    FPS: {vf.frame_rate_N}/{vf.frame_rate_D}")
                    print(f"\n" + "=" * 70)
                    print("SUCCESS! This source name works!")
                    print("=" * 70)
                    print(f"\nWorking source name: {source_name}")
                    print("\nYou can use this in your application!")
                    sys.exit(0)
                else:
                    print(f"    Attempt {i}: No frame", end='\r')

            print("\n  [PARTIAL] Connected but no video frames received")
        else:
            print(f"  [FAIL] Could not connect")

    except Exception as e:
        print(f"  [ERROR] {e}")

    print()

print("=" * 70)
print("RESULT: None of the test names worked")
print("=" * 70)
print("\nPlease provide the EXACT source name from NDI Monitor:")
print("  1. Open NDI Studio Monitor")
print("  2. Look at the Test Patterns source name")
print("  3. Copy it EXACTLY (including spaces, capitalization, etc.)")
print("\nThen we can create a custom test with that exact name.")

# Also show what Finder sees
print("\n" + "=" * 70)
print("For comparison, here's what Finder detects:")
print("=" * 70)

from cyndilib.finder import Finder
finder = Finder()
finder.open()
time.sleep(5)

sources = list(finder.iter_sources())
print(f"\nFinder found {len(sources)} source(s):")
for src in sources:
    print(f"  - '{src.name}'")

finder.close()

print("\nIf Test Patterns is NOT in this list, then Finder has a bug/limitation.")
