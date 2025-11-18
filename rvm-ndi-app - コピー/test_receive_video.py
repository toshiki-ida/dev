"""
Test video reception from the known working source
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
print("NDI Video Reception Test")
print("=" * 70)

from cyndilib import finder, receiver
from cyndilib.wrapper.ndi_recv import RecvColorFormat, RecvBandwidth
import time

# Get the known source
print("\nFinding sources...")
ndi_finder = finder.Finder()
ndi_finder.open()
time.sleep(3)

sources = ndi_finder.get_source_names()
if not sources:
    print("[ERROR] No sources found!")
    ndi_finder.close()
    sys.exit(1)

source_name = sources[0]
print(f"[OK] Using source: '{source_name}'")

# Get source object
source_obj = ndi_finder.get_source(source_name)
if source_obj is None:
    print("[ERROR] Could not get source object!")
    ndi_finder.close()
    sys.exit(1)

print(f"[OK] Got source object")
print(f"  Valid: {source_obj.valid}")
print(f"  Host: {source_obj.host_name}")
print(f"  Stream: {source_obj.stream_name}")

# Create receiver
print("\nCreating receiver...")
recv = receiver.Receiver(
    source=source_obj,
    color_format=RecvColorFormat.BGRX_BGRA,
    bandwidth=RecvBandwidth.highest
)
print("[OK] Receiver created")

# Check connection status
print(f"  is_connected: {recv.is_connected}")
print(f"  source_name: {recv.source_name}")

# Try to receive video frames
print("\nAttempting to receive video frames...")
print("Trying 10 times with 1 second timeout each:")
print()

success_count = 0
for i in range(1, 11):
    result = recv.receive(receiver.ReceiveFrameType.recv_video, timeout_ms=1000)

    if result == receiver.ReceiveFrameType.recv_video:
        video_frame = recv.video_frame
        print(f"  [{i:2d}] [SUCCESS] Received frame!")
        print(f"       Resolution: {video_frame.xres}x{video_frame.yres}")
        print(f"       Format: {video_frame.fourcc}")
        print(f"       Data shape: {video_frame.data.shape}")
        success_count += 1
        break
    elif result == receiver.ReceiveFrameType.nothing:
        print(f"  [{i:2d}] [TIMEOUT] No frame received")
    elif result == receiver.ReceiveFrameType.recv_status_change:
        print(f"  [{i:2d}] [STATUS] Connection status changed")
    else:
        print(f"  [{i:2d}] [OTHER] Received: {result}")

print()
print("=" * 70)
print("Summary")
print("=" * 70)

if success_count > 0:
    print(f"\n[SUCCESS] Received {success_count} frame(s) from '{source_name}'")
    print("This source IS sending video!")
else:
    print(f"\n[FAIL] No frames received from '{source_name}'")
    print("\nPossible reasons:")
    print("  1. The source is not actually sending video")
    print("  2. The source is paused or stopped")
    print("  3. Network/bandwidth issue")
    print("  4. NDI SDK compatibility issue")
    print("\nPlease verify in NDI Studio Monitor that this source is:")
    print("  - Showing live video (not black screen)")
    print("  - Actually transmitting (check bandwidth)")

ndi_finder.close()
