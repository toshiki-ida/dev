"""
RobustVideoMatting NDI Application
Captures video from NDI input, processes it with RobustVideoMatting AI model,
and outputs the mask result via NDI.
"""

import customtkinter as ctk
from PIL import Image, ImageTk
import cv2
import numpy as np
import torch
from threading import Thread, Event
import time
from typing import Optional
import sys

# NDI imports
try:
    import NDIlib as ndi
except ImportError:
    print("Error: NDI SDK not found. Please install ndi-python")
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
            self.model = torch.hub.load(
                "PeterL1n/RobustVideoMatting",
                "mobilenetv3",
                pretrained=True
            )

        self.model.eval()
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = self.model.to(self.device)
        self.rec = [None] * 4

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
    """NDI input/output handler"""
    def __init__(self):
        if not ndi.initialize():
            raise RuntimeError("Failed to initialize NDI")

        self.finder = ndi.find_create_v2()
        self.recv = None
        self.send = None
        self.current_source = None

    def get_sources(self):
        """Get available NDI sources"""
        if not ndi.find_wait_for_sources(self.finder, 1000):
            return []

        sources = ndi.find_get_current_sources(self.finder)
        return [s.ndi_name for s in sources]

    def connect_source(self, source_name: str):
        """Connect to NDI source"""
        sources = ndi.find_get_current_sources(self.finder)
        source = None

        for s in sources:
            if s.ndi_name == source_name:
                source = s
                break

        if source is None:
            return False

        if self.recv:
            ndi.recv_destroy(self.recv)

        self.recv = ndi.recv_create_v3()
        ndi.recv_connect(self.recv, source)
        self.current_source = source_name
        return True

    def create_sender(self, name: str = "RVM Mask Output"):
        """Create NDI sender"""
        if self.send:
            ndi.send_destroy(self.send)

        self.send = ndi.send_create()
        ndi.send_set_name(self.send, name)

    def read_frame(self):
        """Read frame from NDI input"""
        if not self.recv:
            return None

        t, v, _, _ = ndi.recv_capture_v2(self.recv, 5000)

        if t == ndi.FRAME_TYPE_VIDEO:
            frame = np.copy(v.data)
            ndi.recv_free_video_v2(self.recv, v)

            # Convert BGRA to BGR
            if frame.shape[2] == 4:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

            return frame

        return None

    def send_frame(self, frame):
        """Send frame via NDI output"""
        if not self.send:
            return

        # Ensure frame is in correct format (BGRA)
        if len(frame.shape) == 2:
            frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGRA)
        elif frame.shape[2] == 3:
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)

        # Create NDI frame
        video_frame = ndi.VideoFrameV2()
        video_frame.data = frame
        video_frame.FourCC = ndi.FOURCC_VIDEO_TYPE_BGRA

        ndi.send_send_video_v2(self.send, video_frame)

    def cleanup(self):
        """Clean up NDI resources"""
        if self.recv:
            ndi.recv_destroy(self.recv)
        if self.send:
            ndi.send_destroy(self.send)
        ndi.find_destroy(self.finder)
        ndi.destroy()


class App(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Window setup
        self.title("RobustVideoMatting NDI Application")
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
        source_name = self.source_combo.get()

        if source_name == "No sources found":
            self.status_label.configure(text="Please select a valid source")
            return

        # Initialize NDI
        try:
            if not self.ndi_processor:
                self.ndi_processor = NDIProcessor()

            if not self.ndi_processor.connect_source(source_name):
                self.status_label.configure(text="Failed to connect to source")
                return

            self.ndi_processor.create_sender("RVM Mask Output")

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
        self.refresh_btn.configure(state="disabled")

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
        self.refresh_btn.configure(state="normal")

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
    app = App()
    app.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.mainloop()
