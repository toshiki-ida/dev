"""
NDI SDK Test Script
Tests if NDI SDK is properly installed and working with cyndilib
"""

import sys

print("=" * 50)
print("NDI SDK Test")
print("=" * 50)

# Test 1: Import cyndilib
print("\n[1/3] Testing cyndilib import...")
try:
    import cyndilib
    print("[OK] cyndilib imported successfully")
except ImportError as e:
    print(f"[FAIL] Failed to import cyndilib: {e}")
    sys.exit(1)

# Test 2: Import cyndilib modules
print("\n[2/3] Testing cyndilib modules...")
try:
    from cyndilib import finder, receiver, sender
    print("[OK] cyndilib.finder imported")
    print("[OK] cyndilib.receiver imported")
    print("[OK] cyndilib.sender imported")
except ImportError as e:
    print(f"[FAIL] Failed to import cyndilib modules: {e}")
    sys.exit(1)

# Test 3: Initialize NDI Finder
print("\n[3/3] Testing NDI SDK initialization...")
try:
    ndi_finder = finder.Finder()
    print("[OK] NDI Finder initialized successfully")
    print("[OK] NDI SDK is working!")

    # Try to find sources
    import time
    print("\n[Bonus] Searching for NDI sources...")
    time.sleep(1.5)  # Give time for sources to be discovered
    sources = ndi_finder.get_sources()

    if sources:
        print(f"[OK] Found {len(sources)} NDI source(s):")
        for i, source in enumerate(sources, 1):
            source_name = source.ndi_name.decode() if isinstance(source.ndi_name, bytes) else source.ndi_name
            print(f"  {i}. {source_name}")
    else:
        print("  No NDI sources found (this is OK if no sources are running)")

    ndi_finder.destroy()

except Exception as e:
    print(f"[FAIL] Failed to initialize NDI: {e}")
    print("\nTroubleshooting:")
    print("1. Make sure NDI SDK is installed from https://ndi.video/for-developers/ndi-sdk/")
    print("2. Check if NDI runtime DLLs are in PATH")
    print("3. Try restarting your terminal/IDE")
    sys.exit(1)

print("\n" + "=" * 50)
print("All tests passed! NDI SDK is ready to use.")
print("=" * 50)
