"""
Deep dive into connection issue - check what _connect_to actually does
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
print("NDI Connection Deep Debug")
print("=" * 70)

from cyndilib.finder import Finder, Source
from cyndilib.receiver import Receiver, ReceiveFrameType
from cyndilib.video_frame import VideoRecvFrame
from cyndilib.audio_frame import AudioRecvFrame
from cyndilib.wrapper.ndi_recv import RecvColorFormat, RecvBandwidth

# Find sources
print("\n[Step 1] Finding sources...")
finder = Finder()
finder.open()
finder.wait_for_sources(5000)

sources = list(finder.iter_sources())
if not sources:
    print("No sources found!")
    sys.exit(1)

src = sources[0]
print(f"Source: {src.name}")
print(f"  host_name: {src.host_name}")
print(f"  stream_name: {src.stream_name}")
print(f"  valid: {src.valid}")

# Create receiver WITH source in constructor
print("\n[Step 2] Creating receiver WITH source in constructor...")
receiver1 = Receiver(
    source=src,  # ← ここでsourceを渡す
    color_format=RecvColorFormat.BGRX_BGRA,
    bandwidth=RecvBandwidth.highest
)

# Create frame objects
video_frame1 = VideoRecvFrame()
audio_frame1 = AudioRecvFrame()
receiver1.set_video_frame(video_frame1)
receiver1.set_audio_frame(audio_frame1)

print("Waiting 3 seconds...")
time.sleep(3)

print(f"  is_connected: {receiver1.is_connected()}")
print(f"  num_connections: {receiver1.get_num_connections()}")
print(f"  source_name: {receiver1.source_name}")

# Try to receive
print("\nAttempting to receive (5 attempts)...")
for i in range(1, 6):
    result = receiver1.receive(ReceiveFrameType.recv_video, timeout_ms=1000)
    if result == ReceiveFrameType.recv_video:
        print(f"  [{i}] [SUCCESS] Got video frame!")
        vf = receiver1.video_frame
        print(f"       {vf.xres}x{vf.yres}")
        break
    elif result == ReceiveFrameType.nothing:
        print(f"  [{i}] [TIMEOUT]")
    else:
        print(f"  [{i}] [{result}]")

print("\n" + "=" * 70)
print("[Step 3] Alternative: Create receiver then connect")
print("=" * 70)

receiver2 = Receiver(
    color_format=RecvColorFormat.BGRX_BGRA,
    bandwidth=RecvBandwidth.highest
)

video_frame2 = VideoRecvFrame()
audio_frame2 = AudioRecvFrame()
receiver2.set_video_frame(video_frame2)
receiver2.set_audio_frame(audio_frame2)

print(f"Before connect:")
print(f"  is_connected: {receiver2.is_connected()}")
print(f"  num_connections: {receiver2.get_num_connections()}")

print(f"\nCalling connect_to(src)...")
receiver2.connect_to(src)

print(f"Immediately after connect_to:")
print(f"  is_connected: {receiver2.is_connected()}")
print(f"  num_connections: {receiver2.get_num_connections()}")

print("Waiting 3 seconds...")
time.sleep(3)

print(f"After 3 seconds:")
print(f"  is_connected: {receiver2.is_connected()}")
print(f"  num_connections: {receiver2.get_num_connections()}")

# Try to receive
print("\nAttempting to receive (5 attempts)...")
for i in range(1, 6):
    result = receiver2.receive(ReceiveFrameType.recv_video, timeout_ms=1000)
    if result == ReceiveFrameType.recv_video:
        print(f"  [{i}] [SUCCESS] Got video frame!")
        vf = receiver2.video_frame
        print(f"       {vf.xres}x{vf.yres}")
        break
    elif result == ReceiveFrameType.nothing:
        print(f"  [{i}] [TIMEOUT]")
    else:
        print(f"  [{i}] [{result}]")

finder.close()

print("\n" + "=" * 70)
print("DIAGNOSIS")
print("=" * 70)
print("""
Key observations:
1. If both methods fail → NDI SDK level issue
2. If source in constructor works → Connection timing issue
3. If neither works → Source is not actually transmitting video

Next steps:
- Check if NDI source is actually sending video (not just metadata)
- Verify source is not password protected
- Check bandwidth/network capacity
""")
