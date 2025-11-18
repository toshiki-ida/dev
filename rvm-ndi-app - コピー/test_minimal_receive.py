"""
Minimal test to check if video reception works at all
Based on cyndilib's own test code in receiver.pyx:970-1029
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
        os.environ['PATH'] = path + os.pathsep + os.environ.get('PATH', ''  )

print("=" * 70)
print("Minimal NDI Video Reception Test")
print("=" * 70)

from cyndilib.finder import Finder, Source
from cyndilib.receiver import Receiver, ReceiveFrameType
from cyndilib.video_frame import VideoRecvFrame
from cyndilib.audio_frame import AudioRecvFrame
from cyndilib.wrapper.ndi_recv import RecvColorFormat, RecvBandwidth

# Step 1: Find a source
print("\n[Step 1] Finding sources...")
finder = Finder()
finder.open()
time.sleep(3)

sources = list(finder.iter_sources())
print(f"Found {len(sources)} source(s):")
for i, src in enumerate(sources, 1):
    print(f"  {i}. {src.name}")
    print(f"      host: {src.host_name}")
    print(f"      valid: {src.valid}")

if not sources:
    print("\n[ERROR] No sources found!")
    finder.close()
    sys.exit(1)

src = sources[0]
print(f"\n[Step 2] Using source: {src.name}")

# Step 2: Create receiver like the test function does
print("[Step 3] Creating receiver...")
receiver = Receiver(color_format=RecvColorFormat.BGRX_BGRA, bandwidth=RecvBandwidth.highest)

# Create frame objects
video_frame = VideoRecvFrame()
audio_frame = AudioRecvFrame()
receiver.set_video_frame(video_frame)
receiver.set_audio_frame(audio_frame)

print(f"[Step 4] Connecting to source: {src.name}")
receiver.connect_to(src)

# Wait for connection
print("[Step 5] Waiting for connection...")
time.sleep(2)

# Check connection status
print(f"  is_connected: {receiver.is_connected()}")
print(f"  num_connections: {receiver.get_num_connections()}")

# Try to receive frames
print("\n[Step 6] Attempting to receive video frames (10 attempts)...")
recv_type = ReceiveFrameType.recv_video | ReceiveFrameType.recv_audio

success_count = 0
for i in range(1, 11):
    frame_type = receiver.receive(recv_type, 1000)

    if frame_type == ReceiveFrameType.recv_video:
        print(f"  [{i:2d}] [VIDEO] Received!")
        print(f"       Resolution: {video_frame.xres}x{video_frame.yres}")
        print(f"       Format: {video_frame.fourcc}")
        success_count += 1
        break
    elif frame_type == ReceiveFrameType.recv_audio:
        print(f"  [{i:2d}] [AUDIO] Received (not video)")
    elif frame_type == ReceiveFrameType.recv_status_change:
        print(f"  [{i:2d}] [STATUS] Connection status changed")
    elif frame_type == ReceiveFrameType.nothing:
        print(f"  [{i:2d}] [TIMEOUT] No data", end='\r')
    else:
        print(f"  [{i:2d}] [OTHER] {frame_type}")

print()
print("=" * 70)
print("Summary")
print("=" * 70)

if success_count > 0:
    print(f"\n[SUCCESS] Received {success_count} video frame(s)!")
    print("NDI reception is working correctly.")
else:
    print("\n[FAIL] No video frames received.")
    print("\nPossible causes:")
    print("  1. Source is not actively sending video")
    print("  2. Network/firewall blocking")
    print("  3. cyndilib issue with this specific source type")

finder.close()
