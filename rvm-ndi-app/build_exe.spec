# -*- mode: python ; coding: utf-8 -*-

import os
from PyInstaller.utils.hooks import collect_all, collect_data_files

block_cipher = None

# Collect all RobustVideoMatting files
rvm_datas = []
rvm_binaries = []
rvm_hiddenimports = []

# Add entire RobustVideoMatting folder
rvm_datas += [('RobustVideoMatting', 'RobustVideoMatting')]

# Collect customtkinter files
ctk_datas, ctk_binaries, ctk_hiddenimports = collect_all('customtkinter')

a = Analysis(
    ['app_complete.py'],
    pathex=[],
    binaries=rvm_binaries + ctk_binaries,
    datas=[
        ('ndi_wrapper.py', '.'),
    ] + rvm_datas + ctk_datas,
    hiddenimports=[
        'ndi_wrapper',
        'model',
        'inference',
        'torch',
        'torchvision',
        'cv2',
        'numpy',
        'PIL',
        'PIL._tkinter_finder',
        'customtkinter',
    ] + rvm_hiddenimports + ctk_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='RVM_NDI_App',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # Show console for debug output
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='RVM_NDI_App',
)
