"""
NDI Wrapper using ctypes and NDI SDK 5
This is a replacement for cyndilib to work around NDI SDK 6 bugs
"""
import os
import sys
import ctypes
from ctypes import c_char_p, c_bool, c_uint32, c_int, c_float, c_uint8, POINTER, Structure, c_void_p
import numpy as np

# NDI 5 DLL path
NDI_DLL_PATH = r"C:\Program Files\NDI\NDI 5 Tools\Runtime\Processing.NDI.Lib.x64.dll"

if not os.path.exists(NDI_DLL_PATH):
    raise RuntimeError(f"NDI 5 DLL not found at: {NDI_DLL_PATH}")

# Load NDI library
ndi_lib = ctypes.CDLL(NDI_DLL_PATH)

# ============================================================================
# NDI Structures
# ============================================================================

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

class NDIlib_video_frame_v2_t(Structure):
    _fields_ = [
        ("xres", c_int),
        ("yres", c_int),
        ("FourCC", c_int),  # NDIlib_FourCC_video_type_e
        ("frame_rate_N", c_int),
        ("frame_rate_D", c_int),
        ("picture_aspect_ratio", c_float),
        ("frame_format_type", c_int),  # NDIlib_frame_format_type_e
        ("timecode", ctypes.c_int64),
        ("p_data", POINTER(c_uint8)),
        ("line_stride_in_bytes", c_int),
        ("p_metadata", c_char_p),
        ("timestamp", ctypes.c_int64),
    ]

class NDIlib_recv_create_v3_t(Structure):
    _fields_ = [
        ("source_to_connect_to", NDIlib_source_t),
        ("color_format", c_int),  # NDIlib_recv_color_format_e
        ("bandwidth", c_int),  # NDIlib_recv_bandwidth_e
        ("allow_video_fields", c_bool),
        ("p_ndi_recv_name", c_char_p),
    ]

class NDIlib_send_create_t(Structure):
    _fields_ = [
        ("p_ndi_name", c_char_p),
        ("p_groups", c_char_p),
        ("clock_video", c_bool),
        ("clock_audio", c_bool),
    ]

# ============================================================================
# NDI Enums
# ============================================================================

class NDIlib_recv_color_format_e:
    BGRX_BGRA = 0
    UYVY_BGRA = 1
    RGBX_RGBA = 2
    UYVY_RGBA = 3

class NDIlib_recv_bandwidth_e:
    metadata_only = -10
    audio_only = 10
    lowest = 0
    highest = 100

class NDIlib_frame_type_e:
    none = 0
    video = 1
    audio = 2
    metadata = 3
    error = 4
    status_change = 100

class NDIlib_FourCC_video_type_e:
    """NDI FourCC video format types"""
    UYVY = 0x59565955  # 'UYVY' - YUV 4:2:2
    UYVA = 0x41565955  # 'UYVA' - YUV 4:2:2:4
    P216 = 0x36313250  # 'P216' - 16bpp
    PA16 = 0x36314150  # 'PA16' - 16bpp with alpha
    YV12 = 0x32315659  # 'YV12' - Planar 4:2:0
    I420 = 0x30323449  # 'I420' - Planar 4:2:0
    NV12 = 0x3231564E  # 'NV12' - Planar 4:2:0
    BGRA = 0x41524742  # 'BGRA' - 8bit BGRA
    BGRX = 0x58524742  # 'BGRX' - 8bit BGRX
    RGBA = 0x41424752  # 'RGBA' - 8bit RGBA
    RGBX = 0x58424752  # 'RGBX' - 8bit RGBX

# ============================================================================
# NDI Function Prototypes
# ============================================================================

# NDIlib_initialize
NDIlib_initialize = ndi_lib.NDIlib_initialize
NDIlib_initialize.restype = c_bool

# NDIlib_find_create_v2
NDIlib_find_create_v2 = ndi_lib.NDIlib_find_create_v2
NDIlib_find_create_v2.argtypes = [POINTER(NDIlib_find_create_t)]
NDIlib_find_create_v2.restype = c_void_p

# NDIlib_find_get_current_sources
NDIlib_find_get_current_sources = ndi_lib.NDIlib_find_get_current_sources
NDIlib_find_get_current_sources.argtypes = [c_void_p, POINTER(c_uint32)]
NDIlib_find_get_current_sources.restype = POINTER(NDIlib_source_t)

# NDIlib_find_destroy
NDIlib_find_destroy = ndi_lib.NDIlib_find_destroy
NDIlib_find_destroy.argtypes = [c_void_p]

# NDIlib_recv_create_v3
NDIlib_recv_create_v3 = ndi_lib.NDIlib_recv_create_v3
NDIlib_recv_create_v3.argtypes = [POINTER(NDIlib_recv_create_v3_t)]
NDIlib_recv_create_v3.restype = c_void_p

# NDIlib_recv_destroy
NDIlib_recv_destroy = ndi_lib.NDIlib_recv_destroy
NDIlib_recv_destroy.argtypes = [c_void_p]

# NDIlib_recv_capture_v2
NDIlib_recv_capture_v2 = ndi_lib.NDIlib_recv_capture_v2
NDIlib_recv_capture_v2.argtypes = [
    c_void_p,  # recv instance
    POINTER(NDIlib_video_frame_v2_t),  # video frame
    c_void_p,  # audio frame (NULL)
    c_void_p,  # metadata frame (NULL)
    c_uint32,  # timeout_in_ms
]
NDIlib_recv_capture_v2.restype = c_int

# NDIlib_recv_free_video_v2
NDIlib_recv_free_video_v2 = ndi_lib.NDIlib_recv_free_video_v2
NDIlib_recv_free_video_v2.argtypes = [c_void_p, POINTER(NDIlib_video_frame_v2_t)]

# NDIlib_recv_get_no_connections
NDIlib_recv_get_no_connections = ndi_lib.NDIlib_recv_get_no_connections
NDIlib_recv_get_no_connections.argtypes = [c_void_p]
NDIlib_recv_get_no_connections.restype = c_int

# NDIlib_send_create
NDIlib_send_create = ndi_lib.NDIlib_send_create
NDIlib_send_create.argtypes = [POINTER(NDIlib_send_create_t)]
NDIlib_send_create.restype = c_void_p

# NDIlib_send_destroy
NDIlib_send_destroy = ndi_lib.NDIlib_send_destroy
NDIlib_send_destroy.argtypes = [c_void_p]

# NDIlib_send_send_video_v2
NDIlib_send_send_video_v2 = ndi_lib.NDIlib_send_send_video_v2
NDIlib_send_send_video_v2.argtypes = [c_void_p, POINTER(NDIlib_video_frame_v2_t)]

# ============================================================================
# Python Wrapper Classes
# ============================================================================

class NDIFinder:
    """NDI Source Finder"""

    def __init__(self):
        self._finder = None
        self._is_initialized = False

    def initialize(self):
        """Initialize NDI and create finder"""
        if not NDIlib_initialize():
            raise RuntimeError("Failed to initialize NDI")

        find_settings = NDIlib_find_create_t(
            show_local_sources=True,
            p_groups=None,
            p_extra_ips=None
        )

        self._finder = NDIlib_find_create_v2(ctypes.byref(find_settings))
        if not self._finder:
            raise RuntimeError("Failed to create NDI Finder")

        self._is_initialized = True

    def get_sources(self):
        """Get list of available NDI sources"""
        if not self._is_initialized:
            raise RuntimeError("Finder not initialized")

        num_sources = c_uint32(0)
        sources_ptr = NDIlib_find_get_current_sources(self._finder, ctypes.byref(num_sources))

        sources = []
        if num_sources.value > 0:
            for i in range(num_sources.value):
                src = sources_ptr[i]
                name = src.p_ndi_name.decode('utf-8') if src.p_ndi_name else "Unknown"
                url = src.p_url_address.decode('utf-8') if src.p_url_address else "Unknown"
                sources.append({
                    'name': name,
                    'url': url,
                    'ndi_source': src  # Store original structure
                })

        return sources

    def close(self):
        """Close finder and cleanup"""
        if self._finder:
            NDIlib_find_destroy(self._finder)
            self._finder = None
        self._is_initialized = False


class NDIReceiver:
    """NDI Video Receiver"""

    def __init__(self, source_info):
        """
        Create receiver for given source

        Args:
            source_info: dict with 'name', 'url', 'ndi_source' (from Finder.get_sources())
        """
        self._receiver = None
        self._source_info = source_info
        self._is_initialized = False

    def initialize(self):
        """Create NDI receiver"""
        # Create receiver settings
        ndi_source = self._source_info['ndi_source']

        recv_settings = NDIlib_recv_create_v3_t(
            source_to_connect_to=ndi_source,
            color_format=NDIlib_recv_color_format_e.BGRX_BGRA,
            bandwidth=NDIlib_recv_bandwidth_e.highest,
            allow_video_fields=True,
            p_ndi_recv_name=b"Python NDI Receiver"
        )

        self._receiver = NDIlib_recv_create_v3(ctypes.byref(recv_settings))
        if not self._receiver:
            raise RuntimeError("Failed to create NDI Receiver")

        self._is_initialized = True

    def get_num_connections(self):
        """Get number of active connections"""
        if not self._is_initialized:
            return 0
        return NDIlib_recv_get_no_connections(self._receiver)

    def receive_video(self, timeout_ms=5000):
        """
        Receive a video frame

        Args:
            timeout_ms: timeout in milliseconds

        Returns:
            numpy array (H, W, 4) in BGRA format, or None if no frame
        """
        if not self._is_initialized:
            raise RuntimeError("Receiver not initialized")

        video_frame = NDIlib_video_frame_v2_t()

        frame_type = NDIlib_recv_capture_v2(
            self._receiver,
            ctypes.byref(video_frame),
            None,  # no audio
            None,  # no metadata
            timeout_ms
        )

        if frame_type == NDIlib_frame_type_e.video:
            # Extract frame data
            width = video_frame.xres
            height = video_frame.yres
            stride = video_frame.line_stride_in_bytes

            # Create numpy array from frame data
            if video_frame.p_data:
                # Calculate buffer size
                buffer_size = abs(stride) * height

                # Create numpy array from pointer
                frame_array = np.ctypeslib.as_array(video_frame.p_data, shape=(buffer_size,))

                # Reshape to image
                if stride < 0:
                    # Bottom-up image
                    frame = frame_array[:abs(stride) * height].reshape((height, abs(stride) // 4, 4))
                else:
                    # Top-down image
                    frame = frame_array[:stride * height].reshape((height, stride // 4, 4))

                # Crop to actual width
                frame = frame[:, :width, :]

                # Copy frame data before freeing
                frame_copy = frame.copy()

                # Free the video frame
                NDIlib_recv_free_video_v2(self._receiver, ctypes.byref(video_frame))

                return frame_copy
            else:
                # Free the video frame
                NDIlib_recv_free_video_v2(self._receiver, ctypes.byref(video_frame))
                return None

        return None

    def close(self):
        """Close receiver and cleanup"""
        if self._receiver:
            NDIlib_recv_destroy(self._receiver)
            self._receiver = None
        self._is_initialized = False


class NDISender:
    """NDI Video Sender"""

    def __init__(self, ndi_name="Python NDI Sender"):
        """
        Create NDI sender

        Args:
            ndi_name: Name of the NDI sender
        """
        self._sender = None
        self._ndi_name = ndi_name
        self._is_initialized = False

    def initialize(self):
        """Create NDI sender"""
        send_settings = NDIlib_send_create_t(
            p_ndi_name=self._ndi_name.encode('utf-8'),
            p_groups=None,
            clock_video=True,
            clock_audio=False
        )

        self._sender = NDIlib_send_create(ctypes.byref(send_settings))
        if not self._sender:
            raise RuntimeError("Failed to create NDI Sender")

        self._is_initialized = True

    def send_video(self, frame, frame_rate_n=30, frame_rate_d=1):
        """
        Send a video frame

        Args:
            frame: numpy array (H, W, 4) in BGRA format
            frame_rate_n: Frame rate numerator
            frame_rate_d: Frame rate denominator
        """
        if not self._is_initialized:
            raise RuntimeError("Sender not initialized")

        height, width = frame.shape[:2]

        # Ensure frame is contiguous and in correct format
        if not frame.flags['C_CONTIGUOUS']:
            frame = np.ascontiguousarray(frame)

        # Create video frame structure
        video_frame = NDIlib_video_frame_v2_t()
        video_frame.xres = width
        video_frame.yres = height
        video_frame.FourCC = NDIlib_FourCC_video_type_e.BGRA  # BGRA format
        video_frame.frame_rate_N = frame_rate_n
        video_frame.frame_rate_D = frame_rate_d
        video_frame.picture_aspect_ratio = width / height
        video_frame.frame_format_type = 1  # Progressive
        video_frame.timecode = 0
        video_frame.line_stride_in_bytes = width * 4
        video_frame.p_metadata = None
        video_frame.timestamp = 0

        # Set data pointer
        video_frame.p_data = frame.ctypes.data_as(POINTER(c_uint8))

        # Send frame
        NDIlib_send_send_video_v2(self._sender, ctypes.byref(video_frame))

    def close(self):
        """Close sender and cleanup"""
        if self._sender:
            NDIlib_send_destroy(self._sender)
            self._sender = None
        self._is_initialized = False


# ============================================================================
# Example Usage
# ============================================================================

if __name__ == "__main__":
    import time

    print("=" * 70)
    print("NDI Wrapper Test")
    print("=" * 70)

    # Create and initialize finder
    finder = NDIFinder()
    finder.initialize()
    print("[OK] Finder initialized")

    # Wait for sources
    print("\nWaiting 3 seconds for sources...")
    time.sleep(3)

    # Get sources
    sources = finder.get_sources()
    print(f"\nFound {len(sources)} source(s):")
    for i, src in enumerate(sources, 1):
        print(f"  {i}. {src['name']}")
        print(f"      URL: {src['url']}")

    if not sources:
        print("\n[ERROR] No sources found!")
        finder.close()
        sys.exit(1)

    # Find Test Pattern source (prefer local sources over remote)
    source = None
    for src in sources:
        if "Test Pattern" in src['name']:
            source = src
            break

    if not source:
        # Fallback to first source
        source = sources[0]

    print(f"\nConnecting to: {source['name']}")

    receiver = NDIReceiver(source)
    receiver.initialize()
    print("[OK] Receiver created")

    # Wait for connection
    print("\nWaiting for connection...")
    for i in range(10):
        time.sleep(1)
        num_conn = receiver.get_num_connections()
        print(f"  [{i+1}s] Connections: {num_conn}")
        if num_conn > 0:
            print(f"\n[SUCCESS] Connected after {i+1} seconds!")
            break

    # Try to receive video
    if receiver.get_num_connections() > 0:
        print("\nAttempting to receive video frames...")
        for i in range(5):
            frame = receiver.receive_video(timeout_ms=2000)
            if frame is not None:
                print(f"  Frame {i+1}: {frame.shape}, dtype={frame.dtype}")
            else:
                print(f"  Frame {i+1}: No frame")

    # Cleanup
    receiver.close()
    finder.close()
    print("\n[OK] Test completed")
