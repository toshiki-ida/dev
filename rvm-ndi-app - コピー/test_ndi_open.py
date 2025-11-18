"""
NDI SDK Test with proper Finder.open() usage
"""
import os
import sys

# Add NDI Runtime to PATH
ndi_runtime_paths = [
    r"C:\Program Files\NDI\NDI 6 Runtime\v6",
    r"C:\Program Files\NDI\NDI 5 Runtime\v5",
    r"C:\Program Files\NDI\NDI 6 SDK\Bin\x64",
]

print("Adding NDI Runtime to PATH...")
for path in ndi_runtime_paths:
    if os.path.exists(path):
        os.environ['PATH'] = path + os.pathsep + os.environ.get('PATH', '')
        print(f"  Added: {path}")

print("\n" + "=" * 50)
print("NDI SDK Test (with Finder.open() fix)")
print("=" * 50)

# Test 1: Import cyndilib
print("\n[1/5] Testing cyndilib import...")
try:
    from cyndilib import finder, receiver, sender
    print("[OK] cyndilib modules imported")
except ImportError as e:
    print(f"[FAIL] Failed to import: {e}")
    sys.exit(1)

# Test 2: Create Finder
print("\n[2/5] Creating NDI Finder...")
try:
    ndi_finder = finder.Finder()
    print("[OK] NDI Finder created")
except Exception as e:
    print(f"[FAIL] Failed to create finder: {e}")
    sys.exit(1)

# Test 3: Open Finder (start discovery thread)
print("\n[3/5] Opening Finder (starting discovery thread)...")
try:
    ndi_finder.open()
    print("[OK] Finder opened successfully")
    print("  Discovery thread is now running")
except Exception as e:
    print(f"[FAIL] Failed to open finder: {e}")
    sys.exit(1)

# Test 4: Wait and search for sources
print("\n[4/5] Searching for NDI sources...")
import time
print("  Waiting 3 seconds for source discovery...")
time.sleep(3)

print(f"  Source count: {ndi_finder.num_sources}")

# Test 5: List sources
print("\n[5/5] Listing discovered sources...")
try:
    source_names = ndi_finder.get_source_names()

    if source_names:
        print(f"[OK] Found {len(source_names)} NDI source(s):")
        for i, name in enumerate(source_names, 1):
            print(f"  {i}. {name}")
    else:
        print("[WARN] No NDI sources found")
        print("\nPossible reasons:")
        print("1. No NDI applications are sending on the network")
        print("2. Firewall is blocking NDI (UDP port 5353, TCP ports 5960-5969)")
        print("3. NDI sending application is on a different network")
        print("\nTo test:")
        print("- Start 'NDI Test Patterns' from NDI Tools")
        print("- Or start vMix with an active output")
        print("- Or start OBS Studio with obs-ndi plugin enabled")

except Exception as e:
    print(f"[FAIL] Error listing sources: {e}")
    import traceback
    traceback.print_exc()
finally:
    print("\nClosing finder...")
    ndi_finder.close()

print("\n" + "=" * 50)
print("Test completed")
print("=" * 50)
