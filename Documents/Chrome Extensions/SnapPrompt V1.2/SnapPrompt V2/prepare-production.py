#!/usr/bin/env python3
"""
Production Preparation Script for SnapPrompt Chrome Extension
This script removes console.log statements while keeping console.error and console.warn
"""

import re
import os
import shutil
from pathlib import Path

# Configuration
SOURCE_DIR = Path(".")
BUILD_DIR = Path("./production-build")
FILES_TO_PROCESS = ["analytics.js", "background.js", "popup.js", "content.js"]
FILES_TO_EXCLUDE = [
    "reset-whats-new.js",
    "prepare-production.py",
    ".claude",
    "Enhancements",
    "commit_message.txt",
    "USER_GUIDE.md",
    "V1.3.0_RELEASE_NOTES.md",
    ".git",
    ".gitignore",
    "production-build"
]

def remove_console_logs(content):
    """Remove console.log statements but keep console.error and console.warn"""
    # Pattern to match console.log statements
    # Uses a more careful approach to avoid removing actual code

    # Remove standalone console.log lines (complete statements on their own line)
    # This matches: whitespace + console.log + balanced parentheses + optional semicolon + whitespace/newline
    lines = content.split('\n')
    cleaned_lines = []

    for line in lines:
        # Check if line is ONLY a console.log statement (with optional whitespace and semicolon)
        if re.match(r'^\s*console\.log\(.*\);?\s*$', line) and not ('console.error' in line or 'console.warn' in line):
            # Skip this line (don't add to cleaned_lines)
            continue
        else:
            cleaned_lines.append(line)

    content = '\n'.join(cleaned_lines)

    # Clean up excessive empty lines (max 2 consecutive empty lines)
    content = re.sub(r'\n{3,}', '\n\n', content)

    return content

def should_exclude(path, base_path):
    """Check if path should be excluded from production build"""
    rel_path = path.relative_to(base_path)
    path_str = str(rel_path)

    for exclude in FILES_TO_EXCLUDE:
        if exclude in path_str:
            return True
    return False

def copy_and_clean():
    """Copy files to build directory and clean console.log statements"""

    # Create build directory
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    BUILD_DIR.mkdir()

    print(f"Creating production build in: {BUILD_DIR}")
    print("-" * 60)

    # Track statistics
    stats = {
        'files_processed': 0,
        'files_copied': 0,
        'console_logs_removed': 0
    }

    # Walk through source directory
    for item in SOURCE_DIR.rglob('*'):
        if item.is_file() and not should_exclude(item, SOURCE_DIR):
            # Calculate relative path
            rel_path = item.relative_to(SOURCE_DIR)
            dest_path = BUILD_DIR / rel_path

            # Create parent directories
            dest_path.parent.mkdir(parents=True, exist_ok=True)

            # Check if this is a JS file to process
            if item.name in FILES_TO_PROCESS:
                print(f"Processing: {rel_path}")
                with open(item, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Count console.log occurrences before removal
                original_count = len(re.findall(r'console\.log\(', content))

                # Remove console.log statements
                cleaned_content = remove_console_logs(content)

                # Count after removal
                remaining_count = len(re.findall(r'console\.log\(', cleaned_content))
                removed = original_count - remaining_count

                with open(dest_path, 'w', encoding='utf-8') as f:
                    f.write(cleaned_content)

                print(f"  - Removed {removed} console.log statements")
                stats['console_logs_removed'] += removed
                stats['files_processed'] += 1
            else:
                # Copy file as-is
                shutil.copy2(item, dest_path)
                stats['files_copied'] += 1

    print("-" * 60)
    print(f"\n[SUCCESS] Production build complete!")
    print(f"\nStatistics:")
    print(f"  - Files processed (cleaned): {stats['files_processed']}")
    print(f"  - Files copied (as-is): {stats['files_copied']}")
    print(f"  - Console.log statements removed: {stats['console_logs_removed']}")
    print(f"\nProduction build location: {BUILD_DIR.absolute()}")
    print(f"\nReady to zip: {BUILD_DIR}")

if __name__ == "__main__":
    copy_and_clean()
