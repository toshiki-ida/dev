"""
Test NDI source discovery using direct NDI SDK ctypes calls
This bypasses cyndilib to test if the issue is in cyndilib or NDI SDK itself
"""
import os
import sys
import time
import ctypes
from ctypes import c_char_p, c_bool, c_uint32, POINTER, Structure, c_void_p

# Force NDI 5 Runtime
ndi_dll_path = r"C:\Program Files\NDI\NDI 5 Tools\Runtime\Processing.NDI.Lib.x64.dll"

if not os.path.exists(ndi_dll_path):
    print(f"[ERROR] NDI 5 DLL not found at: {ndi_dll_path}")
    sys.exit(1)

print(f"[INFO] Using NDI 5 DLL: {ndi_dll_path}")

print("=" * 70)
print("NDI Source Discovery - Direct SDK Test")
print("=" * 70)

# Load NDI library
try:
    ndi_lib = ctypes.CDLL(ndi_dll_path)
    print(f"[OK] Loaded {os.path.basename(ndi_dll_path)}")
except Exception as e:
    print(f"[ERROR] Failed to load NDI library: {e}")
    sys.exit(1)

# Define structures
class NDIlib_source_t(Structure):
    _fields_ = [
        ("p_ndi_name", c_char_p),
        ("p_url_address", c_char_p),
    ]

class NDIlib_find_create_t(Structure):
    _fields_ = [
        ("show_local_sources", c_bool),
        ("p_groups", c_char_p),
        ("p_extra_ips", c_char_p),
    ]

# Define function prototypes
NDIlib_initialize = ndi_lib.NDIlib_initialize
NDIlib_initialize.restype = c_bool

NDIlib_find_create_v2 = ndi_lib.NDIlib_find_create_v2
NDIlib_find_create_v2.argtypes = [POINTER(NDIlib_find_create_t)]
NDIlib_find_create_v2.restype = c_void_p

NDIlib_find_get_current_sources = ndi_lib.NDIlib_find_get_current_sources
NDIlib_find_get_current_sources.argtypes = [c_void_p, POINTER(c_uint32)]
NDIlib_find_get_current_sources.restype = POINTER(NDIlib_source_t)

NDIlib_find_destroy = ndi_lib.NDIlib_find_destroy
NDIlib_find_destroy.argtypes = [c_void_p]

# Initialize NDI
print("\n[Step 1] Initializing NDI...")
if not NDIlib_initialize():
    print("[ERROR] NDI initialization failed!")
    sys.exit(1)
print("[OK] NDI initialized")

# Create finder with show_local_sources=True
print("\n[Step 2] Creating Finder (show_local_sources=True)...")
find_settings = NDIlib_find_create_t(
    show_local_sources=True,
    p_groups=None,
    p_extra_ips=None
)

finder = NDIlib_find_create_v2(ctypes.byref(find_settings))
if not finder:
    print("[ERROR] Failed to create Finder!")
    sys.exit(1)
print("[OK] Finder created")

# Wait for sources to appear
print("\n[Step 3] Waiting for sources (checking every 2 seconds for 20 seconds)...")

all_sources = {}

for i in range(1, 11):
    print(f"\n[Check {i}/10]")
    time.sleep(2)

    num_sources = c_uint32(0)
    sources_ptr = NDIlib_find_get_current_sources(finder, ctypes.byref(num_sources))

    print(f"  Found {num_sources.value} source(s):")

    if num_sources.value > 0:
        for j in range(num_sources.value):
            src = sources_ptr[j]
            name = src.p_ndi_name.decode('utf-8') if src.p_ndi_name else "Unknown"
            url = src.p_url_address.decode('utf-8') if src.p_url_address else "Unknown"

            print(f"    {j+1}. {name}")
            print(f"       URL: {url}")

            if name not in all_sources:
                all_sources[name] = url

# Cleanup
NDIlib_find_destroy(finder)

print("\n" + "=" * 70)
print("FINAL RESULTS")
print("=" * 70)

print(f"\nTotal unique sources found: {len(all_sources)}")
for i, (name, url) in enumerate(all_sources.items(), 1):
    print(f"  {i}. {name}")
    print(f"     URL: {url}")

print("\n" + "=" * 70)
print("Expected Sources (visible in NDI Studio Monitor):")
print("=" * 70)
print("  1. CG_DEV_001 (Remote Connection 1)")
print("  2. CG_DEV_001 (Test Pattern) or (Test Patterns v1)")
print("  3. CG_DEV_001 (vMix - Output 1)")

print("\n" + "=" * 70)
print("Analysis:")
print("=" * 70)

expected_keywords = ["Remote Connection", "Test Pattern", "vMix"]
for keyword in expected_keywords:
    found = any(keyword.lower() in name.lower() for name in all_sources.keys())
    status = "[OK]" if found else "[MISSING]"
    print(f"{status} {keyword}")

if len(all_sources) >= 3:
    print("\n[SUCCESS] All sources detected via direct SDK!")
    print("This means the issue is in cyndilib, not the NDI SDK itself.")
elif len(all_sources) == 1:
    print("\n[ISSUE] Same problem - only 1 source detected")
    print("This means the issue is NOT in cyndilib, but in:")
    print("  1. NDI Groups configuration")
    print("  2. NDI Access Manager restrictions")
    print("  3. Test Patterns/vMix not actually broadcasting")
    print("  4. Firewall/network configuration")
else:
    print(f"\n[PARTIAL] Detected {len(all_sources)} sources (expected 3)")
    print("Some sources are missing. Need to investigate further.")
