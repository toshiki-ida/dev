"""
Test connection WITHOUT NDI Studio Monitor running
This tests if Monitor is holding exclusive access
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
print("NDI Test WITHOUT Studio Monitor")
print("=" * 70)
print("\n[IMPORTANT] Please close NDI Studio Monitor before running this test!")
print("Press Enter when ready...")
input()

from cyndilib.finder import Finder, Source
from cyndilib.receiver import Receiver, ReceiveFrameType
from cyndilib.video_frame import VideoRecvFrame
from cyndilib.audio_frame import AudioRecvFrame
from cyndilib.wrapper.ndi_recv import RecvColorFormat, RecvBandwidth

# Find sources
print("\n[Step 1] Finding sources...")
finder = Finder()
finder.open()
time.sleep(5)

sources = list(finder.iter_sources())
print(f"Found {len(sources)} source(s):")

for i, src in enumerate(sources, 1):
    print(f"  {i}. {src.name}")

if not sources:
    print("\n[ERROR] No sources found!")
    print("This might mean:")
    print("  - The source stopped transmitting")
    print("  - Network issue")
    print("  - NDI service issue")
    finder.close()
    sys.exit(1)

# Use first source
src = sources[0]
print(f"\n[Step 2] Connecting to: {src.name}")

receiver = Receiver(
    source=src,
    color_format=RecvColorFormat.BGRX_BGRA,
    bandwidth=RecvBandwidth.highest
)

video_frame = VideoRecvFrame()
audio_frame = AudioRecvFrame()
receiver.set_video_frame(video_frame)
receiver.set_audio_frame(audio_frame)

print("\nChecking connection status every second for 10 seconds...")
for i in range(1, 11):
    time.sleep(1)
    num_conn = receiver.get_num_connections()
    is_conn = receiver.is_connected()

    print(f"  [{i:2d}s] num_connections={num_conn}, is_connected={is_conn}")

    if num_conn > 0:
        print(f"\n[SUCCESS] Connected! (after {i} seconds)")
        break

if receiver.get_num_connections() == 0:
    print("\n[FAIL] Still num_connections=0 even without Studio Monitor")
    print("\nThis suggests the problem is NOT exclusive access.")
    print("The issue is deeper - possibly:")
    print("  1. The source itself is rejecting all NEW connections")
    print("  2. NDI Groups or Access Manager restrictions")
    print("  3. The source requires authentication")
    print("  4. Python/cyndilib has a fundamental incompatibility")
    finder.close()
    sys.exit(1)

# Try to receive
print("\n[Step 3] Attempting to receive video...")
for i in range(1, 11):
    result = receiver.receive(ReceiveFrameType.recv_video, timeout_ms=1000)

    if result == ReceiveFrameType.recv_video:
        vf = receiver.video_frame
        print(f"\n[SUCCESS] Received video!")
        print(f"  Resolution: {vf.xres}x{vf.yres}")
        print(f"  Format: {vf.fourcc}")
        print(f"  Frame rate: {vf.frame_rate_N}/{vf.frame_rate_D}")

        # Get more frames
        print(f"\nReceiving 5 more frames...")
        for j in range(5):
            result2 = receiver.receive(ReceiveFrameType.recv_video, timeout_ms=1000)
            if result2 == ReceiveFrameType.recv_video:
                print(f"  Frame {j+1}: OK")

        break
    else:
        print(f"  [{i}] Timeout or other", end='\r')

finder.close()

print("\n\n" + "=" * 70)
print("Test completed")
print("=" * 70)
