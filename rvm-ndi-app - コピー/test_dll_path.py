"""
Test which DLL cyndilib is actually loading
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
print("NDI DLL Path Test")
print("=" * 70)

print("\nStep 1: Check PATH variable")
print("-" * 70)
path_entries = os.environ.get('PATH', '').split(os.pathsep)
ndi_paths = [p for p in path_entries if 'NDI' in p.upper()]
for i, path in enumerate(ndi_paths, 1):
    print(f"  {i}. {path}")

print("\nStep 2: Import cyndilib and check loaded DLLs")
print("-" * 70)

# Import cyndilib
import cyndilib
from cyndilib import finder

print("cyndilib imported successfully")

# Check loaded modules
import ctypes.util
dll_name = ctypes.util.find_library("Processing.NDI.Lib.x64")
print(f"\nfind_library result: {dll_name}")

# Try to find which DLL was actually loaded
import psutil
proc = psutil.Process()
dlls = [dll.path for dll in proc.memory_maps() if 'Processing.NDI.Lib' in dll.path]
print(f"\nLoaded NDI DLLs:")
for dll in dlls:
    print(f"  - {dll}")

print("\nStep 3: Check cyndilib bundled DLL location")
print("-" * 70)
import importlib.resources
dll_dir = importlib.resources.files('cyndilib') / 'wrapper' / 'bin'
print(f"cyndilib bin directory: {dll_dir}")

bundled_dll = os.path.join(str(dll_dir), "Processing.NDI.Lib.x64.dll")
if os.path.exists(bundled_dll):
    print(f"Bundled DLL exists: {bundled_dll}")
    import subprocess
    result = subprocess.run(
        ['powershell', f"(Get-Item '{bundled_dll}').VersionInfo.FileVersion"],
        capture_output=True, text=True
    )
    print(f"Bundled DLL version: {result.stdout.strip()}")
else:
    print(f"Bundled DLL not found at: {bundled_dll}")

print("\n" + "=" * 70)
print("Test completed")
print("=" * 70)
