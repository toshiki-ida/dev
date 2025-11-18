"""
Test NDI Source validity to diagnose connection issue
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
print("NDI Source Validity Test")
print("=" * 70)

from cyndilib.finder import Finder, Source

# Find sources
print("\n[Step 1] Finding sources...")
finder = Finder()
finder.open()
print("Waiting 5 seconds for sources...")
time.sleep(5)

sources = list(finder.iter_sources())
print(f"\nFound {len(sources)} source(s):")

for i, src in enumerate(sources, 1):
    print(f"\n  Source {i}:")
    print(f"    name: '{src.name}'")
    print(f"    host_name: '{src.host_name}'")
    print(f"    stream_name: '{src.stream_name}'")
    print(f"    valid: {src.valid}")  # ← これが重要！
    print(f"    ptr: {src.ptr}")

    # Try to update if not valid
    if not src.valid:
        print(f"    [WARNING] Source is NOT valid! Trying to update...")
        src.update()
        time.sleep(1)
        print(f"    After update - valid: {src.valid}")

    # Check internal state
    print(f"    Internal state:")
    try:
        print(f"      - p_ndi_name: {src.ptr.p_ndi_name if src.ptr else 'NULL'}")
        print(f"      - p_url_address: {src.ptr.p_url_address if src.ptr else 'NULL'}")
    except Exception as e:
        print(f"      - Error accessing ptr: {e}")

# Try alternative: wait_for_sources
print("\n" + "=" * 70)
print("[Step 2] Alternative: Using wait_for_sources")
print("=" * 70)

finder2 = Finder()
finder2.open()
print("Calling wait_for_sources(5000)...")
found = finder2.wait_for_sources(5000)
print(f"wait_for_sources returned: {found}")

sources2 = list(finder2.iter_sources())
print(f"\nFound {len(sources2)} source(s):")

for i, src in enumerate(sources2, 1):
    print(f"\n  Source {i}:")
    print(f"    name: '{src.name}'")
    print(f"    valid: {src.valid}")

finder.close()
finder2.close()

print("\n" + "=" * 70)
print("DIAGNOSIS")
print("=" * 70)
print("""
If 'valid' is False:
  → The Source object exists but points to invalid NDI source data
  → This explains why connection fails (line 226-227 in receiver.pyx)
  → Possible causes:
    1. Source data is not properly initialized by Finder
    2. Source became invalid between discovery and connection attempt
    3. cyndilib bug in Source object management

Solution:
  - Try calling src.update() before connecting
  - Or wait longer after calling finder.open()
  - Or use wait_for_sources() instead of sleep()
""")
