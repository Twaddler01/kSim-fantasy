
#!/usr/bin/env python3

"""
fcss - CSS selector and rule finder

Usage:
    fcss .app-shell
    fcss .topbar .app-shell
"""

import sys
from pathlib import Path


# ==========================================
# CONFIGURATION
# ==========================================

ROOT = Path(".")
MAX_SELECTOR_LINES = 20

EXCLUDED_DIRS = {
    ".git",
    "node_modules",
    "mobile-dev-console",
    "ideas",
    "debug",
}


# ==========================================
# CSS SCANNER
# ==========================================

def mask_comments_and_strings(source):
    """
    Replace comments and quoted strings with spaces.
    Preserve newlines and character positions.
    This prevents braces inside comments/strings
    from interfering with block detection.
    """

    chars = list(source)
    i = 0
    state = None

    while i < len(source):
        char = source[i]
        next_char = source[i + 1] if i + 1 < len(source) else ""

        if state == "comment":
            if char == "*" and next_char == "/":
                chars[i] = " "
                chars[i + 1] = " "
                i += 2
                state = None
                continue

            if char != "\n":
                chars[i] = " "

        elif state in ("'", '"'):
            if char == "\\":
                if char != "\n":
                    chars[i] = " "

                if i + 1 < len(source):
                    if source[i + 1] != "\n":
                        chars[i + 1] = " "
                    i += 2
                    continue

            if char == state:
                state = None

            if char != "\n":
                chars[i] = " "

        else:
            if char == "/" and next_char == "*":
                chars[i] = " "
                chars[i + 1] = " "
                i += 2
                state = "comment"
                continue

            if char in ("'", '"'):
                state = char
                chars[i] = " "

        i += 1

    return "".join(chars)


def find_blocks(source):
    """
    Find CSS blocks using balanced braces.

    Returns:
        (opening brace, closing brace, prelude start)
    """

    masked = mask_comments_and_strings(source)

    stack = []
    blocks = []

    prelude_start = 0

    for i, char in enumerate(masked):

        if char == ";":
            prelude_start = i + 1

        elif char == "{":
            stack.append((i, prelude_start))
            prelude_start = i + 1

        elif char == "}":
            if stack:
                opening, start = stack.pop()

                blocks.append((opening, i, start))

            prelude_start = i + 1

    return masked, blocks


# ==========================================
# SEARCH
# ==========================================

def search_file(path, terms):

    try:
        source = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return []

    masked, blocks = find_blocks(source)

    results = []

    for opening, closing, start in blocks:

        selector = masked[start:opening]

        if not selector.strip():
            continue

        # Check all search terms against the selector/prelude.
        matched = False
        match_position = None

        for term in terms:

            position = selector.lower().find(term.lower())

            if position != -1:
                matched = True
                match_position = start + position
                break

        if not matched:
            continue

        # Limit the distance between the match and opening brace.
        lines_between = masked.count(
            "\n", match_position, opening
        )

        if lines_between > MAX_SELECTOR_LINES:
            continue

        # Determine the beginning of the selector.
        content_start = start

        while (
            content_start < opening
            and source[content_start].isspace()
        ):
            content_start += 1

        # Original source line number.
        line_number = source.count(
            "\n", 0, content_start
        ) + 1

        # Capture the complete CSS rule.
        content = source[content_start:closing + 1]

        results.append((
            line_number,
            content
        ))

    return results


# ==========================================
# FILE DISCOVERY
# ==========================================

def find_css_files(root):

    for path in root.rglob("*.css"):

        if any(
            part in EXCLUDED_DIRS
            for part in path.parts
        ):
            continue

        if path.is_file():
            yield path


# ==========================================
# MAIN
# ==========================================

def main():

    if len(sys.argv) < 2:
        print("Usage: fcss .selector [another-selector]")
        return 1

    terms = sys.argv[1:]

    print("=== CSS Search ===")
    print("Searching:", ", ".join(terms))
    print()

    found = 0

    for path in find_css_files(ROOT):

        results = search_file(path, terms)

        for line_number, content in results:

            print(f"{path}:{line_number}:")
            print(content)
            print()

            found += 1

    if not found:
        print("No matching CSS blocks found.")
        return 1

    print(f"Found {found} matching block(s).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
