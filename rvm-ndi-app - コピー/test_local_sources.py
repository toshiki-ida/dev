"""
Test if cyndilib can detect multiple local NDI sources
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
print("Testing Local NDI Source Detection")
print("=" * 70)
print("\nIMPORTANT: Make sure the following are running:")
print("  1. vMix with NDI output enabled")
print("  2. NDI Test Patterns (just launched)")
print()

from cyndilib import finder
import time

# Create and open finder
print("Creating Finder...")
ndi_finder = finder.Finder()
ndi_finder.open()
print("[OK] Finder opened\n")

# Monitor sources over time
print("Monitoring NDI sources for 15 seconds...")
print("-" * 70)

for i in range(1, 16):
    sources = ndi_finder.get_source_names()

    # Display current sources
    print(f"[{i:2d}s] Found {len(sources)} source(s):", end="")

    if sources:
        print()
        for src in sources:
            # Parse source name
            if '(' in src:
                host = src.split('(')[0].strip()
                stream = src.split('(')[1].rstrip(')')
                is_local = host == os.environ.get('COMPUTERNAME', 'UNKNOWN')
                location = "LOCAL" if is_local else "REMOTE"
                print(f"    [{location:6s}] {src}")
            else:
                print(f"    [UNKNOWN] {src}")
    else:
        print(" (none)")

    time.sleep(1)

print("\n" + "=" * 70)
print("Final Summary")
print("=" * 70)

sources = ndi_finder.get_source_names()
print(f"\nTotal sources found: {len(sources)}")

if sources:
    local_sources = []
    remote_sources = []

    for src in sources:
        if '(' in src:
            host = src.split('(')[0].strip()
            is_local = host == os.environ.get('COMPUTERNAME', 'UNKNOWN')
            if is_local:
                local_sources.append(src)
            else:
                remote_sources.append(src)
        else:
            local_sources.append(src)  # Assume local if format unknown

    if local_sources:
        print(f"\nLocal sources ({len(local_sources)}):")
        for src in local_sources:
            print(f"  - {src}")

    if remote_sources:
        print(f"\nRemote sources ({len(remote_sources)}):")
        for src in remote_sources:
            print(f"  - {src}")

    # Analysis
    print("\n" + "-" * 70)
    print("Analysis:")

    if len(local_sources) >= 2:
        print("[OK] Multiple local sources detected!")
        print("     cyndilib CAN detect multiple sources from the same PC.")
    elif len(local_sources) == 1:
        print("[WARNING] Only 1 local source detected.")
        print("     Possible reasons:")
        print("     - vMix NDI output may not be enabled")
        print("     - NDI Test Patterns may not have started yet")
        print("     - cyndilib may have issues with NDI 6")
    else:
        print("[ERROR] No local sources detected!")
        print("     Only remote sources were found.")

    if len(sources) < 2:
        print("\n[ISSUE] Expected at least 2 sources:")
        print("  1. CG_DEV_001 (Remote Connection 1) - remote")
        print("  2. Local vMix output or Test Patterns")
        print("\nCurrent computer name:", os.environ.get('COMPUTERNAME', 'UNKNOWN'))

else:
    print("\n[ERROR] No sources found at all!")

ndi_finder.close()
print("\n[OK] Test completed")
