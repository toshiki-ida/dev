"""
NDI Source Connection Test
Tests the complete flow: find sources -> connect to source
"""
import os
import sys

# Add NDI Runtime to PATH
ndi_runtime_paths = [
    r"C:\Program Files\NDI\NDI 6 Runtime\v6",
    r"C:\Program Files\NDI\NDI 5 Runtime\v5",
    r"C:\Program Files\NDI\NDI 6 SDK\Bin\x64",
]

for path in ndi_runtime_paths:
    if os.path.exists(path):
        os.environ['PATH'] = path + os.pathsep + os.environ.get('PATH', '')

print("=" * 60)
print("NDI Source Connection Test")
print("=" * 60)

from cyndilib import finder, receiver
from cyndilib.wrapper.ndi_recv import RecvColorFormat, RecvBandwidth
import time

# Step 1: Create and open finder
print("\n[1/5] Creating and opening Finder...")
ndi_finder = finder.Finder()
ndi_finder.open()
print("[OK] Finder opened")

# Step 2: Wait for sources
print("\n[2/5] Waiting for sources...")
time.sleep(3)
print(f"[OK] Found {ndi_finder.num_sources} source(s)")

# Step 3: Get source names
print("\n[3/5] Getting source names...")
source_names = ndi_finder.get_source_names()
if not source_names:
    print("[FAIL] No sources found")
    ndi_finder.close()
    sys.exit(1)

print(f"[OK] Source names retrieved:")
for i, name in enumerate(source_names, 1):
    print(f"  {i}. '{name}'")
    print(f"     Length: {len(name)} characters")
    print(f"     Repr: {repr(name)}")

# Step 4: Get Source object
print("\n[4/5] Getting Source object...")
source_name = source_names[0]
print(f"Attempting to get source: '{source_name}'")

source_obj = ndi_finder.get_source(source_name)
if source_obj is None:
    print(f"[FAIL] get_source() returned None for: '{source_name}'")

    # Try alternative: iterate sources
    print("\nTrying alternative: iter_sources()...")
    for s in ndi_finder.iter_sources():
        print(f"  Source: '{s.name}'")
        print(f"  Valid: {s.valid}")
        if s.name == source_name:
            source_obj = s
            print(f"  [OK] Found matching source!")
            break
else:
    print(f"[OK] Source object retrieved")
    print(f"  Name: '{source_obj.name}'")
    print(f"  Valid: {source_obj.valid}")

if source_obj is None:
    print("[FAIL] Could not get Source object")
    ndi_finder.close()
    sys.exit(1)

# Step 5: Create receiver
print("\n[5/5] Creating Receiver...")
try:
    recv = receiver.Receiver(
        source=source_obj,  # Use keyword argument 'source='
        color_format=RecvColorFormat.BGRX_BGRA,
        bandwidth=RecvBandwidth.highest
    )
    print("[OK] Receiver created successfully!")
    print(f"  Connected to: '{source_obj.name}'")

    # Try reading a frame
    print("\nBonus: Attempting to read a frame...")
    result = recv.receive(receiver.ReceiveFrameType.recv_video, timeout_ms=5000)
    if result == receiver.ReceiveFrameType.recv_video:
        video_frame = recv.video_frame
        print(f"[OK] Frame received!")
        print(f"  Resolution: {video_frame.xres}x{video_frame.yres}")
        print(f"  Format: {video_frame.fourcc}")
        print(f"  Data shape: {video_frame.data.shape}")
    else:
        print(f"[WARN] No frame received (result: {result})")

    # Receiver cleanup is automatic (no destroy method)

except Exception as e:
    print(f"[FAIL] Failed to create receiver: {e}")
    import traceback
    traceback.print_exc()
    ndi_finder.close()
    sys.exit(1)

# Cleanup
print("\n" + "=" * 60)
ndi_finder.close()
print("Test completed successfully!")
print("=" * 60)
