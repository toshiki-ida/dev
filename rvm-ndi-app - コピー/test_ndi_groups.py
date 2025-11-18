"""
Test NDI with different group settings to bypass Access Manager restrictions
"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from ndi_ctypes import *
import time

print("=" * 70)
print("NDI Groups Test")
print("=" * 70)

# Test 1: Try with no groups filter (default)
print("\n[Test 1] Default finder (no groups specified)...")
finder1 = NDIFinder(show_local_sources=True)
finder1.wait_for_sources(3000)
sources1 = finder1.get_sources()
print(f"Found {len(sources1)} source(s)")
for src in sources1:
    print(f"  - {src['name']}")
finder1.close()

# Test 2: Try with empty string groups
print("\n[Test 2] Finder with empty groups string...")
finder2 = NDIFinder(show_local_sources=True, groups="")
finder2.wait_for_sources(3000)
sources2 = finder2.get_sources()
print(f"Found {len(sources2)} source(s)")
for src in sources2:
    print(f"  - {src['name']}")
finder2.close()

# Test 3: Try with "public" group
print("\n[Test 3] Finder with 'public' group...")
try:
    finder3 = NDIFinder(show_local_sources=True, groups="public")
    finder3.wait_for_sources(3000)
    sources3 = finder3.get_sources()
    print(f"Found {len(sources3)} source(s)")
    for src in sources3:
        print(f"  - {src['name']}")
    finder3.close()
except Exception as e:
    print(f"Error: {e}")

# Test 4: Try connecting with explicit connection
if sources1:
    print(f"\n[Test 4] Attempting connection to: {sources1[0]['name']}")
    print("Creating receiver...")

    try:
        receiver = NDIReceiver(
            sources1[0]['source_struct'],
            color_format=NDIlib_recv_color_format_e.NDIlib_recv_color_format_BGRX_BGRA,
            bandwidth=NDIlib_recv_bandwidth_e.NDIlib_recv_bandwidth_highest,
            recv_name="Python NDI Receiver Test"
        )

        print("Receiver created successfully")

        # Check connection every second for 5 seconds
        for i in range(1, 6):
            time.sleep(1)
            num_conn = receiver.get_num_connections()
            print(f"  After {i}s: {num_conn} connection(s)")

            if num_conn > 0:
                print(f"\n[SUCCESS] Connected! Trying to receive frame...")
                result = receiver.receive_video(timeout_ms=2000)
                if result:
                    print(f"[SUCCESS] Received frame: {result['width']}x{result['height']}")
                else:
                    print("[FAIL] No frame received despite connection")
                break
        else:
            print("\n[FAIL] Could not establish connection after 5 seconds")

        receiver.close()

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

cleanup()

print("\n" + "=" * 70)
print("DIAGNOSIS:")
print("=" * 70)
print("""
If num_connections remains 0:
  → This is likely an NDI Access Manager or firewall restriction
  → The NDI source is rejecting connections from Python
  → Check NDI Access Manager settings

Possible solutions:
  1. Open NDI Access Manager and add Python to allowed applications
  2. Set NDI sources to "Public" group
  3. Check Windows Firewall settings for python.exe
  4. Restart NDI sources (vMix, Test Patterns, etc.)
""")
print("=" * 70)
