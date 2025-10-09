#!/usr/bin/env python3
"""
Impact Client VERSIONFILE auto-sync tool 🥷
Synchronizes version numbers across:
- VERSIONFILE
- tampermonkey.js  (// @version <num>)
- vav4inject.js    (const VERSION = "<num>")
"""

import re
import sys
from pathlib import Path

# --- CONFIG ---
VERSION_FILE = Path("VERSIONFILE")
TARGET_FILES = ["tampermonkey.js", "vav4inject.js"]

def read_current_version() -> str:
    """Read version from VERSIONFILE."""
    if VERSION_FILE.exists():
        return VERSION_FILE.read_text(encoding="utf-8").strip()
    return None

def write_new_version(new_version: str):
    """Write version to VERSIONFILE."""
    VERSION_FILE.write_text(new_version + "\n", encoding="utf-8")
    print(f"✅ Updated VERSIONFILE → {new_version}")

def update_tampermonkey(file_path: Path, numeric_version: str):
    """Update the // @version line in tampermonkey.js."""
    pattern = re.compile(r"(//\s*@version\s+)([\d\.]+)")
    content = file_path.read_text(encoding="utf-8")
    new_content, count = pattern.subn(rf"\g<1>{numeric_version}", content)
    if count > 0:
        file_path.write_text(new_content, encoding="utf-8")
        print(f"✅ Updated tampermonkey.js → {numeric_version}")
    else:
        print(f"⚠️ No // @version line found in {file_path.name}")

def update_vav4inject(file_path: Path, numeric_version: str):
    """Update the const VERSION = "<num>"; line in vav4inject.js."""
    pattern = re.compile(r'(const\s+VERSION\s*=\s*")[\d\.]+(";)')
    content = file_path.read_text(encoding="utf-8")
    new_content, count = pattern.subn(rf"\g<1>{numeric_version}\g<2>", content)
    if count > 0:
        file_path.write_text(new_content, encoding="utf-8")
        print(f"✅ Updated vav4inject.js → {numeric_version}")
    else:
        print(f"⚠️ No const VERSION found in {file_path.name}")

def main():
    """Main entry point."""
    current_version = read_current_version()
    print(f"📄 Current version: {current_version or 'none found'}")

    # Get new version
    if len(sys.argv) > 1:
        new_version = sys.argv[1]
    else:
        new_version = input("Enter new version (e.g. v6.3): ").strip()

    # Validate format (v6.3)
    if not re.match(r"^v\d+(\.\d+)*$", new_version):
        print("❌ Invalid version format. Use like: v6.3 or v6.3.1")
        sys.exit(1)

    numeric_version = new_version.lstrip("v")  # e.g. "6.3"

    # Write version file
    write_new_version(new_version)

    # Update tampermonkey.js and vav4inject.js
    tm_file = Path("tampermonkey.js")
    vi_file = Path("vav4inject.js")

    if tm_file.exists():
        update_tampermonkey(tm_file, numeric_version)
    else:
        print("⚠️ tampermonkey.js not found — skipped")

    if vi_file.exists():
        update_vav4inject(vi_file, numeric_version)
    else:
        print("⚠️ vav4inject.js not found — skipped")

    print("\n🎯 Version sync complete! All files updated successfully.\n")

if __name__ == "__main__":
    main()
