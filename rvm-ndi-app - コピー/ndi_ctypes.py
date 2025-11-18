"""
Direct NDI SDK C API wrapper using ctypes
This bypasses all Python wrapper issues and uses the NDI SDK directly.
"""
import os
import sys
import ctypes
from ctypes import *
from enum import IntEnum
import numpy as np

# Find NDI DLL
def find_ndi_dll():
    """Find the NDI SDK DLL"""
    possible_paths = [
        r"C:\Program Files\NDI\NDI 6 Runtime\v6\Processing.NDI.Lib.x64.dll",
        r"C:\Program Files\NDI\NDI 6 SDK\Bin\x64\Processing.NDI.Lib.x64.dll",
        r"C:\Program Files\NDI\NDI 5 Runtime\v5\Processing.NDI.Lib.x64.dll",
    ]

    for path in possible_paths:
        if os.path.exists(path):
            return path

    raise FileNotFoundError("NDI SDK DLL not found. Please install NDI Runtime or SDK.")

# Load NDI library
ndi_lib_path = find_ndi_dll()
print(f"Loading NDI DLL: {ndi_lib_path}")
ndilib = ctypes.CDLL(ndi_lib_path)

# NDI Enums
class NDIlib_frame_type_e(IntEnum):
    NDIlib_frame_type_none = 0
    NDIlib_frame_type_video = 1
    NDIlib_frame_type_audio = 2
    NDIlib_frame_type_metadata = 3
    NDIlib_frame_type_error = 4
    NDIlib_frame_type_status_change = 100

class NDIlib_recv_bandwidth_e(IntEnum):
    NDIlib_recv_bandwidth_metadata_only = -10
    NDIlib_recv_bandwidth_audio_only = 10
    NDIlib_recv_bandwidth_lowest = 0
    NDIlib_recv_bandwidth_highest = 100

class NDIlib_recv_color_format_e(IntEnum):
    NDIlib_recv_color_format_BGRX_BGRA = 0
    NDIlib_recv_color_format_UYVY_BGRA = 1
    NDIlib_recv_color_format_RGBX_RGBA = 2
    NDIlib_recv_color_format_UYVY_RGBA = 3

class NDIlib_FourCC_video_type_e(IntEnum):
    NDIlib_FourCC_type_UYVY = 0x59565955  # 'UYVY'
    NDIlib_FourCC_type_BGRA = 0x41524742  # 'BGRA'
    NDIlib_FourCC_type_BGRX = 0x58524742  # 'BGRX'
    NDIlib_FourCC_type_RGBA = 0x41424752  # 'RGBA'
    NDIlib_FourCC_type_RGBX = 0x58424752  # 'RGBX'

# NDI Structures
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

class NDIlib_recv_create_v3_t(Structure):
    _fields_ = [
        ("source_to_connect_to", NDIlib_source_t),
        ("color_format", c_int),  # NDIlib_recv_color_format_e
        ("bandwidth", c_int),      # NDIlib_recv_bandwidth_e
        ("allow_video_fields", c_bool),
        ("p_ndi_recv_name", c_char_p),
    ]

class NDIlib_video_frame_v2_t(Structure):
    _fields_ = [
        ("xres", c_int),
        ("yres", c_int),
        ("FourCC", c_int),  # NDIlib_FourCC_video_type_e
        ("frame_rate_N", c_int),
        ("frame_rate_D", c_int),
        ("picture_aspect_ratio", c_float),
        ("frame_format_type", c_int),
        ("timecode", c_int64),
        ("p_data", POINTER(c_uint8)),
        ("line_stride_in_bytes", c_int),
        ("p_metadata", c_char_p),
        ("timestamp", c_int64),
    ]

class NDIlib_tally_t(Structure):
    _fields_ = [
        ("on_program", c_bool),
        ("on_preview", c_bool),
    ]

# NDI Function signatures
ndilib.NDIlib_initialize.restype = c_bool
ndilib.NDIlib_initialize.argtypes = []

ndilib.NDIlib_destroy.restype = None
ndilib.NDIlib_destroy.argtypes = []

ndilib.NDIlib_find_create_v2.restype = c_void_p
ndilib.NDIlib_find_create_v2.argtypes = [POINTER(NDIlib_find_create_t)]

ndilib.NDIlib_find_destroy.restype = None
ndilib.NDIlib_find_destroy.argtypes = [c_void_p]

ndilib.NDIlib_find_wait_for_sources.restype = c_bool
ndilib.NDIlib_find_wait_for_sources.argtypes = [c_void_p, c_uint32]

ndilib.NDIlib_find_get_current_sources.restype = POINTER(NDIlib_source_t)
ndilib.NDIlib_find_get_current_sources.argtypes = [c_void_p, POINTER(c_uint32)]

ndilib.NDIlib_recv_create_v3.restype = c_void_p
ndilib.NDIlib_recv_create_v3.argtypes = [POINTER(NDIlib_recv_create_v3_t)]

ndilib.NDIlib_recv_destroy.restype = None
ndilib.NDIlib_recv_destroy.argtypes = [c_void_p]

ndilib.NDIlib_recv_connect.restype = None
ndilib.NDIlib_recv_connect.argtypes = [c_void_p, POINTER(NDIlib_source_t)]

ndilib.NDIlib_recv_capture_v3.restype = c_int  # NDIlib_frame_type_e
ndilib.NDIlib_recv_capture_v3.argtypes = [
    c_void_p,
    POINTER(NDIlib_video_frame_v2_t),
    c_void_p,  # audio frame (we'll use NULL)
    c_void_p,  # metadata frame (we'll use NULL)
    c_uint32,  # timeout_ms
]

ndilib.NDIlib_recv_free_video_v2.restype = None
ndilib.NDIlib_recv_free_video_v2.argtypes = [c_void_p, POINTER(NDIlib_video_frame_v2_t)]

ndilib.NDIlib_recv_get_no_connections.restype = c_int
ndilib.NDIlib_recv_get_no_connections.argtypes = [c_void_p]

# High-level Python wrappers
class NDIFinder:
    def __init__(self, show_local_sources=True, groups=None, extra_ips=None):
        """Initialize NDI Finder"""
        if not ndilib.NDIlib_initialize():
            raise RuntimeError("Failed to initialize NDI library")

        find_create = NDIlib_find_create_t()
        find_create.show_local_sources = show_local_sources
        find_create.p_groups = groups.encode('utf-8') if groups else None
        find_create.p_extra_ips = extra_ips.encode('utf-8') if extra_ips else None

        self.finder = ndilib.NDIlib_find_create_v2(byref(find_create))
        if not self.finder:
            raise RuntimeError("Failed to create NDI finder")

    def wait_for_sources(self, timeout_ms=5000):
        """Wait for sources to be discovered"""
        return ndilib.NDIlib_find_wait_for_sources(self.finder, timeout_ms)

    def get_sources(self):
        """Get list of discovered NDI sources"""
        num_sources = c_uint32(0)
        sources_ptr = ndilib.NDIlib_find_get_current_sources(self.finder, byref(num_sources))

        sources = []
        for i in range(num_sources.value):
            source = sources_ptr[i]
            sources.append({
                'name': source.p_ndi_name.decode('utf-8') if source.p_ndi_name else '',
                'url': source.p_url_address.decode('utf-8') if source.p_url_address else '',
                'source_struct': source,
            })

        return sources

    def close(self):
        """Close the finder"""
        if self.finder:
            ndilib.NDIlib_find_destroy(self.finder)
            self.finder = None

    def __del__(self):
        self.close()

class NDIReceiver:
    def __init__(self, source, color_format=NDIlib_recv_color_format_e.NDIlib_recv_color_format_BGRX_BGRA,
                 bandwidth=NDIlib_recv_bandwidth_e.NDIlib_recv_bandwidth_highest,
                 recv_name="Python NDI Receiver"):
        """Initialize NDI Receiver"""
        self.receiver = None  # Initialize first for __del__

        recv_create = NDIlib_recv_create_v3_t()

        # Copy source structure fields directly
        recv_create.source_to_connect_to.p_ndi_name = source.p_ndi_name
        recv_create.source_to_connect_to.p_url_address = source.p_url_address

        recv_create.color_format = color_format
        recv_create.bandwidth = bandwidth
        recv_create.allow_video_fields = False
        recv_create.p_ndi_recv_name = recv_name.encode('utf-8')

        self.receiver = ndilib.NDIlib_recv_create_v3(byref(recv_create))
        if not self.receiver:
            raise RuntimeError("Failed to create NDI receiver")

        print(f"Receiver created for source")

    def get_num_connections(self):
        """Get number of active connections"""
        return ndilib.NDIlib_recv_get_no_connections(self.receiver)

    def receive_video(self, timeout_ms=5000):
        """Receive a video frame"""
        video_frame = NDIlib_video_frame_v2_t()

        frame_type = ndilib.NDIlib_recv_capture_v3(
            self.receiver,
            byref(video_frame),
            None,  # audio
            None,  # metadata
            timeout_ms
        )

        if frame_type == NDIlib_frame_type_e.NDIlib_frame_type_video:
            # Convert to numpy array
            width = video_frame.xres
            height = video_frame.yres
            fourcc = video_frame.FourCC

            # Determine bytes per pixel and format
            if fourcc in [NDIlib_FourCC_video_type_e.NDIlib_FourCC_type_BGRX,
                          NDIlib_FourCC_video_type_e.NDIlib_FourCC_type_BGRA,
                          NDIlib_FourCC_video_type_e.NDIlib_FourCC_type_RGBX,
                          NDIlib_FourCC_video_type_e.NDIlib_FourCC_type_RGBA]:
                bytes_per_pixel = 4
                channels = 4
            else:
                bytes_per_pixel = 2
                channels = 2

            # Calculate stride
            stride = video_frame.line_stride_in_bytes
            if stride == 0:
                stride = width * bytes_per_pixel

            # Copy data from pointer to numpy array
            buffer_size = stride * height
            data = np.ctypeslib.as_array(video_frame.p_data, shape=(buffer_size,))

            # Reshape based on stride
            if stride == width * bytes_per_pixel:
                frame = data.reshape((height, width, channels))
            else:
                # Handle stride
                frame = np.zeros((height, width, channels), dtype=np.uint8)
                for y in range(height):
                    row_start = y * stride
                    row_end = row_start + width * bytes_per_pixel
                    frame[y] = data[row_start:row_end].reshape((width, channels))

            # Make a copy before freeing
            frame = frame.copy()

            # Free the NDI frame
            ndilib.NDIlib_recv_free_video_v2(self.receiver, byref(video_frame))

            return {
                'frame': frame,
                'width': width,
                'height': height,
                'fourcc': fourcc,
                'frame_rate_N': video_frame.frame_rate_N,
                'frame_rate_D': video_frame.frame_rate_D,
            }

        return None

    def close(self):
        """Close the receiver"""
        if self.receiver:
            ndilib.NDIlib_recv_destroy(self.receiver)
            self.receiver = None

    def __del__(self):
        self.close()

def cleanup():
    """Cleanup NDI library"""
    ndilib.NDIlib_destroy()

# Test function
if __name__ == "__main__":
    import time

    print("=" * 70)
    print("NDI Direct ctypes Test")
    print("=" * 70)

    # Find sources
    print("\nFinding NDI sources...")
    finder = NDIFinder()
    finder.wait_for_sources(5000)

    sources = finder.get_sources()
    print(f"Found {len(sources)} source(s):")
    for i, src in enumerate(sources, 1):
        print(f"  {i}. {src['name']}")
        print(f"      URL: {src['url']}")

    if not sources:
        print("\nNo sources found!")
        finder.close()
        cleanup()
        sys.exit(1)

    # Connect to first source
    source = sources[0]
    print(f"\nConnecting to: {source['name']}")

    receiver = NDIReceiver(source['source_struct'])

    # Wait for connection
    print("Waiting for connection...")
    time.sleep(2)

    num_conn = receiver.get_num_connections()
    print(f"Number of connections: {num_conn}")

    # Try to receive video
    print("\nAttempting to receive video frames (10 attempts)...")

    for i in range(1, 11):
        print(f"  Attempt {i}...", end=' ')
        result = receiver.receive_video(timeout_ms=1000)

        if result:
            print(f"[SUCCESS] Received {result['width']}x{result['height']} frame!")
            print(f"           FourCC: 0x{result['fourcc']:08X}")
            print(f"           Frame rate: {result['frame_rate_N']}/{result['frame_rate_D']}")
            print(f"           Frame shape: {result['frame'].shape}")
            break
        else:
            print("[TIMEOUT]")

    # Cleanup
    receiver.close()
    finder.close()
    cleanup()

    print("\n" + "=" * 70)
    print("Test completed")
    print("=" * 70)
