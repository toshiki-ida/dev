"""
NDI Detailed Source Discovery Test
Tests NDI discovery with detailed configuration
"""
import os
import sys
import ctypes

# Add NDI Runtime to PATH - prioritize NDI 6 SDK
ndi_runtime_paths = [
    r"C:\Program Files\NDI\NDI 6 SDK\Bin\x64",
    r"C:\Program Files\NDI\NDI 6 Runtime\v6",
]

print("Setting up NDI Runtime PATH...")
for path in ndi_runtime_paths:
    if os.path.exists(path):
        os.environ['PATH'] = path + os.pathsep + os.environ.get('PATH', '')
        print(f"  Added: {path}")

print("\n" + "=" * 70)
print("NDI Detailed Source Discovery Test")
print("=" * 70)

from cyndilib import finder
import time

print("\n[Test 1] Standard Finder with default settings")
print("-" * 70)

ndi_finder = finder.Finder()
print(f"Finder created: {ndi_finder}")
print(f"Initial source count: {ndi_finder.num_sources}")

print("\nOpening finder...")
ndi_finder.open()
print("Finder opened")

# Progressive discovery check
for i in range(1, 11):
    time.sleep(1)
    count = ndi_finder.num_sources
    sources = ndi_finder.get_source_names()
    print(f"[{i}s] Sources: {count} - {sources}")

    if i == 5 and count > 0:
        print("\n  Detailed source information:")
        for src in ndi_finder.iter_sources():
            print(f"    - Name: '{src.name}'")
            print(f"      Host: '{src.host_name}'")
            print(f"      Stream: '{src.stream_name}'")
            print(f"      Valid: {src.valid}")

print("\n[Test 2] Check Finder internals")
print("-" * 70)

print(f"Finder attributes:")
print(f"  - is_open: {ndi_finder.is_open}")
print(f"  - num_sources: {ndi_finder.num_sources}")
print(f"  - finder_thread: {ndi_finder.finder_thread}")
print(f"  - finder_thread_running: {ndi_finder.finder_thread_running}")

print("\n[Test 3] Manual source update")
print("-" * 70)

# Try manual update
print("Calling update_sources()...")
updated_sources = ndi_finder.update_sources()
print(f"Updated sources: {updated_sources}")

print("\n[Test 4] NDI DLL Information")
print("-" * 70)

# Check which NDI DLL is loaded
try:
    import cyndilib.wrapper.ndi_structs as ndi_structs
    print(f"cyndilib wrapper loaded successfully")
except Exception as e:
    print(f"Error loading wrapper: {e}")

# Check NDI library path
ndi_dll_path = r"C:\Program Files\NDI\NDI 6 SDK\Bin\x64\Processing.NDI.Lib.x64.dll"
if os.path.exists(ndi_dll_path):
    print(f"\nNDI DLL exists: {ndi_dll_path}")
    # Get file version
    try:
        size = os.path.getsize(ndi_dll_path)
        print(f"  Size: {size:,} bytes")
    except Exception as e:
        print(f"  Could not get size: {e}")

print("\n[Test 5] Environment check")
print("-" * 70)

# Check for NDI environment variables
ndi_env_vars = [k for k in os.environ.keys() if 'NDI' in k.upper()]
if ndi_env_vars:
    print("NDI-related environment variables:")
    for var in ndi_env_vars:
        print(f"  {var} = {os.environ[var]}")
else:
    print("No NDI-related environment variables found")

print("\n" + "=" * 70)
print("Final source list:")
sources = ndi_finder.get_source_names()
print(f"Total sources found: {len(sources)}")
for i, name in enumerate(sources, 1):
    print(f"  {i}. {name}")

print("\nExpected sources from vMix:")
print("  - CG_DEV_001 (Remote Connection 1)")
print("  - vmix-output1 (or similar local vMix output)")

if len(sources) < 2:
    print("\n[WARNING] Not all expected sources were found!")
    print("Possible reasons:")
    print("  1. vMix NDI output 'vmix-output1' is not enabled")
    print("  2. NDI 6 compatibility issue with cyndilib")
    print("  3. NDI Access Manager restrictions")
    print("  4. Network/discovery configuration issue")

ndi_finder.close()
print("\n[OK] Test completed")
