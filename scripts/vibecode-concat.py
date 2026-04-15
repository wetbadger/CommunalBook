#!/usr/bin/env python3
"""
VibeCoding File Concatenator
Properly handles * wildcards in .llmignore patterns
Usage: python vibecode_concat.py [directory_path] [--strip-style]
"""

import os
import fnmatch
import sys
import argparse
import re
from pathlib import Path

def load_ignore_patterns(ignore_file_path):
    """Load ignore patterns from .llmignore file"""
    patterns = []
    if not os.path.exists(ignore_file_path):
        return patterns
    
    with open(ignore_file_path, 'r') as f:
        for line in f:
            line = line.strip()
            # Skip empty lines and comments
            if line and not line.startswith('#'):
                patterns.append(line)
    return patterns

def is_ignored(file_path, patterns, root_dir):
    """Check if a file matches any ignore pattern with proper * handling"""
    rel_path = os.path.relpath(file_path, root_dir)
    # Also check just the filename for patterns without slashes
    filename = os.path.basename(file_path)
    
    for pattern in patterns:
        # fnmatch handles * wildcards properly
        # Check against relative path
        if fnmatch.fnmatch(rel_path, pattern):
            return True
        # Check against just filename (for patterns like "*.log")
        if fnmatch.fnmatch(filename, pattern):
            return True
        # Handle directory patterns (pattern ending with /*)
        if pattern.endswith('/*'):
            dir_pattern = pattern[:-2]  # Remove /*
            # Check if file is inside that directory
            if rel_path.startswith(dir_pattern + '/') or rel_path == dir_pattern:
                return True
    
    return False

def strip_style_tags(content):
    """Remove content inside <style> tags and the tags themselves"""
    # Let's try a line-by-line approach which is more reliable
    lines = content.split('\n')
    result_lines = []
    in_style_block = False
    style_block_start_line = -1
    total_stripped_chars = 0
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Check if this line contains the start of a style tag
        if not in_style_block and re.search(r'<style[^>]*>', line, re.IGNORECASE):
            in_style_block = True
            style_block_start_line = i
            
            # Check if the style tag closes on the same line
            if re.search(r'</style>', line, re.IGNORECASE):
                # Style tag opens and closes on same line - remove just the tag content
                line = re.sub(r'<style[^>]*>.*?</style>', '', line, flags=re.IGNORECASE)
                if line.strip():  # Only add if there's something left
                    result_lines.append(line)
                in_style_block = False
            else:
                # Remove the opening tag part
                line = re.sub(r'<style[^>]*>', '', line, flags=re.IGNORECASE)
                # Don't add this line to results yet - we're in style block
                i += 1
                continue
        # Check if we're in a style block and found closing tag
        elif in_style_block and re.search(r'</style>', line, re.IGNORECASE):
            # Remove the closing tag and any text after it on the same line
            line = re.sub(r'</style>', '', line, flags=re.IGNORECASE)
            # If there's content after the closing tag, add it
            if line.strip():
                result_lines.append(line)
            in_style_block = False
        # If we're inside a style block, skip the line entirely
        elif in_style_block:
            total_stripped_chars += len(line) + 1  # +1 for newline
            i += 1
            continue
        # Normal line - keep it
        else:
            result_lines.append(line)
        
        i += 1
    
    # If we never closed the style block, something went wrong - return original
    if in_style_block:
        print(f"Warning: Unclosed style block detected, keeping original content")
        return content, 0
    
    result = '\n'.join(result_lines)
    stripped_size = len(content) - len(result)
    
    return result, stripped_size

def process_file_content(file_path, strip_style=False):
    """Read file and optionally strip style tags"""
    try:
        with open(file_path, 'r', encoding='utf-8') as infile:
            content = infile.read()
            
            if strip_style:
                # Only strip style tags from HTML/XML-like files
                file_ext = os.path.splitext(file_path)[1].lower()
                if file_ext in ['.html', '.htm', '.vue', '.jsx', '.tsx', '.xml', '.svg']:
                    stripped_content, stripped_size = strip_style_tags(content)
                    
                    if stripped_size > 0:
                        return stripped_content, f"STRIPPED: {stripped_size} bytes of style content"
                    elif stripped_content != content:
                        return stripped_content, None
                    else:
                        return content, None
                return content, None
            return content, None
    except UnicodeDecodeError:
        return None, "SKIPPED: Binary file"
    except Exception as e:
        return None, f"ERROR: Could not read file - {e}"

def get_all_files(root_dir, ignore_patterns):
    """Recursively get all files that should be included"""
    all_files = []
    
    for root, dirs, files in os.walk(root_dir):
        # Skip .git directory entirely
        if '.git' in dirs:
            dirs.remove('.git')
        
        for file in files:
            file_path = os.path.join(root, file)
            if not is_ignored(file_path, ignore_patterns, root_dir):
                all_files.append(file_path)
    
    return sorted(all_files)

def concatenate_files(file_list, output_file, root_dir, strip_style=False):
    """Write all files to output with filename headers"""
    total_stripped_bytes = 0
    files_with_stripped_styles = 0
    
    with open(output_file, 'w', encoding='utf-8') as outfile:
        # Write header with settings info
        outfile.write(f"{'='*80}\n")
        outfile.write(f"VibeCoding Context Export\n")
        outfile.write(f"{'='*80}\n")
        outfile.write(f"Root directory: {root_dir}\n")
        outfile.write(f"Style tag stripping: {'ON' if strip_style else 'OFF'}\n")
        outfile.write(f"Total files: {len(file_list)}\n")
        outfile.write(f"{'='*80}\n\n")
        
        for file_path in file_list:
            rel_path = os.path.relpath(file_path, root_dir)
            
            # Write filename separator
            outfile.write(f"\n{'='*80}\n")
            outfile.write(f"FILE: {rel_path}\n")
            outfile.write(f"{'='*80}\n\n")
            
            # Process file content
            content, warning = process_file_content(file_path, strip_style)
            
            if warning:
                outfile.write(f"[{warning}]\n\n")
                if warning.startswith("STRIPPED:"):
                    # Extract the stripped byte count for stats
                    try:
                        bytes_str = warning.split(":")[1].strip().split(" ")[0]
                        total_stripped_bytes += int(bytes_str)
                        files_with_stripped_styles += 1
                    except:
                        pass
            if content:
                outfile.write(content)
                if content and not content.endswith('\n'):
                    outfile.write('\n')
            
            outfile.write('\n')  # Extra newline between files
        
        # Write footer with statistics if stripping was enabled
        if strip_style and files_with_stripped_styles > 0:
            outfile.write(f"\n{'='*80}\n")
            outfile.write(f"STRIPPING STATISTICS\n")
            outfile.write(f"{'='*80}\n")
            outfile.write(f"Files with stripped styles: {files_with_stripped_styles}\n")
            outfile.write(f"Total bytes stripped: {total_stripped_bytes:,}\n")
            if total_stripped_bytes > 1024:
                outfile.write(f"Total stripped: {total_stripped_bytes / 1024:.2f} KB\n")
            outfile.write(f"{'='*80}\n")

def find_llmignore(start_dir):
    """Search for .llmignore file in current and parent directories"""
    current = Path(start_dir).resolve()
    
    # Search up the directory tree
    for parent in [current] + list(current.parents):
        ignore_file = parent / '.llmignore'
        if ignore_file.exists():
            return ignore_file, parent
    
    return None, None

def main():
    parser = argparse.ArgumentParser(
        description='Concatenate all non-ignored files into a single text file',
        epilog='Example: python vibecode_concat.py .. --strip-style'
    )
    parser.add_argument(
        'directory',
        nargs='?',
        default='.',
        help='Directory to scan (default: current directory). Use ".." for parent directory'
    )
    parser.add_argument(
        '-o', '--output',
        default='vibecode_context.txt',
        help='Output file name (default: vibecode_context.txt)'
    )
    parser.add_argument(
        '-s', '--strip-style',
        action='store_true',
        help='Remove content inside <style> tags (useful for HTML/Vue files)'
    )
    
    args = parser.parse_args()
    
    # Convert to absolute path
    target_dir = os.path.abspath(args.directory)
    
    if not os.path.exists(target_dir):
        print(f"Error: Directory '{target_dir}' does not exist!")
        sys.exit(1)
    
    if not os.path.isdir(target_dir):
        print(f"Error: '{target_dir}' is not a directory!")
        sys.exit(1)
    
    print(f"Target directory: {target_dir}")
    
    # Find .llmignore file (searching up from target directory)
    ignore_file_path, root_dir = find_llmignore(target_dir)
    
    if ignore_file_path:
        print(f"Found .llmignore at: {ignore_file_path}")
        print(f"Using root directory: {root_dir}")
        ignore_patterns = load_ignore_patterns(ignore_file_path)
        print(f"Loaded {len(ignore_patterns)} ignore patterns:")
        for p in ignore_patterns[:10]:  # Show first 10 patterns
            print(f"  - {p}")
        if len(ignore_patterns) > 10:
            print(f"  ... and {len(ignore_patterns) - 10} more")
    else:
        print(f"Warning: No .llmignore found in {target_dir} or any parent directory")
        response = input("Continue without ignoring files? (y/n): ")
        if response.lower() != 'y':
            sys.exit(1)
        root_dir = target_dir
        ignore_patterns = []
    
    print(f"\nStrip style tags: {'YES' if args.strip_style else 'NO'}")
    
    print(f"\nScanning directory: {target_dir}")
    files_to_process = get_all_files(target_dir, ignore_patterns)
    print(f"Found {len(files_to_process)} files to process")
    
    # Create output file in current working directory (where script is run from)
    output_path = os.path.join(os.getcwd(), args.output)
    
    if files_to_process:
        print(f"\nWriting to {output_path}...")
        concatenate_files(files_to_process, output_path, target_dir, args.strip_style)
        
        # Show file size
        file_size = os.path.getsize(output_path)
        if file_size > 1024 * 1024:
            print(f"Done! Output written to {output_path} ({file_size / (1024*1024):.2f} MB)")
        elif file_size > 1024:
            print(f"Done! Output written to {output_path} ({file_size / 1024:.2f} KB)")
        else:
            print(f"Done! Output written to {output_path} ({file_size} bytes)")
        
        if args.strip_style:
            print("\n✓ Style tags have been removed while preserving all other content")
    else:
        print("No files found to process!")

if __name__ == "__main__":
    main()