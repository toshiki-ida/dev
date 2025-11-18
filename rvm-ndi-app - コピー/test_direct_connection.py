"""
Test direct connection to NDI sources by name
This bypasses the Finder discovery issue
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
print("NDI Direct Connection Test")
print("=" * 70)

from cyndilib import finder, receiver
from cyndilib.wrapper.ndi_recv import RecvColorFormat, RecvBandwidth
import time

# Step 1: Check what Finder sees
print("\n[Step 1] What does Finder see?")
print("-" * 70)

ndi_finder = finder.Finder()
ndi_finder.open()
print("Waiting 5 seconds for discovery...")
time.sleep(5)

finder_sources = ndi_finder.get_source_names()
print(f"\nFinder found {len(finder_sources)} source(s):")
for i, name in enumerate(finder_sources, 1):
    print(f"  {i}. '{name}'")

# Step 2: Try known source names directly
print("\n[Step 2] Trying direct connection to known sources")
print("-" * 70)

# Common NDI source name patterns to try
test_sources = [
    "CG_DEV_001 (Remote Connection 1)",  # Known to exist
    "CG_DEV_001 (Test Patterns v1)",     # NDI Test Patterns default name
    "CG_DEV_001 (NDI Test Patterns)",    # Alternative Test Patterns name
    os.environ.get('COMPUTERNAME', 'UNKNOWN') + " (Test Patterns v1)",
    "TEST PATTERN",
]

# Add vMix common output names
vmix_patterns = [
    "CG_DEV_001 (Output 1)",
    "CG_DEV_001 (Output 2)",
    "CG_DEV_001 (Output 3)",
    "CG_DEV_001 (Output 4)",
]
test_sources.extend(vmix_patterns)

print(f"\nAttempting to connect to {len(test_sources)} potential sources:")
print()

successful_connections = []

for source_name in test_sources:
    print(f"Testing: '{source_name}'...")

    try:
        # Try direct connection by source name
        recv = receiver.Receiver(
            source_name=source_name,
            color_format=RecvColorFormat.BGRX_BGRA,
            bandwidth=RecvBandwidth.highest
        )

        print(f"  [OK] Receiver created")

        # Try to receive a frame to confirm it's actually working
        result = recv.receive(receiver.ReceiveFrameType.recv_video, timeout_ms=2000)

        if result == receiver.ReceiveFrameType.recv_video:
            video_frame = recv.video_frame
            print(f"  [SUCCESS] Got video frame!")
            print(f"    Resolution: {video_frame.xres}x{video_frame.yres}")
            successful_connections.append(source_name)
        else:
            print(f"  [PARTIAL] Receiver created but no video (timeout)")

    except Exception as e:
        print(f"  [FAIL] {type(e).__name__}: {str(e)[:50]}")

    print()

# Step 3: Summary
print("=" * 70)
print("Summary")
print("=" * 70)

print(f"\nFinder detected sources: {len(finder_sources)}")
for name in finder_sources:
    print(f"  - {name}")

print(f"\nDirect connection successful: {len(successful_connections)}")
for name in successful_connections:
    print(f"  - {name}")

if len(successful_connections) > len(finder_sources):
    print("\n[IMPORTANT] Direct connection found MORE sources than Finder!")
    print("This confirms cyndilib Finder has issues with NDI 6.")
    print("\nSources that work but Finder doesn't detect:")
    for name in successful_connections:
        if name not in finder_sources:
            print(f"  - {name}")

ndi_finder.close()
print("\n[OK] Test completed")
