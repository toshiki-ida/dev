"""
簡易GUIテスト
"""
import customtkinter as ctk

print("Creating CTk window...")
app = ctk.CTk()
app.title("Test Window")
app.geometry("400x300")

label = ctk.CTkLabel(app, text="Test Label")
label.pack(pady=20)

print("Window created successfully")
print("Starting mainloop...")

# 5秒後に自動で閉じる
app.after(5000, app.quit)
app.mainloop()

print("Mainloop ended")
