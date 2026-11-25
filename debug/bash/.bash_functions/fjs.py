
#!/usr/bin/env python3

"""
fjs - JavaScript function and class method finder

Usage:
    fjs calculateDamage
    fjs calculateDamage getDistance attack
    fjs -C CalculateDamage

Search behavior:
    Default: Case-insensitive
    -C:      Case-sensitive

Supported:
    Regular named functions
    Exported functions
    Async functions
    Generator functions
    Class methods
    Static methods
    Private methods
    Getters and setters
"""

import re
import sys
from pathlib import Path


# ==========================================
# CONFIGURATION
# ==========================================

ROOT = Path(".")

EXCLUDED_DIRS = {
    ".git",
    "node_modules",
    "mobile-dev-console",
    "ideas",
    "debug",
}


# ==========================================
# SOURCE MASKING
# ==========================================

def mask_non_code(source):
    """
    Mask comments and strings while preserving
    character positions and newlines.
    """

    chars = list(source)
    i = 0
    state = None

    while i < len(source):

        char = source[i]
        next_char = (
            source[i + 1]
            if i + 1 < len(source)
            else ""
        )

        if state == "line_comment":

            if char == "\n":
                state = None
            else:
                chars[i] = " "

        elif state == "block_comment":

            if char == "*" and next_char == "/":
                chars[i] = " "
                chars[i + 1] = " "
                i += 2
                state = None
                continue

            if char != "\n":
                chars[i] = " "

        elif state in ("'", '"', "`"):

            if char == "\\":
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

            if char == "/" and next_char == "/":
                chars[i] = " "
                chars[i + 1] = " "
                i += 2
                state = "line_comment"
                continue

            if char == "/" and next_char == "*":
                chars[i] = " "
                chars[i + 1] = " "
                i += 2
                state = "block_comment"
                continue

            if char in ("'", '"', "`"):
                state = char
                chars[i] = " "

        i += 1

    return "".join(chars)


# ==========================================
# BRACE MATCHING
# ==========================================

def find_brace_pairs(masked):

    stack = []
    pairs = {}

    for i, char in enumerate(masked):

        if char == "{":
            stack.append(i)

        elif char == "}" and stack:

            opening = stack.pop()
            pairs[opening] = i

    return pairs


def find_matching_paren(masked, opening):

    depth = 0

    for i in range(opening, len(masked)):

        if masked[i] == "(":
            depth += 1

        elif masked[i] == ")":
            depth -= 1

            if depth == 0:
                return i

    return None


# ==========================================
# FUNCTION DECLARATIONS
# ==========================================

def search_declarations(masked, source, pairs, terms, case_sensitive):

    results = []

    for term in terms:

        flags = 0 if case_sensitive else re.IGNORECASE

        pattern = re.compile(
            r"(?:(?:export)\s+(?:default\s+)?)?"
            r"(?:async\s+)?"
            r"function\s*\*?\s+"
            + re.escape(term)
            + r"\s*\(",
            flags
        )

        for match in pattern.finditer(masked):

            # Avoid common function expressions.
            previous = match.start() - 1

            while previous >= 0 and masked[previous].isspace():
                previous -= 1

            if previous >= 0:
                if masked[previous] not in ";{}":
                    continue

            opening = masked.find(
                "(",
                match.start(),
                match.end()
            )

            closing = find_matching_paren(
                masked,
                opening
            )

            if closing is None:
                continue

            body = closing + 1

            while body < len(masked) and masked[body].isspace():
                body += 1

            if body >= len(masked) or masked[body] != "{":
                continue

            end = pairs.get(body)

            if end is None:
                continue

            results.append((
                match.start(),
                end + 1
            ))

    return results


# ==========================================
# CLASS DISCOVERY
# ==========================================

def find_class_ranges(masked, pairs):

    ranges = []

    for match in re.finditer(r"\bclass\b", masked):

        i = match.end()
        parens = 0
        brackets = 0

        while i < len(masked):

            char = masked[i]

            if char == "(":
                parens += 1

            elif char == ")":
                parens -= 1

            elif char == "[":
                brackets += 1

            elif char == "]":
                brackets -= 1

            elif char == "{" and parens == 0 and brackets == 0:

                end = pairs.get(i)

                if end is not None:
                    ranges.append((i, end))

                break

            elif char == ";" and parens == 0 and brackets == 0:
                break

            i += 1

    return ranges


# ==========================================
# CLASS METHODS
# ==========================================

def search_class_methods(masked, classes, pairs, terms, case_sensitive):

    results = []

    flags = 0 if case_sensitive else re.IGNORECASE

    for class_start, class_end in classes:

        i = class_start + 1

        while i < class_end:

            # Skip whitespace and masked comments.
            while i < class_end and masked[i].isspace():
                i += 1

            if i >= class_end:
                break

            # Match a method beginning at this class level.
            match = re.match(
                r"(?:(?:static|async|get|set)\s+)*"
                r"\*?\s*"
                r"(#?[A-Za-z_$][\w$]*)"
                r"\s*\(",
                masked[i:class_end],
                flags
            )

            if match:

                name = match.group(1)

                if any(
                    name.lower() == term.lower()
                    if not case_sensitive
                    else name == term
                    for term in terms
                ):

                    opening = i + match.end() - 1

                    closing = find_matching_paren(
                        masked,
                        opening
                    )

                    if closing is not None:

                        body = closing + 1

                        while (
                            body < class_end
                            and masked[body].isspace()
                        ):
                            body += 1

                        if body < class_end and masked[body] == "{":

                            end = pairs.get(body)

                            if end is not None and end <= class_end:

                                results.append((
                                    i,
                                    end + 1
                                ))

                                i = end + 1
                                continue

            # Skip nested blocks, including method bodies
            # and object literals in class fields.
            if masked[i] == "{":

                end = pairs.get(i)

                if end is not None:
                    i = end + 1
                    continue

            i += 1

    return results


# ==========================================
# SEARCH FILE
# ==========================================

def search_file(path, terms, case_sensitive):

    try:
        source = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return []

    masked = mask_non_code(source)
    pairs = find_brace_pairs(masked)

    classes = find_class_ranges(masked, pairs)

    results = search_declarations(
        masked,
        source,
        pairs,
        terms,
        case_sensitive
    )

    results.extend(
        search_class_methods(
            masked,
            classes,
            pairs,
            terms,
            case_sensitive
        )
    )

    # Remove duplicate results and sort by source position.
    results = sorted(set(results))

    output = []

    for start, end in results:

        line_number = source.count("\n", 0, start) + 1

        content = source[start:end]

        output.append((
            line_number,
            content
        ))

    return output


# ==========================================
# FILE DISCOVERY
# ==========================================

def find_js_files(root):

    for path in sorted(root.rglob("*.js")):

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

    args = sys.argv[1:]

    case_sensitive = False

    if args and args[0] == "-C":
        case_sensitive = True
        args.pop(0)

    if not args:
        print("Usage: fjs [-C] function1 [function2 ...]")
        return 1

    terms = args

    print("=== JavaScript Function Search ===")
    print(
        "Case-sensitive:" if case_sensitive
        else "Case-insensitive:",
        "Yes" if case_sensitive else "No"
    )
    print("Searching:", ", ".join(terms))
    print()

    found = 0

    for path in find_js_files(ROOT):

        results = search_file(
            path,
            terms,
            case_sensitive
        )

        for line_number, content in results:

            print(f"{path}:{line_number}:")
            print(content)
            print()

            found += 1

    if not found:
        print("No matching functions found.")
        return 1

    print(f"Found {found} matching function(s).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
