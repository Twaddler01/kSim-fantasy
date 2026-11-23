
#!/data/data/com.termux/files/usr/bin/bash

# ks - Recursive, case-insensitive literal search

ks() {
    if [[ $# -eq 0 ]]; then
        echo 'Usage: ks "search phrase" ["another phrase" ...]'
        return 1
    fi

    local -a patterns=()

    for term in "$@"; do
        patterns+=(-e "$term")
    done

    echo "=== kSim Search ==="
    printf 'Searching: %s\n' "$*"
    echo

    grep -RniF --color=always \
        --include='*.js' \
        --include='*.css' \
        --include='*.html' \
        --exclude-dir=.git \
        --exclude-dir=node_modules \
        --exclude-dir=mobile-dev-console \
        --exclude-dir=ideas \
        --exclude-dir=debug \
        "${patterns[@]}" \
        .

    local result=$?

    if [[ $result -eq 1 ]]; then
        echo "No matches found."
    elif [[ $result -gt 1 ]]; then
        echo "Search encountered an error."
    fi

    return "$result"
}
