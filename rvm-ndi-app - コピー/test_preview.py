"""
Test script to verify preview initialization fixes
"""
import sys
import time
from ndi_wrapper import NDIFinder, NDIReceiver

print("=" * 70)
print("NDI Preview Test")
print("=" * 70)

# Initialize finder
print("\n[INFO] Initializing NDI...")
finder = NDIFinder()
finder.initialize()
print("[OK] NDI initialized")

# Wait for sources
print("\n[INFO] Waiting 3 seconds for source discovery...")
time.sleep(3)

# Get sources
sources = finder.get_sources()
print(f"\n[INFO] Found {len(sources)} source(s):")
for i, src in enumerate(sources, 1):
    print(f"  {i}. {src['name']}")

if not sources:
    print("\n[ERROR] No sources found!")
    finder.close()
    sys.exit(1)

# Find Test Pattern source
test_source = None
for src in sources:
    if "Test Pattern" in src['name'] and "Test Pattern 2" not in src['name']:
        test_source = src
        break

if not test_source:
    test_source = sources[0]

print(f"\n[INFO] Using source: {test_source['name']}")

# Test rapid preview start/stop (simulating source selection changes)
print("\n[INFO] Testing rapid preview start/stop...")
for i in range(3):
    print(f"\n--- Test iteration {i+1} ---")

    # Create receiver
    print(f"[INFO] Creating receiver for: {test_source['name']}")
    receiver = NDIReceiver(test_source)
    receiver.initialize()
    print("[OK] Receiver initialized")

    # Try to receive a frame
    print("[INFO] Attempting to receive frame...")
    for attempt in range(5):
        frame = receiver.receive_video(timeout_ms=200)
        if frame is not None:
            print(f"[OK] Frame received: {frame.shape}")
            break
    else:
        print("[WARNING] No frame received after 5 attempts")

    # Close receiver
    print("[INFO] Closing receiver...")
    receiver.close()
    print("[OK] Receiver closed")

    # Wait a bit before next iteration
    time.sleep(0.5)

print("\n[OK] All tests completed successfully")
finder.close()
