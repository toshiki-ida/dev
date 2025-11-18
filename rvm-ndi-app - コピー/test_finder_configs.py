"""
Test NDI Finder with different configuration options
This tests if Finder parameters affect source detection
"""
import os
import sys
import time

# Force NDI 5 Runtime - put it FIRST in PATH
ndi5_runtime = r"C:\Program Files\NDI\NDI 5 Tools\Runtime"
ndi6_sdk = r"C:\Program Files\NDI\NDI 6 SDK\Bin\x64"
ndi6_runtime = r"C:\Program Files\NDI\NDI 6 Runtime\v6"

# Try NDI 5 first
if os.path.exists(ndi5_runtime):
    os.environ['PATH'] = ndi5_runtime + os.pathsep + os.environ.get('PATH', '')
    print(f"[INFO] Using NDI 5 Runtime: {ndi5_runtime}")
elif os.path.exists(ndi6_runtime):
    os.environ['PATH'] = ndi6_runtime + os.pathsep + os.environ.get('PATH', '')
    print(f"[INFO] Using NDI 6 Runtime: {ndi6_runtime}")
elif os.path.exists(ndi6_sdk):
    os.environ['PATH'] = ndi6_sdk + os.pathsep + os.environ.get('PATH', '')
    print(f"[INFO] Using NDI 6 SDK: {ndi6_sdk}")
else:
    print("[ERROR] No NDI Runtime found!")
    sys.exit(1)

print("=" * 70)
print("NDI Finder Configuration Tests")
print("=" * 70)

from cyndilib.finder import Finder

# Get local IP for extra_ips parameter
import socket
hostname = socket.gethostname()
local_ip = socket.gethostbyname(hostname)
print(f"\nLocal hostname: {hostname}")
print(f"Local IP: {local_ip}")

# Test configurations
test_configs = [
    {
        "name": "Test 1: Default configuration",
        "params": {}
    },
    {
        "name": "Test 2: Show local sources explicitly",
        "params": {"show_local_sources": True}
    },
    {
        "name": "Test 3: With local IP in extra_ips",
        "params": {"extra_ips": [local_ip]}
    },
    {
        "name": "Test 4: With localhost in extra_ips",
        "params": {"extra_ips": ["127.0.0.1"]}
    },
    {
        "name": "Test 5: With both local and localhost IPs",
        "params": {"extra_ips": [local_ip, "127.0.0.1"]}
    },
    {
        "name": "Test 6: Empty groups list",
        "params": {"groups": []}
    },
    {
        "name": "Test 7: Show local + extra IPs + empty groups",
        "params": {
            "show_local_sources": True,
            "extra_ips": [local_ip, "127.0.0.1"],
            "groups": []
        }
    },
]

all_found_sources = {}

for config in test_configs:
    print("\n" + "=" * 70)
    print(config["name"])
    print("=" * 70)
    print(f"Parameters: {config['params']}")

    try:
        # Create Finder with specified parameters
        finder = Finder(**config["params"])
        finder.open()

        print("Waiting 8 seconds for source discovery...")
        time.sleep(8)

        sources = list(finder.iter_sources())
        print(f"\nFound {len(sources)} source(s):")

        for i, src in enumerate(sources, 1):
            print(f"  {i}. {src.name}")
            print(f"      host: {src.host_name}")
            print(f"      stream: {src.stream_name}")
            print(f"      valid: {src.valid}")

            # Track all unique sources
            all_found_sources[src.name] = {
                "host": src.host_name,
                "stream": src.stream_name,
                "found_in": config["name"]
            }

        finder.close()

    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()

# Summary
print("\n" + "=" * 70)
print("SUMMARY: All Unique Sources Found Across All Tests")
print("=" * 70)

if all_found_sources:
    for i, (name, info) in enumerate(all_found_sources.items(), 1):
        print(f"\n{i}. {name}")
        print(f"   Host: {info['host']}")
        print(f"   Stream: {info['stream']}")
        print(f"   First found in: {info['found_in']}")
else:
    print("\n[ERROR] No sources found in ANY configuration!")

print("\n" + "=" * 70)
print("Expected Sources (visible in NDI Studio Monitor):")
print("=" * 70)
print("  1. CG_DEV_001 (Remote Connection 1)")
print("  2. CG_DEV_001 (Test Pattern) or (Test Patterns v1)")
print("  3. CG_DEV_001 (vMix - Output 1)")

print("\n" + "=" * 70)
print("Analysis:")
print("=" * 70)

expected_sources = ["Remote Connection 1", "Test Pattern", "vMix"]
found_names = list(all_found_sources.keys())

for expected in expected_sources:
    found = any(expected.lower() in name.lower() for name in found_names)
    status = "[OK]" if found else "[MISSING]"
    print(f"{status} {expected}")

if len(all_found_sources) < 3:
    print("\n[ISSUE] Not all sources were detected!")
    print("\nPossible causes:")
    print("  1. cyndilib Finder has limitations/bugs with certain source types")
    print("  2. NDI Groups or Access Manager configuration")
    print("  3. Sources are not broadcasting on the same subnet")
    print("  4. Local sources require different discovery mechanism")
    print("\nNext step: Test direct connection by exact source name")
else:
    print("\n[SUCCESS] All expected sources detected!")
