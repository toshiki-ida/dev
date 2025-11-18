"""
main.pyの初期化テスト
"""
import sys
print("Python version:", sys.version)

print("Importing customtkinter...")
import customtkinter as ctk

print("Importing other modules...")
from file_watcher import FileWatcher
from vmix_controller import VmixController
from config_manager import ConfigManager

print("All imports successful")

print("Creating ConfigManager...")
config_manager = ConfigManager()
print("ConfigManager created")

print("Creating CTk window...")
app = ctk.CTk()
print("CTk window created")

app.title("vMix Controller")
print("Title set")

geometry = config_manager.get("window_geometry", "900x700")
app.geometry(geometry)
print(f"Geometry set: {geometry}")

print("Setting appearance mode...")
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")
print("Appearance mode set")

print("Creating FileWatcher...")
def dummy_callback(path):
    print(f"File detected: {path}")

file_watcher = FileWatcher(callback=dummy_callback)
print("FileWatcher created")

print("Creating VmixController...")
host, port = config_manager.get_vmix_connection()
vmix = VmixController(host=host, port=port)
print(f"VmixController created (host={host}, port={port})")

print("\nAll initialization successful!")
print("Closing window in 3 seconds...")

app.after(3000, app.quit)
app.mainloop()

print("Test completed successfully")
