"""
GPU and PyTorch Test Script
Tests if PyTorch can detect and use the GPU
"""

import sys

print("=" * 50)
print("GPU and PyTorch Test")
print("=" * 50)

# Test 1: Import PyTorch
print("\n[1/4] Testing PyTorch import...")
try:
    import torch
    print(f"[OK] PyTorch imported successfully")
    print(f"  Version: {torch.__version__}")
except ImportError as e:
    print(f"[FAIL] Failed to import PyTorch: {e}")
    sys.exit(1)

# Test 2: Check CUDA availability
print("\n[2/4] Checking CUDA availability...")
cuda_available = torch.cuda.is_available()
if cuda_available:
    print(f"[OK] CUDA is available")
    print(f"  CUDA Version: {torch.version.cuda}")
else:
    print(f"[FAIL] CUDA is NOT available")
    print(f"  PyTorch is using CPU only")
    print(f"\nTo install GPU version:")
    print(f"  pip uninstall torch torchvision torchaudio")
    print(f"  pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124")

# Test 3: Check GPU devices
print("\n[3/4] Checking GPU devices...")
if cuda_available:
    device_count = torch.cuda.device_count()
    print(f"[OK] Found {device_count} GPU device(s):")
    for i in range(device_count):
        gpu_name = torch.cuda.get_device_name(i)
        gpu_memory = torch.cuda.get_device_properties(i).total_memory / (1024**3)
        print(f"  GPU {i}: {gpu_name}")
        print(f"    Memory: {gpu_memory:.2f} GB")
else:
    print(f"  No GPU devices found")

# Test 4: Test GPU computation
print("\n[4/4] Testing GPU computation...")
if cuda_available:
    try:
        # Create a small tensor on GPU
        device = torch.device("cuda:0")
        x = torch.randn(1000, 1000, device=device)
        y = torch.randn(1000, 1000, device=device)
        z = torch.matmul(x, y)
        print(f"[OK] GPU computation successful")
        print(f"  Device: {z.device}")
        print(f"  Tensor shape: {z.shape}")
    except Exception as e:
        print(f"[FAIL] GPU computation failed: {e}")
        sys.exit(1)
else:
    print(f"  Skipping (CUDA not available)")

print("\n" + "=" * 50)
if cuda_available:
    print("All tests passed! GPU is ready for use.")
    print(f"Recommended device: cuda:0 ({torch.cuda.get_device_name(0)})")
else:
    print("Tests completed, but GPU is not available.")
    print("Application will run on CPU (slower).")
print("=" * 50)
