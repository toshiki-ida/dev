"""
RobustVideoMatting NDI Application (using cyndilib)
Captures video from NDI input, processes it with RobustVideoMatting AI model,
and outputs the mask result via NDI using the official NDI SDK.

Requires: NDI SDK installed from https://ndi.tv/sdk/
"""

import os
import sys

# Add NDI Runtime to PATH for cyndilib
# NDI 5 is prioritized due to better compatibility with cyndilib
ndi_runtime_paths = [
    r"C:\Program Files\NDI\NDI 5 Runtime\v5",  # Try NDI 5 first (better compatibility)
    r"C:\Program Files\NDI\NDI 6 Runtime\v6",  # Fallback to NDI 6
    r"C:\Program Files\NDI\NDI 6 SDK\Bin\x64",
]

for path in ndi_runtime_paths:
    if os.path.exists(path) and path not in os.environ.get('PATH', ''):
        os.environ['PATH'] = path + os.pathsep + os.environ.get('PATH', '')
        print(f"Added to PATH: {path}")

import customtkinter as ctk
from PIL import Image, ImageTk
import cv2
import numpy as np
import torch
from threading import Thread, Event
import time
from typing import Optional
import sys

# cyndilib imports (official NDI SDK wrapper)
try:
    from cyndilib import finder, receiver, sender
    from cyndilib.wrapper import ndi_structs
    from cyndilib.wrapper.ndi_recv import RecvColorFormat, RecvBandwidth
except ImportError:
    print("Error: cyndilib not found. Please install: pip install cyndilib")
    print("Also ensure NDI SDK is installed from https://ndi.tv/sdk/")
    sys.exit(1)

# RobustVideoMatting imports
try:
    from torchvision.transforms.functional import to_pil_image
    import torch.nn as nn
except ImportError:
    print("Error: PyTorch not found. Please install torch and torchvision")
    sys.exit(1)


class RobustVideoMatting(nn.Module):
    """RobustVideoMatting model wrapper"""
    def __init__(self, model_path: Optional[str] = None):
        super().__init__()
        # Load pretrained model
        if model_path:
            self.model = torch.jit.load(model_path)
        else:
            # Download from GitHub if no path provided
            print("Downloading RobustVideoMatting model...")
            self.model = torch.hub.load(
                "PeterL1n/RobustVideoMatting",
                "mobilenetv3",
                pretrained=True
            )

        self.model.eval()
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = self.model.to(self.device)
        self.rec = [None] * 4
        print(f"Model loaded on {self.device}")

    def forward(self, frame):
        """Process single frame"""
        with torch.no_grad():
            # Convert to tensor
            frame_tensor = torch.from_numpy(frame).permute(2, 0, 1).unsqueeze(0)
            frame_tensor = frame_tensor.float().div(255).to(self.device)

            # Run inference
            fgr, pha, *self.rec = self.model(frame_tensor, *self.rec, downsample_ratio=0.25)

            # Convert back to numpy
            pha = pha.squeeze(0).squeeze(0).cpu().numpy()

            return pha


class NDIProcessor:
    """NDI input/output handler using cyndilib"""
    def __init__(self):
        self.finder_inst = None
        self.recv_inst = None
        self.send_inst = None
        self.current_source = None

        # Initialize NDI
        try:
            self.finder_inst = finder.Finder()
            self.finder_inst.open()  # Must call open() to start the discovery thread!
        except Exception as e:
            raise RuntimeError(f"Failed to initialize NDI: {e}")

    def get_sources(self):
        """Get available NDI sources"""
        if not self.finder_inst:
            return []

        try:
            # Wait for sources - cyndilib needs time for discovery thread to find sources
            time.sleep(1.0)  # Give time for sources to be discovered
            # Use get_source_names() which returns list of strings
            return self.finder_inst.get_source_names()
        except Exception as e:
            print(f"Error getting sources: {e}")
            return []

    def connect_source(self, source_name: str):
        """Connect to NDI source"""
        if not self.finder_inst:
            return False

        try:
            # Try to get source from Finder
            source = self.finder_inst.get_source(source_name)

            # Close existing receiver (automatic cleanup)
            self.recv_inst = None

            if source is not None:
                # Found source in Finder - use Source object
                print(f"Connecting via Finder: {source_name}")
                self.recv_inst = receiver.Receiver(
                    source=source,
                    color_format=RecvColorFormat.BGRX_BGRA,
                    bandwidth=RecvBandwidth.highest
                )
            else:
                # Source not in Finder - try direct connection by name
                # This works around NDI 6 + cyndilib Finder issues
                print(f"Source not in Finder, attempting direct connection: {source_name}")
                self.recv_inst = receiver.Receiver(
                    source_name=source_name,  # Use source_name parameter directly
                    color_format=RecvColorFormat.BGRX_BGRA,
                    bandwidth=RecvBandwidth.highest
                )

            self.current_source = source_name
            return True

        except Exception as e:
            print(f"Error connecting to source: {e}")
            import traceback
            traceback.print_exc()
            return False

    def create_sender(self, name: str = "RVM Mask Output"):
        """Create NDI sender"""
        try:
            # Close existing sender (automatic cleanup)
            self.send_inst = None

            self.send_inst = sender.Sender(name)
            return True
        except Exception as e:
            print(f"Error creating sender: {e}")
            return False

    def read_frame(self):
        """Read frame from NDI input"""
        if not self.recv_inst:
            return None

        try:
            # Receive video frame
            result = self.recv_inst.receive(receiver.ReceiveFrameType.recv_video, timeout_ms=100)

            if result != receiver.ReceiveFrameType.recv_video:
                return None

            # Get video frame data
            video_frame = self.recv_inst.video_frame

            # Convert to numpy array
            frame = np.copy(video_frame.data)

            # Convert BGRA to BGR
            if frame.shape[2] == 4:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

            return frame

        except Exception as e:
            print(f"Error reading frame: {e}")
            return None

    def send_frame(self, frame):
        """Send frame via NDI output"""
        if not self.send_inst:
            return False

        try:
            # Ensure frame is in correct format (BGRA)
            if len(frame.shape) == 2:
                frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGRA)
            elif frame.shape[2] == 3:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)

            # Ensure frame is contiguous
            if not frame.flags['C_CONTIGUOUS']:
                frame = np.ascontiguousarray(frame)

            # Send frame
            self.send_inst.write_video(frame)
            return True

        except Exception as e:
            print(f"Error sending frame: {e}")
            return False

    def cleanup(self):
        """Clean up NDI resources"""
        # Receiver and Sender cleanup is automatic (no destroy method)
        self.recv_inst = None
        self.send_inst = None

        # Finder must be explicitly closed
        if self.finder_inst:
            self.finder_inst.close()  # Must call close() to stop the discovery thread
            self.finder_inst = None


class App(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Window setup
        self.title("RobustVideoMatting NDI Application (Official SDK)")
        self.geometry("1400x800")

        # Set theme
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        # Initialize components
        self.ndi_processor = None
        self.rvm_model = None
        self.processing_thread = None
        self.stop_event = Event()
        self.is_processing = False

        # Create UI
        self.create_ui()

        # Load NDI sources
        self.refresh_sources()

    def create_ui(self):
        """Create user interface"""
        # Control panel (left side)
        self.control_frame = ctk.CTkFrame(self, width=300)
        self.control_frame.pack(side="left", fill="y", padx=10, pady=10)
        self.control_frame.pack_propagate(False)

        # Title
        title_label = ctk.CTkLabel(
            self.control_frame,
            text="Control Panel",
            font=ctk.CTkFont(size=20, weight="bold")
        )
        title_label.pack(pady=(20, 30))

        # NDI Source selection
        source_label = ctk.CTkLabel(self.control_frame, text="NDI Input Source:")
        source_label.pack(pady=(10, 5))

        self.source_combo = ctk.CTkComboBox(
            self.control_frame,
            values=["No sources found"],
            width=260,
            state="readonly"
        )
        self.source_combo.pack(pady=5)

        # Refresh button
        self.refresh_btn = ctk.CTkButton(
            self.control_frame,
            text="Refresh Sources",
            command=self.refresh_sources,
            width=260
        )
        self.refresh_btn.pack(pady=5)

        # Manual source name entry (for sources not detected by Finder)
        manual_label = ctk.CTkLabel(
            self.control_frame,
            text="Or enter source name manually:",
            font=ctk.CTkFont(size=10)
        )
        manual_label.pack(pady=(15, 2))

        self.manual_source_entry = ctk.CTkEntry(
            self.control_frame,
            width=260,
            placeholder_text="e.g., CG_DEV_001 (Output 1)"
        )
        self.manual_source_entry.pack(pady=5)

        # Output name
        output_label = ctk.CTkLabel(self.control_frame, text="NDI Output Name:")
        output_label.pack(pady=(20, 5))

        self.output_name_entry = ctk.CTkEntry(
            self.control_frame,
            width=260,
            placeholder_text="RVM Mask Output"
        )
        self.output_name_entry.insert(0, "RVM Mask Output")
        self.output_name_entry.pack(pady=5)

        # Start/Stop button
        self.start_btn = ctk.CTkButton(
            self.control_frame,
            text="Start Processing",
            command=self.toggle_processing,
            width=260,
            height=50,
            font=ctk.CTkFont(size=16, weight="bold")
        )
        self.start_btn.pack(pady=30)

        # Status label
        self.status_label = ctk.CTkLabel(
            self.control_frame,
            text="Status: Idle",
            font=ctk.CTkFont(size=14)
        )
        self.status_label.pack(pady=20)

        # Info labels
        self.fps_label = ctk.CTkLabel(self.control_frame, text="FPS: 0")
        self.fps_label.pack(pady=5)

        self.device_label = ctk.CTkLabel(
            self.control_frame,
            text=f"Device: {'CUDA' if torch.cuda.is_available() else 'CPU'}"
        )
        self.device_label.pack(pady=5)

        self.resolution_label = ctk.CTkLabel(self.control_frame, text="Resolution: -")
        self.resolution_label.pack(pady=5)

        # SDK info
        sdk_label = ctk.CTkLabel(
            self.control_frame,
            text="Using: Official NDI SDK\n(cyndilib)",
            font=ctk.CTkFont(size=10),
            text_color="gray"
        )
        sdk_label.pack(pady=(20, 5))

        # Video display area (right side)
        self.video_frame = ctk.CTkFrame(self)
        self.video_frame.pack(side="right", fill="both", expand=True, padx=10, pady=10)

        # Input video label
        input_title = ctk.CTkLabel(
            self.video_frame,
            text="Input Video",
            font=ctk.CTkFont(size=18, weight="bold")
        )
        input_title.pack(pady=(10, 5))

        self.input_label = ctk.CTkLabel(self.video_frame, text="")
        self.input_label.pack(pady=10)

        # Mask video label
        mask_title = ctk.CTkLabel(
            self.video_frame,
            text="Mask Output",
            font=ctk.CTkFont(size=18, weight="bold")
        )
        mask_title.pack(pady=(20, 5))

        self.mask_label = ctk.CTkLabel(self.video_frame, text="")
        self.mask_label.pack(pady=10)

    def refresh_sources(self):
        """Refresh NDI source list"""
        try:
            if not self.ndi_processor:
                self.ndi_processor = NDIProcessor()

            self.status_label.configure(text="Searching for sources...")
            self.update()

            sources = self.ndi_processor.get_sources()

            if sources:
                self.source_combo.configure(values=sources)
                self.source_combo.set(sources[0])
                self.status_label.configure(text=f"Found {len(sources)} source(s)")
            else:
                self.source_combo.configure(values=["No sources found"])
                self.source_combo.set("No sources found")
                self.status_label.configure(text="No NDI sources found")

        except Exception as e:
            self.status_label.configure(text=f"Error: {str(e)}")

    def toggle_processing(self):
        """Start or stop processing"""
        if not self.is_processing:
            self.start_processing()
        else:
            self.stop_processing()

    def start_processing(self):
        """Start video processing"""
        # Check manual entry first
        manual_source = self.manual_source_entry.get().strip()
        if manual_source:
            source_name = manual_source
            print(f"Using manually entered source: {source_name}")
        else:
            source_name = self.source_combo.get()

            if source_name == "No sources found":
                self.status_label.configure(text="Please select a source or enter manually")
                return

        # Initialize NDI
        try:
            if not self.ndi_processor:
                self.ndi_processor = NDIProcessor()

            if not self.ndi_processor.connect_source(source_name):
                self.status_label.configure(text="Failed to connect to source")
                return

            output_name = self.output_name_entry.get() or "RVM Mask Output"
            if not self.ndi_processor.create_sender(output_name):
                self.status_label.configure(text="Failed to create NDI sender")
                return

        except Exception as e:
            self.status_label.configure(text=f"NDI Error: {str(e)}")
            return

        # Load RVM model
        try:
            if not self.rvm_model:
                self.status_label.configure(text="Loading model...")
                self.update()
                self.rvm_model = RobustVideoMatting()

        except Exception as e:
            self.status_label.configure(text=f"Model Error: {str(e)}")
            return

        # Start processing thread
        self.is_processing = True
        self.stop_event.clear()
        self.processing_thread = Thread(target=self.process_loop, daemon=True)
        self.processing_thread.start()

        # Update UI
        self.start_btn.configure(text="Stop Processing")
        self.status_label.configure(text="Processing...")
        self.source_combo.configure(state="disabled")
        self.manual_source_entry.configure(state="disabled")
        self.refresh_btn.configure(state="disabled")
        self.output_name_entry.configure(state="disabled")

    def stop_processing(self):
        """Stop video processing"""
        self.stop_event.set()
        self.is_processing = False

        if self.processing_thread:
            self.processing_thread.join(timeout=2.0)

        # Update UI
        self.start_btn.configure(text="Start Processing")
        self.status_label.configure(text="Stopped")
        self.source_combo.configure(state="readonly")
        self.manual_source_entry.configure(state="normal")
        self.refresh_btn.configure(state="normal")
        self.output_name_entry.configure(state="normal")

    def process_loop(self):
        """Main processing loop"""
        fps_counter = 0
        fps_start_time = time.time()

        while not self.stop_event.is_set():
            try:
                # Read frame from NDI
                frame = self.ndi_processor.read_frame()

                if frame is None:
                    time.sleep(0.01)
                    continue

                # Update resolution
                h, w = frame.shape[:2]
                self.resolution_label.configure(text=f"Resolution: {w}x{h}")

                # Process with RVM
                mask = self.rvm_model.forward(frame)

                # Convert mask to displayable format
                mask_display = (mask * 255).astype(np.uint8)

                # Send mask via NDI
                self.ndi_processor.send_frame(mask_display)

                # Update displays
                self.update_display(frame, mask_display)

                # Calculate FPS
                fps_counter += 1
                if time.time() - fps_start_time >= 1.0:
                    fps = fps_counter / (time.time() - fps_start_time)
                    self.fps_label.configure(text=f"FPS: {fps:.1f}")
                    fps_counter = 0
                    fps_start_time = time.time()

            except Exception as e:
                print(f"Processing error: {e}")
                time.sleep(0.1)

    def update_display(self, input_frame, mask_frame):
        """Update video displays"""
        try:
            # Resize for display
            display_width = 500
            h, w = input_frame.shape[:2]
            display_height = int(h * display_width / w)

            # Input frame
            input_resized = cv2.resize(input_frame, (display_width, display_height))
            input_rgb = cv2.cvtColor(input_resized, cv2.COLOR_BGR2RGB)
            input_image = Image.fromarray(input_rgb)
            input_photo = ImageTk.PhotoImage(input_image)

            self.input_label.configure(image=input_photo)
            self.input_label.image = input_photo

            # Mask frame
            mask_resized = cv2.resize(mask_frame, (display_width, display_height))
            mask_image = Image.fromarray(mask_resized)
            mask_photo = ImageTk.PhotoImage(mask_image)

            self.mask_label.configure(image=mask_photo)
            self.mask_label.image = mask_photo

        except Exception as e:
            print(f"Display error: {e}")

    def on_closing(self):
        """Handle window closing"""
        self.stop_processing()

        if self.ndi_processor:
            self.ndi_processor.cleanup()

        self.destroy()


if __name__ == "__main__":
    print("RobustVideoMatting NDI Application")
    print("Using official NDI SDK via cyndilib")
    print("=" * 50)

    app = App()
    app.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.mainloop()
