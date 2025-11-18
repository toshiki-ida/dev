"""
Test with exact source names from NDI Studio Monitor
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
print("NDI Exact Source Names Test")
print("=" * 70)

from cyndilib import finder, receiver
from cyndilib.wrapper.ndi_recv import RecvColorFormat, RecvBandwidth
import time

# Step 1: What does Finder return?
print("\n[Step 1] Finder sources:")
print("-" * 70)

ndi_finder = finder.Finder()
ndi_finder.open()
time.sleep(3)

finder_sources = ndi_finder.get_source_names()
for i, name in enumerate(finder_sources, 1):
    print(f"  {i}. '{name}'")

# Step 2: Parse the source names
print("\n[Step 2] Analyzing source name format:")
print("-" * 70)

for name in finder_sources:
    if '(' in name and ')' in name:
        parts = name.split('(')
        host = parts[0].strip()
        stream = parts[1].rstrip(')').strip()
        print(f"  Full name: '{name}'")
        print(f"    Host: '{host}'")
        print(f"    Stream: '{stream}'")

# Step 3: Try exact names from NDI Studio Monitor
print("\n[Step 3] Testing exact names from Studio Monitor:")
print("-" * 70)

# Based on screenshot, these are the exact stream names
test_names = [
    # Full format with PC name (what Finder returns)
    "CG_DEV_001 (Remote Connection 1)",
    "CG_DEV_001 (Test Pattern)",
    "CG_DEV_001 (vMix - Output 1)",

    # Try with different spacing/formatting
    "CG_DEV_001 (Test Patterns)",
    "CG_DEV_001 (Test Patterns v1)",
]

for source_name in test_names:
    print(f"\nTesting: '{source_name}'")

    try:
        # Try via Finder first
        source_obj = ndi_finder.get_source(source_name)

        if source_obj:
            print(f"  [FINDER] Found in Finder")
            recv = receiver.Receiver(
                source=source_obj,
                color_format=RecvColorFormat.BGRX_BGRA,
                bandwidth=RecvBandwidth.highest
            )
        else:
            print(f"  [DIRECT] Not in Finder, trying direct connection")
            recv = receiver.Receiver(
                source_name=source_name,
                color_format=RecvColorFormat.BGRX_BGRA,
                bandwidth=RecvBandwidth.highest
            )

        # Try to receive a frame
        result = recv.receive(receiver.ReceiveFrameType.recv_video, timeout_ms=2000)

        if result == receiver.ReceiveFrameType.recv_video:
            video_frame = recv.video_frame
            print(f"  [SUCCESS] Received video!")
            print(f"    Resolution: {video_frame.xres}x{video_frame.yres}")
        else:
            print(f"  [NO VIDEO] Receiver created but no video received")

    except Exception as e:
        print(f"  [ERROR] {e}")

# Step 4: Summary
print("\n" + "=" * 70)
print("Summary")
print("=" * 70)
print("\nExpected sources (from Studio Monitor screenshot):")
print("  1. Remote Connection 1")
print("  2. Test Pattern")
print("  3. vMix - Output 1")
print(f"\nFinder detected: {len(finder_sources)} source(s)")

ndi_finder.close()
