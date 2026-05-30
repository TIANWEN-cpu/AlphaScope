# -*- mode: python ; coding: utf-8 -*-
"""
研策中枢 AlphaScope PyInstaller spec file

构建命令: pyinstaller alphascope.spec --clean
输出目录: dist/AlphaScope/
"""

import os
import sys
from pathlib import Path

block_cipher = None

# 项目根目录
ROOT = os.path.dirname(os.path.abspath(SPEC))

# ============== 数据文件 ==============
datas = []

# config/ 目录（7 个 YAML 文件）
datas += [(os.path.join(ROOT, 'config'), 'config')]

# prompts/ 目录（12+ 个 Markdown 文件）
datas += [(os.path.join(ROOT, 'prompts'), 'prompts')]

# frontend/ 目录
datas += [(os.path.join(ROOT, 'frontend'), 'frontend')]

# custom_providers/ 目录
if os.path.exists(os.path.join(ROOT, 'custom_providers')):
    datas += [(os.path.join(ROOT, 'custom_providers'), 'custom_providers')]

# .env.example
env_example = os.path.join(ROOT, '.env.example')
if os.path.exists(env_example):
    datas += [(env_example, '.')]

# ============== Hidden Imports ==============
# Streamlit 和依赖库需要显式声明
hiddenimports = [
    # Streamlit
    'streamlit',
    'streamlit.web.cli',
    'streamlit.runtime.scriptrunner',
    'streamlit.components.v1',
    'streamlit.web.server',
    'tornado',
    'tornado.platform.asyncio',

    # 数据处理
    'pandas',
    'numpy',
    'plotly',
    'plotly.graph_objs',
    'plotly.express',
    'plotly.io',

    # 金融数据
    'akshare',
    'curl_cffi',

    # LLM SDK
    'openai',
    'pydantic',
    'yaml',
    'dotenv',

    # 异步
    'aiohttp',
    'tenacity',

    # 调度
    'apscheduler',

    # 网络
    'requests',
    'urllib3',

    # 标准库
    'json',
    'sqlite3',
    'threading',
    'concurrent.futures',
    'dataclasses',
    'enum',
    'uuid',
    'hashlib',
    'base64',
    'logging',
    'pathlib',
    'importlib',
    'importlib.util',
    'pkgutil',
]

# ============== Analysis ==============
a = Analysis(
    ['launcher.py'],
    pathex=[ROOT],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # 排除不需要的模块以减小体积
        'tests',
        'test',
        'pytest',
        'ruff',
        'matplotlib',
        'scipy',
        'sklearn',
        'torch',
        'tensorflow',
        'PIL',
        'cv2',
        'IPython',
        'jupyter',
        'notebook',
        'sphinx',
        'setuptools',
        'distutils',
        'lib2to3',
        'pydoc_data',
        'xmlrpc',
        'py_compile',
        'compileall',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# ============== PYZ ==============
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# ============== EXE ==============
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='AlphaScope',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # 保留控制台窗口，显示启动日志
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# ============== COLLECT (onedir 模式) ==============
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='AlphaScope',
)
