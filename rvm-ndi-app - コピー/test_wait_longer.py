"""
Wait longer for NDI Test Patterns to appear
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
print("NDI Source Discovery - Extended Wait")
print("=" * 70)

from cyndilib.finder import Finder

finder = Finder()
finder.open()

print("\nWaiting for sources to appear...")
print("(Will check every 3 seconds for 30 seconds)")
print("\nPlease ensure:")
print("  1. NDI Test Patterns application is running")
print("  2. A pattern is being displayed (not paused)")
print("  3. The window is not minimized")
print()

for i in range(1, 11):
    print(f"[Check {i}/10] Waiting 3 seconds...")
    time.sleep(3)

    sources = list(finder.iter_sources())
    print(f"  Found {len(sources)} source(s):")

    for src in sources:
        print(f"    - {src.name}")
        if "Test Pattern" in src.name or "Test Patterns" in src.name:
            print(f"\n[SUCCESS] Found Test Patterns source!")
            print(f"Name: {src.name}")
            print(f"Host: {src.host_name}")
            print(f"Stream: {src.stream_name}")
            finder.close()
            sys.exit(0)

    print()

print("\n" + "=" * 70)
print("Test Patterns source NOT found after 30 seconds")
print("=" * 70)
print("\nTroubleshooting:")
print("  1. Is NDI Test Patterns actually running?")
print("  2. Check if the pattern is playing (not paused)")
print("  3. Try closing and reopening Test Patterns")
print("  4. Check Windows Task Manager if Test Patterns.exe is running")
print("\nCurrent sources:")

sources = list(finder.iter_sources())
for src in sources:
    print(f"  - {src.name}")

finder.close()
