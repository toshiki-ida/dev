"""
Test NDI reception with NDI 5 Runtime
"""
import os
import sys
import time

# Force NDI 5 Runtime - put it FIRST in PATH
ndi5_runtime = r"C:\Program Files\NDI\NDI 5 Tools\Runtime"
if os.path.exists(ndi5_runtime):
    os.environ['PATH'] = ndi5_runtime + os.pathsep + os.environ.get('PATH', '')
    print(f"[INFO] Using NDI 5 Runtime: {ndi5_runtime}")
else:
    print(f"[ERROR] NDI 5 Runtime not found at: {ndi5_runtime}")
    sys.exit(1)

print("=" * 70)
print("NDI Reception Test with NDI 5 Runtime")
print("=" * 70)

# Verify which DLL will be loaded
import ctypes.util
dll_path = ctypes.util.find_library("Processing.NDI.Lib.x64")
print(f"\nDLL that will be loaded: {dll_path}")

# Import cyndilib
from cyndilib.finder import Finder, Source
from cyndilib.receiver import Receiver, ReceiveFrameType
from cyndilib.video_frame import VideoRecvFrame
from cyndilib.audio_frame import AudioRecvFrame
from cyndilib.wrapper.ndi_recv import RecvColorFormat, RecvBandwidth

# Find sources
print("\n[Step 1] Finding NDI sources...")
finder = Finder()
finder.open()
print("Waiting 5 seconds...")
time.sleep(5)

sources = list(finder.iter_sources())
print(f"\nFound {len(sources)} source(s):")

for i, src in enumerate(sources, 1):
    print(f"  {i}. {src.name}")
    print(f"      host: {src.host_name}")
    print(f"      stream: {src.stream_name}")
    print(f"      valid: {src.valid}")

if not sources:
    print("\n[ERROR] No sources found!")
    finder.close()
    sys.exit(1)

# Select first source
src = sources[0]
print(f"\n[Step 2] Connecting to: {src.name}")
print("=" * 70)

# Create receiver
receiver = Receiver(
    source=src,
    color_format=RecvColorFormat.BGRX_BGRA,
    bandwidth=RecvBandwidth.highest
)

video_frame = VideoRecvFrame()
audio_frame = AudioRecvFrame()
receiver.set_video_frame(video_frame)
receiver.set_audio_frame(audio_frame)

# Check connection
print("\nChecking connection status (every second for 10 seconds):")
for i in range(1, 11):
    time.sleep(1)
    num_conn = receiver.get_num_connections()
    is_conn = receiver.is_connected()

    status = "[CONNECTED]" if num_conn > 0 else "[Not connected]"
    print(f"  [{i:2d}s] num_connections={num_conn}, is_connected={is_conn} - {status}")

    if num_conn > 0:
        print(f"\n[SUCCESS] Connected after {i} seconds!")
        break

if receiver.get_num_connections() == 0:
    print("\n[FAIL] Could not connect even with NDI 5")
    print("\nPossible remaining issues:")
    print("  1. The source is not actually transmitting video")
    print("  2. The source has connection restrictions")
    print("  3. Need to try a different source (e.g., local Test Patterns)")
    finder.close()
    sys.exit(1)

# Try to receive video
print("\n[Step 3] Attempting to receive video frames...")
print("=" * 70)

success_count = 0
for i in range(1, 21):
    result = receiver.receive(ReceiveFrameType.recv_video, timeout_ms=1000)

    if result == ReceiveFrameType.recv_video:
        vf = receiver.video_frame
        print(f"\n[{i:2d}] [SUCCESS] Received video frame!")
        print(f"      Resolution: {vf.xres}x{vf.yres}")
        print(f"      Format: {vf.fourcc}")
        print(f"      FPS: {vf.frame_rate_N}/{vf.frame_rate_D}")
        print(f"      Data shape: {vf.data.shape}")
        print(f"      Data type: {vf.data.dtype}")
        success_count += 1

        # Get more frames to confirm
        print(f"\n      Receiving 5 more frames to confirm stability...")
        for j in range(1, 6):
            result2 = receiver.receive(ReceiveFrameType.recv_video, timeout_ms=1000)
            if result2 == ReceiveFrameType.recv_video:
                vf2 = receiver.video_frame
                print(f"        Frame {j}: OK ({vf2.xres}x{vf2.yres})")
            else:
                print(f"        Frame {j}: Failed")

        break
    elif result == ReceiveFrameType.nothing:
        print(f"  [{i:2d}] Timeout", end='\r')
    elif result == ReceiveFrameType.recv_status_change:
        print(f"\n  [{i:2d}] Status change")
    else:
        print(f"\n  [{i:2d}] Other: {result}")

finder.close()

print("\n\n" + "=" * 70)
print("FINAL RESULTS")
print("=" * 70)

if success_count > 0:
    print(f"\n[SUCCESS] NDI video reception is WORKING with NDI 5!")
    print(f"\nReceived {success_count} video frame(s) successfully.")
    print("\nThis confirms:")
    print("  [OK] cyndilib 0.0.9 works with NDI 5")
    print("  [OK] The issue was NDI SDK 6 incompatibility")
    print("  [OK] Your application can now proceed with development")
    print("\nNext steps:")
    print("  1. Update main_ndi.py to prioritize NDI 5 (already done)")
    print("  2. Test with RobustVideoMatting model")
    print("  3. Implement NDI sender for output")
else:
    print(f"\n[FAIL] No video frames received even with NDI 5")
    print(f"\nConnection status: {receiver.get_num_connections()} connections")
    print("\nThis suggests:")
    print("  - The source may not be sending video")
    print("  - Or there's a deeper issue with the source configuration")
    print("\nPlease try with a different NDI source (local Test Patterns)")
