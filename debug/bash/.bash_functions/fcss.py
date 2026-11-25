
#!/usr/bin/env python3

"""
fcss - CSS selector and rule finder

Usage:
    fcss .app-shell
    fcss .topbar .app-shell
    fcss -js filename.js
"""

import sys
import re
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
# CSS SEARCH
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

        lines_between = masked.count(
            "\n", match_position, opening
        )

        if lines_between > MAX_SELECTOR_LINES:
            continue

        content_start = start

        while (
            content_start < opening
            and source[content_start].isspace()
        ):
            content_start += 1

        line_number = source.count(
            "\n", 0, content_start
        ) + 1

        content = source[content_start:closing + 1]

        results.append((
            line_number,
            content
        ))

    return results


def search_js_term(path, term, partial):
    """
    Search CSS for a JavaScript-derived selector.

    Complete selectors use CSS class/ID boundaries.
    Partial fragments use substring matching.
    """

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

        if partial:

            matched = term.lower() in selector.lower()

        else:

            pattern = (
                r'(?<![\w-])'
                + re.escape(term)
                + r'(?![\w-])'
            )

            matched = re.search(
                pattern,
                selector,
                re.IGNORECASE
            ) is not None

        if not matched:
            continue

        content_start = start

        while (
            content_start < opening
            and source[content_start].isspace()
        ):
            content_start += 1

        line_number = source.count(
            "\n", 0, content_start
        ) + 1

        content = source[content_start:closing + 1]

        results.append((
            line_number,
            content
        ))

    return results


# ==========================================
# JAVASCRIPT EXTRACTION
# ==========================================

STRING_PATTERN = re.compile(
    r"""(['"`])((?:\\.|(?!\1)[\s\S])*)\1"""
)

SELECTOR_PATTERN = re.compile(
    r'(?<![\w-])([.#][A-Za-z_-][A-Za-z0-9_-]*)'
)

SUFFIX_PATTERN = re.compile(
    r'(?<![\w-])(-[A-Za-z_][A-Za-z0-9_-]*)'
)

CLASSLIST_PATTERN = re.compile(
    r'classList\s*\.\s*(?:add|remove|toggle|contains)\s*\(',
    re.IGNORECASE
)

BARE_CLASS_PATTERN = re.compile(
    r'^[A-Za-z_-][A-Za-z0-9_-]*$'
)

def extract_js_terms(path):
    """
    Extract CSS-like selectors from JavaScript strings.

    Supports:
        ".inventory-active"
        ".inventory-"
        "-selected"
        classList.add("inventory-active")
        className: "inventory-active"
        className: ".inventory-" + id
        className: `inventory-item-${type}`

    Returns:
        [(display_term, search_term, partial), ...]
    """

    try:
        source = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return []

    terms = []
    seen = set()

    def add_term(term, partial=None):

        term = term.strip()

        if not term:
            return

        if not term.startswith((".", "#")):
            term = "." + term

        if partial is None:
            partial = (
                term.endswith("-")
                or term.startswith("-")
            )

        key = (term.lower(), partial)

        if key in seen:
            return

        seen.add(key)

        terms.append((
            term,
            term,
            partial
        ))

    # --------------------------------------
    # className declarations
    # --------------------------------------

    class_name_pattern = re.compile(
        r'className\s*:\s*'
        r'(?P<quote>["\'`])'
        r'(?P<value>.*?)'
        r'(?P=quote)',
        re.DOTALL
    )

    for match in class_name_pattern.finditer(source):

        value = match.group("value").strip()

        # Template literals with interpolation.
        if "${" in value:
            value = value.split("${", 1)[0].strip()

            if value:
                add_term(value, partial=True)

            continue

        # Ordinary className strings.
        for selector in SELECTOR_PATTERN.findall(value):
            add_term(selector)

        if BARE_CLASS_PATTERN.fullmatch(value):
            add_term(value)

    # --------------------------------------
    # Other quoted JavaScript strings
    # --------------------------------------

    for match in STRING_PATTERN.finditer(source):

        value = match.group(2).strip()

        for selector in SELECTOR_PATTERN.findall(value):
            add_term(selector)

        for suffix in SUFFIX_PATTERN.findall(value):
            add_term(suffix)

        # Support classList.add/remove/toggle/contains.
        before = source[:match.start()]

        if CLASSLIST_PATTERN.search(before[-150:]):

            if BARE_CLASS_PATTERN.fullmatch(value):
                add_term(value)

    return terms

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
# JAVASCRIPT SEARCH MODE
# ==========================================

def search_from_js(js_path):

    if not js_path.is_file():
        print(f"JavaScript file not found: {js_path}")
        return 1

    terms = extract_js_terms(js_path)

    if not terms:
        print("No CSS selectors found in JavaScript.")
        return 1

    print("=== JS → CSS Search ===")
    print(f"Source: {js_path}")
    print()

    found = 0

    css_files = list(find_css_files(ROOT))

    for display_term, search_term, partial in terms:

        print(f"[JS: {display_term}]")

        if partial:
            print("(Partial match)")
        
        print()

        group_found = 0

        for path in css_files:

            results = search_js_term(
                path,
                search_term,
                partial
            )

            for line_number, content in results:

                print(f"{path}:{line_number}:")
                print(content)
                print()

                group_found += 1

        if not group_found:
            print("No matching CSS rules found.\n")

        found += group_found

    print(f"Found {found} matching block(s).")

    return 0 if found else 1


# ==========================================
# MAIN
# ==========================================

def main():

    if len(sys.argv) < 2:
        print("Usage:")
        print("  fcss .selector [another-selector]")
        print("  fcss -js filename.js")
        return 1

    # JavaScript search mode.
    if sys.argv[1].lower() == "-js":

        if len(sys.argv) != 3:
            print("Usage: fcss -js filename.js")
            return 1

        return search_from_js(Path(sys.argv[2]))

    # Existing CSS search mode.
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
