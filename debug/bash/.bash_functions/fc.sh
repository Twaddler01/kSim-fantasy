
fc() {
    # ========================================
    # CONFIGURATION
    # ========================================

    local -a allowed_extensions=("js" "css" "html")
    local -a excluded_dirs=(".git" "mobile-dev-console")

    # ========================================
    # SETTINGS / VARIABLES
    # ========================================

    local save_log=false
    local copy_clip=false
    local recursive=false
    local filename file search_path
    local failed=0
    local log_file="$HOME/fc-output.txt"
    local temp_file
    local ext folder

    local -a files=()
    local -a results=()
    local -a matches=()
    local -a candidates=()
    local -a prune_names=()

    # ========================================
    # HELPER: CHECK FILE FILTERS
    # ========================================

    is_allowed_file() {
        local path="${1,,}"
        local ext="${path##*.}"
        local allowed=false
        local folder

        # Check allowed extensions
        for folder in "${allowed_extensions[@]}"; do
            if [[ "$ext" == "$folder" ]]; then
                allowed=true
                break
            fi
        done

        [[ "$allowed" == false ]] && return 1

        # Check excluded directories
        for folder in "${excluded_dirs[@]}"; do
            case "/$path/" in
                *"/${folder,,}/"*)
                    return 1
                    ;;
            esac
        done

        return 0
    }

    # ========================================
    # BUILD DIRECTORY EXCLUSIONS
    # ========================================

    for folder in "${excluded_dirs[@]}"; do
        prune_names+=(-iname "$folder" -o)
    done

    # Remove trailing -o
    prune_names=("${prune_names[@]:0:${#prune_names[@]}-1}")

    # ========================================
    # PARSE OPTIONS
    # ========================================

    for arg in "$@"; do
        case "$arg" in
            -log)  save_log=true ;;
            -clip) copy_clip=true ;;
            -r)    recursive=true ;;
            *)     files+=("$arg") ;;
        esac
    done

    if [[ ${#files[@]} -eq 0 ]]; then
        cat <<'EOF'
Usage: fc [options] filename [...]

Options:
  -log     Save output to ~/fc-output.txt
  -clip    Copy output to Android clipboard
  -r       Include subdirectories when using .

File filters:
  .js, .css, .html only
  Excludes .git/
  Excludes mobile-dev-console/
  Skips binary files

Examples:
  fc main.js
  fc SynthesisEngine
  fc inventory styles badge
  fc -clip .
  fc -r -clip .
  fc -log -clip .
EOF
        return 0
    fi

    # ========================================
    # CLIPBOARD REQUIREMENTS
    # ========================================

    if [[ "$copy_clip" == true ]] &&
        ! command -v termux-clipboard-set &>/dev/null; then

        echo
        echo "ERROR: Clipboard support is not installed."
        echo
        echo "The -clip option requires:"
        echo "  1. Termux:API Android app"
        echo "  2. termux-api package in Termux"
        echo
        echo "Install with: pkg install termux-api"
        echo
        return 1
    fi

    temp_file=$(mktemp) || return 1

    # ========================================
    # SEARCH FILES
    # ========================================

    {
        for filename in "${files[@]}"; do
            matches=()
            candidates=()

            # --------------------------------
            # SPECIAL: COLLECT ALL FILES
            # --------------------------------

            if [[ "$filename" == "." || "$filename" == "./" ]]; then

                if [[ "$recursive" == true ]]; then

                    while IFS= read -r file; do
                        candidates+=("$file")
                    done < <(
                        find . \
                            \( -type d \( "${prune_names[@]}" \) -prune \) -o \
                            -type f -print 2>/dev/null
                    )

                else

                    while IFS= read -r file; do
                        candidates+=("$file")
                    done < <(
                        find . -maxdepth 1 -type f -print 2>/dev/null
                    )

                fi

            # --------------------------------
            # DIRECT PATH
            # --------------------------------

            elif [[ -f "$filename" ]]; then
                candidates+=("$filename")

            # --------------------------------
            # EXACT RELATIVE PATH SEARCH
            # --------------------------------

            elif [[ "$filename" == */* ]]; then
                search_path="${filename#./}"

                while IFS= read -r file; do
                    candidates+=("$file")
                done < <(
                    find . \
                        \( -type d \( "${prune_names[@]}" \) -prune \) -o \
                        -type f -iwholename "./$search_path" -print \
                        2>/dev/null
                )

            # --------------------------------
            # FILENAME SEARCH
            # --------------------------------

            else
                while IFS= read -r file; do
                    candidates+=("$file")
                done < <(
                    find . \
                        \( -type d \( "${prune_names[@]}" \) -prune \) -o \
                        -type f -iname "$filename" -print \
                        2>/dev/null
                )
            fi

            # =================================
            # APPLY FILE FILTERS
            # =================================

            for file in "${candidates[@]}"; do
                if is_allowed_file "$file"; then
                    matches+=("$file")
                fi
            done

            # =================================
            # EXTENSION-INDEPENDENT FALLBACK
            # =================================

            if [[ ${#matches[@]} -eq 0 &&
                  "$filename" != "." &&
                  "$filename" != "./" &&
                  ! -f "$filename" &&
                  "$filename" != */* ]]; then

                candidates=()

                while IFS= read -r file; do
                    candidates+=("$file")
                done < <(
                    find . \
                        \( -type d \( "${prune_names[@]}" \) -prune \) -o \
                        -type f -iname "$filename.*" -print \
                        2>/dev/null
                )

                for file in "${candidates[@]}"; do
                    if is_allowed_file "$file"; then
                        matches+=("$file")
                    fi
                done
            fi

            # =================================
            # NOT FOUND
            # =================================

            if [[ ${#matches[@]} -eq 0 ]]; then
                echo
                echo "===== cat $filename"
                echo
                echo "[ No matching files found ]"

                results+=("NOT FOUND: $filename")
                failed=1
                continue
            fi

            # =================================
            # OUTPUT MATCHING FILES
            # =================================

            for file in "${matches[@]}"; do

                # Skip binary files
                if [[ -s "$file" ]] &&
                    ! grep -Iq . "$file" 2>/dev/null; then

                    results+=("SKIPPED (binary): $file")
                    continue
                fi

                echo
                echo "===== cat $file"
                echo

                if cat -- "$file"; then
                    results+=("OK: $file")
                else
                    results+=("ERROR: $file")
                    failed=1
                fi

                echo
            done
        done
    } > "$temp_file"

    # ========================================
    # DISPLAY OUTPUT
    # ========================================

    cat "$temp_file"

    # ========================================
    # SAVE LOG
    # ========================================

    if [[ "$save_log" == true ]]; then
        if cp "$temp_file" "$log_file"; then
            echo "Saved: $log_file" >&2
        else
            echo "ERROR: Could not save log." >&2
            failed=1
        fi
    fi

    # ========================================
    # CLIPBOARD
    # ========================================

    if [[ "$copy_clip" == true ]]; then
        if termux-clipboard-set < "$temp_file"; then
            echo "Copied to Android clipboard." >&2
        else
            echo "ERROR: Clipboard operation failed." >&2
            echo "Check Termux:API Android app." >&2
            failed=1
        fi
    fi

    rm -f "$temp_file"

    # ========================================
    # RESULTS
    # ========================================

    echo
    echo "========== RESULTS =========="

    for file in "${results[@]}"; do
        echo "$file"
    done

    echo "============================="

    return "$failed"
}

