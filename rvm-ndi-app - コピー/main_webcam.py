"""
RobustVideoMatting Webcam Application
Captures video from webcam, processes it with RobustVideoMatting AI model,
and displays the mask result in real-time.

This is a simplified version that works without NDI SDK.
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


class VideoCapture:
    """Video capture handler for webcam"""
    def __init__(self):
        self.cap = None
        self.current_device = None

    def get_devices(self):
        """Get available video capture devices"""
        devices = []
        for i in range(10):  # Check first 10 indices
            cap = cv2.VideoCapture(i)
            if cap.isOpened():
                devices.append(f"Camera {i}")
                cap.release()
        return devices if devices else ["No cameras found"]

    def connect_device(self, device_name: str):
        """Connect to video device"""
        if device_name == "No cameras found":
            return False

        try:
            device_id = int(device_name.split()[-1])
        except (ValueError, IndexError):
            return False

        if self.cap:
            self.cap.release()

        self.cap = cv2.VideoCapture(device_id)
        if self.cap.isOpened():
            self.current_device = device_name
            # Set camera properties for better performance
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            self.cap.set(cv2.CAP_PROP_FPS, 30)
            return True
        return False

    def read_frame(self):
        """Read frame from video capture"""
        if not self.cap or not self.cap.isOpened():
            return None

        ret, frame = self.cap.read()
        if ret:
            return frame
        return None

    def cleanup(self):
        """Clean up video capture resources"""
        if self.cap:
            self.cap.release()


class App(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Window setup
        self.title("RobustVideoMatting Webcam Application")
        self.geometry("1400x800")

        # Set theme
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        # Initialize components
        self.video_capture = None
        self.rvm_model = None
        self.processing_thread = None
        self.stop_event = Event()
        self.is_processing = False

        # Output options
        self.output_mode = "mask"  # "mask", "composite", "both"

        # Create UI
        self.create_ui()

        # Load video devices
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

        # Video Source selection
        source_label = ctk.CTkLabel(self.control_frame, text="Video Input Source:")
        source_label.pack(pady=(10, 5))

        self.source_combo = ctk.CTkComboBox(
            self.control_frame,
            values=["No cameras found"],
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

        # Output mode selection
        output_label = ctk.CTkLabel(self.control_frame, text="Output Mode:")
        output_label.pack(pady=(20, 5))

        self.output_combo = ctk.CTkComboBox(
            self.control_frame,
            values=["Mask Only", "Composite", "Side by Side"],
            width=260,
            state="readonly",
            command=self.on_output_mode_changed
        )
        self.output_combo.set("Mask Only")
        self.output_combo.pack(pady=5)

        # Background color for composite
        self.bg_color_label = ctk.CTkLabel(self.control_frame, text="Background Color:")
        self.bg_color_label.pack(pady=(20, 5))

        self.bg_color_combo = ctk.CTkComboBox(
            self.control_frame,
            values=["Green", "Blue", "White", "Black", "Custom"],
            width=260,
            state="readonly"
        )
        self.bg_color_combo.set("Green")
        self.bg_color_combo.pack(pady=5)

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

        # Output video label
        output_title = ctk.CTkLabel(
            self.video_frame,
            text="Processed Output",
            font=ctk.CTkFont(size=18, weight="bold")
        )
        output_title.pack(pady=(20, 5))

        self.mask_label = ctk.CTkLabel(self.video_frame, text="")
        self.mask_label.pack(pady=10)

    def on_output_mode_changed(self, choice):
        """Handle output mode change"""
        self.output_mode = choice.lower().replace(" ", "_")

    def refresh_sources(self):
        """Refresh video source list"""
        try:
            if not self.video_capture:
                self.video_capture = VideoCapture()

            sources = self.video_capture.get_devices()

            if sources and sources[0] != "No cameras found":
                self.source_combo.configure(values=sources)
                self.source_combo.set(sources[0])
                self.status_label.configure(text=f"Found {len(sources)} camera(s)")
            else:
                self.source_combo.configure(values=["No cameras found"])
                self.source_combo.set("No cameras found")
                self.status_label.configure(text="No cameras found")

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

        if source_name == "No cameras found":
            self.status_label.configure(text="Please select a valid source")
            return

        # Initialize video capture
        try:
            if not self.video_capture:
                self.video_capture = VideoCapture()

            if not self.video_capture.connect_device(source_name):
                self.status_label.configure(text="Failed to connect to camera")
                return

        except Exception as e:
            self.status_label.configure(text=f"Camera Error: {str(e)}")
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

    def get_background_color(self):
        """Get background color based on selection"""
        color_name = self.bg_color_combo.get()
        colors = {
            "Green": (0, 255, 0),
            "Blue": (0, 0, 255),
            "White": (255, 255, 255),
            "Black": (0, 0, 0),
            "Custom": (100, 100, 100)
        }
        return colors.get(color_name, (0, 255, 0))

    def process_loop(self):
        """Main processing loop"""
        fps_counter = 0
        fps_start_time = time.time()

        while not self.stop_event.is_set():
            try:
                # Read frame from camera
                frame = self.video_capture.read_frame()

                if frame is None:
                    time.sleep(0.01)
                    continue

                # Update resolution
                h, w = frame.shape[:2]
                self.resolution_label.configure(text=f"Resolution: {w}x{h}")

                # Process with RVM
                mask = self.rvm_model.forward(frame)

                # Create output based on mode
                output_mode = self.output_combo.get()

                if output_mode == "Mask Only":
                    output = (mask * 255).astype(np.uint8)
                elif output_mode == "Composite":
                    bg_color = self.get_background_color()
                    # Create composite with background color
                    mask_3ch = np.stack([mask] * 3, axis=2)
                    bg = np.full_like(frame, bg_color, dtype=np.uint8)
                    output = (frame * mask_3ch + bg * (1 - mask_3ch)).astype(np.uint8)
                else:  # Side by Side
                    mask_display = (mask * 255).astype(np.uint8)
                    mask_3ch = cv2.cvtColor(mask_display, cv2.COLOR_GRAY2BGR)
                    output = np.hstack([frame, mask_3ch])

                # Update displays
                self.update_display(frame, output)

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

    def update_display(self, input_frame, output_frame):
        """Update video displays"""
        try:
            # Resize for display
            display_width = 500

            # Input frame
            h, w = input_frame.shape[:2]
            display_height = int(h * display_width / w)
            input_resized = cv2.resize(input_frame, (display_width, display_height))
            input_rgb = cv2.cvtColor(input_resized, cv2.COLOR_BGR2RGB)
            input_image = Image.fromarray(input_rgb)
            input_photo = ImageTk.PhotoImage(input_image)

            self.input_label.configure(image=input_photo)
            self.input_label.image = input_photo

            # Output frame
            h, w = output_frame.shape[:2] if len(output_frame.shape) == 3 else (output_frame.shape[0], output_frame.shape[1])
            display_height = int(h * display_width / w)
            output_resized = cv2.resize(output_frame, (display_width, display_height))

            if len(output_resized.shape) == 2:
                output_image = Image.fromarray(output_resized)
            else:
                output_rgb = cv2.cvtColor(output_resized, cv2.COLOR_BGR2RGB)
                output_image = Image.fromarray(output_rgb)

            output_photo = ImageTk.PhotoImage(output_image)

            self.mask_label.configure(image=output_photo)
            self.mask_label.image = output_photo

        except Exception as e:
            print(f"Display error: {e}")

    def on_closing(self):
        """Handle window closing"""
        self.stop_processing()

        if self.video_capture:
            self.video_capture.cleanup()

        self.destroy()


if __name__ == "__main__":
    app = App()
    app.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.mainloop()
