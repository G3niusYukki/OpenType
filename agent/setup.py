"""
Setup script for OpenType Agent - PyObjC Menu Bar Application
Uses py2app to create a native macOS .app bundle
"""

from setuptools import setup, find_packages
import os

# Get the directory containing this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

APP_NAME = 'OpenTypeAgent'
VERSION = '0.1.0'

# Main entry point
APP = ['OpenTypeAgent/__main__.py']

# Data files to include (icons, etc.)
DATA_FILES = [
    ('resources', ['resources/IconTemplate.pdf', 'resources/IconRunning.pdf', 'resources/IconError.pdf']),
]

# py2app options
OPTIONS = {
    'argv_emulation': False,
    'packages': ['OpenTypeAgent'],
    'includes': [
        'Foundation',
        'Cocoa',
        'AppKit',
        'objc',
    ],
    'excludes': [
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'PIL',
        'scipy',
        'pytest',
        'unittest',
    ],
    'plist': {
        'CFBundleName': APP_NAME,
        'CFBundleDisplayName': 'OpenType Agent',
        'CFBundleIdentifier': 'com.opentype.agent',
        'CFBundleVersion': VERSION,
        'CFBundleShortVersionString': VERSION,
        'LSMinimumSystemVersion': '11.0',
        'LSUIElement': True,  # Run as agent (no dock icon)
        'NSHighResolutionCapable': True,
        'NSRequiresAquaSystemAppearance': False,  # Support dark mode
        'CFBundleDocumentTypes': [],
        'CFBundleURLTypes': [],
    },
    'iconfile': None,  # We use PDF template icons, not .icns
    'strip': True,
    'optimize': 2,
}

setup(
    name=APP_NAME,
    version=VERSION,
    description='OpenType Menu Bar Agent - Native macOS server management',
    author='OpenType Contributors',
    url='https://github.com/G3niusYukki/OpenType',
    packages=find_packages(),
    app=APP,
    data_files=DATA_FILES,
    options={'py2app': OPTIONS},
    setup_requires=['py2app>=0.28.0'],
    # Note: install_requires is not supported by py2app with newer setuptools
    # Dependencies should be installed via pip install -r requirements.txt first
    python_requires='>=3.9',
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Environment :: MacOS X',
        'Intended Audience :: End Users/Desktop',
        'License :: OSI Approved :: MIT License',
        'Operating System :: MacOS',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
        'Programming Language :: Python :: 3.12',
        'Topic :: Utilities',
    ],
)
