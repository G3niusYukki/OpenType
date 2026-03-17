"""
Auto-updater for OpenType Agent
Checks for updates from GitHub releases and handles downloads
"""

import Foundation
import AppKit
import objc
from Foundation import NSObject, NSUserDefaults, NSBundle, NSLog, NSURL
from Cocoa import NSURLSession, NSURLSessionDownloadTask
import json
import hashlib
import os
from pathlib import Path

from .constants import GITHUB_API_URL, UPDATE_CHECK_INTERVAL


class AutoUpdater(NSObject):
    """Handles automatic update checking and downloading"""

    def init(self):
        """Initialize the auto-updater"""
        self = objc.super(AutoUpdater, self).init()
        if self is None:
            return None

        self.delegate = None
        self.current_version = self._get_current_version()
        self.last_check_time = None
        self.available_update = None
        self.downloaded_update_path = None

        return self

    def set_delegate(self, delegate):
        """Set the delegate for update callbacks"""
        self.delegate = delegate

    def _get_current_version(self):
        """Get the current app version from bundle or constants"""
        # Try to get from bundle
        bundle = NSBundle.mainBundle()
        version = bundle.objectForInfoDictionaryKey_("CFBundleShortVersionString")
        if version:
            return str(version)

        # Fallback to constants
        from .constants import VERSION
        return VERSION

    def check_now(self):
        """Check for updates immediately"""
        NSLog("Checking for updates...")

        # Run in background to avoid blocking UI
        import threading
        thread = threading.Thread(target=self._check_for_updates, daemon=True)
        thread.start()

    def _check_for_updates(self):
        """Perform the actual update check (runs in background)"""
        try:
            import urllib.request
            import ssl

            # Create request with proper headers
            headers = {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': f'OpenTypeAgent/{self.current_version}'
            }

            request = urllib.request.Request(GITHUB_API_URL, headers=headers)

            # Allow older TLS for compatibility (GitHub supports modern TLS)
            context = ssl.create_default_context()

            with urllib.request.urlopen(request, timeout=10, context=context) as response:
                data = json.loads(response.read().decode('utf-8'))

            self._process_release_data(data)

        except Exception as e:
            NSLog(f"Failed to check for updates: {e}")

    def _process_release_data(self, data):
        """Process the GitHub release data"""
        tag_name = data.get('tag_name', '')

        # Parse version from tag (e.g., "v1.0.0" -> "1.0.0")
        latest_version = tag_name.lstrip('v')

        NSLog(f"Latest version: {latest_version}, Current: {self.current_version}")

        if self._is_newer_version(latest_version, self.current_version):
            NSLog(f"Update available: {latest_version}")

            # Find the asset for this platform
            assets = data.get('assets', [])
            download_url = None
            checksum = None

            for asset in assets:
                name = asset.get('name', '')
                if 'agent' in name.lower() and name.endswith('.zip'):
                    download_url = asset.get('browser_download_url')
                    break

            self.available_update = {
                'version': latest_version,
                'download_url': download_url,
                'release_notes': data.get('body', ''),
                'published_at': data.get('published_at', ''),
            }

            # Notify delegate
            if self.delegate:
                self.delegate.update_available(latest_version, download_url)
        else:
            NSLog("No updates available")

    def _is_newer_version(self, latest, current):
        """Compare version strings"""
        try:
            latest_parts = [int(x) for x in latest.split('.')]
            current_parts = [int(x) for x in current.split('.')]

            # Pad to same length
            max_len = max(len(latest_parts), len(current_parts))
            latest_parts.extend([0] * (max_len - len(latest_parts)))
            current_parts.extend([0] * (max_len - len(current_parts)))

            return latest_parts > current_parts
        except ValueError:
            # If parsing fails, assume it's newer
            return latest != current

    def download_update(self, url=None):
        """Download the update package"""
        url = url or (self.available_update.get('download_url') if self.available_update else None)

        if not url:
            NSLog("No update URL available")
            return False

        NSLog(f"Downloading update from {url}")

        # Run in background
        import threading
        thread = threading.Thread(target=self._download_update, args=(url,), daemon=True)
        thread.start()

        return True

    def _download_update(self, url):
        """Perform the actual download (runs in background)"""
        try:
            import urllib.request
            import tempfile

            # Create temp file
            temp_dir = tempfile.gettempdir()
            filename = os.path.basename(url) or "update.zip"
            download_path = os.path.join(temp_dir, f"opentype_agent_update_{filename}")

            # Download
            urllib.request.urlretrieve(url, download_path)

            self.downloaded_update_path = download_path

            NSLog(f"Update downloaded to {download_path}")

            # Notify delegate
            if self.delegate and self.available_update:
                self.delegate.update_downloaded(self.available_update['version'])

        except Exception as e:
            NSLog(f"Failed to download update: {e}")

    def verify_checksum(self, file_path, expected_checksum):
        """Verify the downloaded file's SHA256 checksum"""
        try:
            sha256 = hashlib.sha256()
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(8192), b''):
                    sha256.update(chunk)

            actual_checksum = sha256.hexdigest()
            return actual_checksum.lower() == expected_checksum.lower()

        except Exception as e:
            NSLog(f"Failed to verify checksum: {e}")
            return False

    def install_update(self):
        """Install the downloaded update"""
        if not self.downloaded_update_path:
            NSLog("No update to install")
            return False

        if not os.path.exists(self.downloaded_update_path):
            NSLog("Downloaded update file not found")
            return False

        NSLog(f"Installing update from {self.downloaded_update_path}")

        # This would typically:
        # 1. Extract the zip
        # 2. Replace the current app bundle
        # 3. Restart

        # For now, just log that it would happen
        # Full implementation would require careful handling of:
        # - Code signing verification
        # - Atomic replacement
        # - Restart coordination

        return True

    def get_update_info(self):
        """Get information about available update"""
        return self.available_update

    def skip_version(self, version):
        """Skip a specific version"""
        defaults = NSUserDefaults.standardUserDefaults()
        defaults.setObject_forKey_(version, "skipped_update_version")
        defaults.synchronize()

    def is_version_skipped(self, version):
        """Check if a version has been skipped"""
        defaults = NSUserDefaults.standardUserDefaults()
        skipped = defaults.stringForKey_("skipped_update_version")
        return skipped == version
