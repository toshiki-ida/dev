"""
Test connection to local NDI Test Patterns source
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
print("NDI Test Patterns Local Source Test")
print("=" * 70)

from cyndilib.finder import Finder, Source
from cyndilib.receiver import Receiver, ReceiveFrameType
from cyndilib.video_frame import VideoRecvFrame
from cyndilib.audio_frame import AudioRecvFrame
from cyndilib.wrapper.ndi_recv import RecvColorFormat, RecvBandwidth

# Find sources
print("\n[Step 1] Finding all available sources...")
print("Waiting 5 seconds for discovery...")
finder = Finder()
finder.open()
time.sleep(5)

sources = list(finder.iter_sources())
print(f"\nFound {len(sources)} source(s):")

for i, src in enumerate(sources, 1):
    print(f"\n  {i}. {src.name}")
    print(f"     host: {src.host_name}")
    print(f"     stream: {src.stream_name}")
    print(f"     valid: {src.valid}")

if not sources:
    print("\n[ERROR] No sources found!")
    print("\nPlease make sure:")
    print("  1. NDI Test Patterns is running")
    print("  2. It's outputting a pattern (not stopped)")
    print("  3. Wait a few more seconds and try again")
    finder.close()
    sys.exit(1)

# Ask user to select source or auto-select Test Patterns
test_pattern_source = None
remote_connection_source = None

for src in sources:
    if "Test Pattern" in src.stream_name or "Test Patterns" in src.stream_name:
        test_pattern_source = src
        print(f"\n[Found] Test Patterns source: {src.name}")
    elif "Remote Connection" in src.stream_name:
        remote_connection_source = src
        print(f"[Found] Remote Connection source: {src.name}")

# Prioritize Test Patterns
if test_pattern_source:
    selected_source = test_pattern_source
    print(f"\n[Using] Test Patterns source: {selected_source.name}")
elif remote_connection_source:
    selected_source = remote_connection_source
    print(f"\n[Using] Remote Connection source: {selected_source.name}")
else:
    selected_source = sources[0]
    print(f"\n[Using] First available source: {selected_source.name}")

print("\n" + "=" * 70)
print(f"[Step 2] Connecting to: {selected_source.name}")
print("=" * 70)

# Create receiver with source in constructor
receiver = Receiver(
    source=selected_source,
    color_format=RecvColorFormat.BGRX_BGRA,
    bandwidth=RecvBandwidth.highest
)

# Set up frame objects
video_frame = VideoRecvFrame()
audio_frame = AudioRecvFrame()
receiver.set_video_frame(video_frame)
receiver.set_audio_frame(audio_frame)

# Check connection status immediately
print("\nImmediately after creation:")
print(f"  is_connected: {receiver.is_connected()}")
print(f"  num_connections: {receiver.get_num_connections()}")

# Wait and check periodically
print("\nWaiting for connection (checking every second for 10 seconds)...")
for i in range(1, 11):
    time.sleep(1)
    num_conn = receiver.get_num_connections()
    is_conn = receiver.is_connected()
    print(f"  After {i}s: num_connections={num_conn}, is_connected={is_conn}")

    if num_conn > 0:
        print(f"\n[SUCCESS] Connected!")
        break
else:
    print(f"\n[WARNING] num_connections still 0 after 10 seconds")

# Try to receive video
print("\n" + "=" * 70)
print("[Step 3] Attempting to receive video frames")
print("=" * 70)

success_count = 0
for i in range(1, 21):
    result = receiver.receive(ReceiveFrameType.recv_video, timeout_ms=1000)

    if result == ReceiveFrameType.recv_video:
        vf = receiver.video_frame
        print(f"\n[{i:2d}] [SUCCESS] Received video frame!")
        print(f"      Resolution: {vf.xres}x{vf.yres}")
        print(f"      Format: {vf.fourcc}")
        print(f"      Frame rate: {vf.frame_rate_N}/{vf.frame_rate_D}")
        print(f"      Data shape: {vf.data.shape}")
        success_count += 1

        # Get a few more frames to confirm
        print(f"\n      Receiving 5 more frames to confirm...")
        for j in range(5):
            result2 = receiver.receive(ReceiveFrameType.recv_video, timeout_ms=1000)
            if result2 == ReceiveFrameType.recv_video:
                print(f"        Frame {j+1}: OK ({receiver.video_frame.xres}x{receiver.video_frame.yres})")
            else:
                print(f"        Frame {j+1}: No frame")

        break
    elif result == ReceiveFrameType.nothing:
        print(f"  [{i:2d}] Timeout", end='\r')
    elif result == ReceiveFrameType.recv_status_change:
        print(f"\n  [{i:2d}] Status change")
    else:
        print(f"\n  [{i:2d}] Other: {result}")

finder.close()

print("\n\n" + "=" * 70)
print("RESULTS")
print("=" * 70)

if success_count > 0:
    print(f"\n[SUCCESS] Received {success_count} video frame(s)!")
    print("\nNDI reception is working!")
    print("\nThis means:")
    print("  ✓ NDI SDK 6 is working correctly")
    print("  ✓ cyndilib is compatible with your system")
    print("  ✓ Python can receive NDI video")
    print("\nIf Remote Connection 1 doesn't work but Test Patterns does:")
    print("  → The issue is with the Remote Connection source settings")
    print("  → Check vMix connection limits or NDI Studio Monitor exclusivity")
else:
    print(f"\n[FAIL] No video frames received")
    print(f"\nnum_connections: {receiver.get_num_connections()}")
    print(f"is_connected: {receiver.is_connected()}")
    print("\nPossible causes:")
    print("  1. Test Patterns is not actually sending video")
    print("  2. Pattern output is paused/stopped")
    print("  3. Deeper NDI SDK compatibility issue")
    print("\nNext steps:")
    print("  - Check that Test Patterns shows a moving pattern")
    print("  - Verify NDI Studio Monitor can see the video")
    print("  - Try NDI SDK 5 (see INSTALL_NDI5.md)")
