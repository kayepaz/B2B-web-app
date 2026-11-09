#!/usr/bin/env python3
"""Check that the service worker's offline file list matches the app.

Every file in app/ (except product images, which are saved as they're
viewed) must be listed in APP_FILES in app/sw.js, and every listed file must
exist. Otherwise the app could break offline without anyone noticing.

Run after tools/generate_data.py. Exits with status 1 if anything is wrong.
Uses only the Python standard library.
"""

import re
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent / "app"
SKIP_DIRS = {"images/products"}
SKIP_FILES = {"sw.js"}  # the service worker itself is never cached


def listed_files():
    source = (APP / "sw.js").read_text(encoding="utf-8")
    block = re.search(r"const APP_FILES = \[(.*?)\];", source, re.S)
    if not block:
        sys.exit("Could not find APP_FILES in app/sw.js")
    return set(re.findall(r"'([^']+)'", block.group(1))) - {"./"}


def actual_files():
    files = set()
    for path in APP.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(APP).as_posix()
        if rel in SKIP_FILES or any(rel.startswith(d + "/") for d in SKIP_DIRS):
            continue
        files.add(rel)
    return files


def main():
    listed, actual = listed_files(), actual_files()
    missing_from_list = sorted(actual - listed)
    missing_on_disk = sorted(listed - actual)
    for rel in missing_from_list:
        print(f"Not in APP_FILES in app/sw.js: {rel}")
    for rel in missing_on_disk:
        print(f"Listed in APP_FILES but missing: {rel}")
    if missing_from_list or missing_on_disk:
        sys.exit(1)
    print(f"OK: all {len(listed)} app files are available offline.")


if __name__ == "__main__":
    main()
