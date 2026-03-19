"""
OpenType Agent - Native macOS Menu Bar Application

Entry point for the agent application.
"""

import sys
import os

# Ensure we can import from the package
if __name__ == '__main__':
    # Add the parent directory to path for development
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)

    from OpenTypeAgent.app import main
    main()
