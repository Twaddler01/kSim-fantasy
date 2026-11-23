
uk() {
    # ========================================
    # CONFIGURATION
    # ========================================

    local project="$HOME/storage/shared/Documents/kSim-fantasy"

    # ========================================
    # ARGUMENTS
    # ========================================

    local version=""
    local description=""
    local message=""

    # Version mode: uk v0.4.7.6 "Description"
    if [[ $# -ge 2 && "$1" =~ ^v[0-9]+([.][0-9A-Za-z-]+)*$ ]]; then
        version="$1"
        shift
        description="$*"
        message="$version - $description"

    # Regular commit mode
    else
        message="${*:-update}"
    fi

    # ========================================
    # ENTER PROJECT
    # ========================================

    cd "$project" || {
        echo "ERROR: Could not enter project directory."
        return 1
    }

    # ========================================
    # DETECT CURRENT BRANCH
    # ========================================
    
    local branch
    branch="$(git branch --show-current)"
    
    if [[ -z "$branch" ]]; then
        echo "ERROR: Detached HEAD. Switch to a branch first."
        return 1
    fi
    
    echo "BRANCH: $branch"

    # ========================================
    # CHECK TAG
    # ========================================

    if [[ -n "$version" ]] && git rev-parse -q --verify "refs/tags/$version" >/dev/null; then
        echo "ERROR: Tag already exists: $version"
        return 1
    fi

    echo
    echo "================================"
    echo "       kSim-FANTASY UPDATE"
    echo "================================"
    echo

    if [[ -n "$version" ]]; then
        echo "VERSION:     $version"
        echo "DESCRIPTION: $description"
    else
        echo "UNTAGGED UPDATE"
    fi

    echo

    # ========================================
    # STAGE CHANGES
    # ========================================

    git add -A || {
        echo "ERROR: Git add failed."
        return 1
    }

    if git diff --cached --quiet; then
        echo "No changes to commit."
        git status --short --branch
        return 0
    fi

    # ========================================
    # CHANGE SUMMARY
    # ========================================

    echo "FILES UPDATED"
    echo "--------------------------------"
    git diff --cached --name-status

    echo
    echo "CHANGE SUMMARY"
    echo "--------------------------------"
    git diff --cached --stat

    # ========================================
    # COMMIT
    # ========================================

    echo
    echo "COMMITTING: $message"
    echo "--------------------------------"

    git commit -m "$message" || {
        echo "ERROR: Git commit failed."
        return 1
    }

    # ========================================
    # CREATE ANNOTATED TAG
    # ========================================

    if [[ -n "$version" ]]; then
        echo
        echo "CREATING TAG: $version"
        echo "--------------------------------"

        git tag -a "$version" -m "$description" || {
            echo "ERROR: Tag creation failed."
            return 1
        }
    fi

    # ========================================
    # PUSH COMMIT
    # ========================================

    echo "PUSHING TO ORIGIN/$branch..."
    echo "--------------------------------"
    
    git push -u origin "$branch" || {
        echo "ERROR: Push failed. Commit is saved locally."
        return 1
    }

    # ========================================
    # PUSH TAG
    # ========================================

    if [[ -n "$version" ]]; then
        echo
        echo "PUSHING TAG: $version"
        echo "--------------------------------"

        git push origin "$version" || {
            echo "ERROR: Tag push failed. Tag remains local."
            return 1
        }
    fi

    # ========================================
    # FINAL SUMMARY
    # ========================================

    echo
    echo "================================"
    echo "       UPDATE SUCCESSFUL"
    echo "================================"

    echo
    echo "LATEST COMMIT:"
    git log -1 --oneline

    if [[ -n "$version" ]]; then
        echo
        echo "LATEST TAG:"
        git show -s --format='%h %s%nTag message: %N' "$version"
    fi

    echo
    echo "REPOSITORY STATUS:"
    git status --short --branch

    echo
    echo "================================"
}

uktag() {
    local version="$1"
    shift
    local description="$*"

    if [[ -z "$version" || -z "$description" ]]; then
        echo 'Usage: uktag v0.4.7.6 "Description"'
        return 1
    fi

    cd "$HOME/storage/shared/Documents/kSim-fantasy" || return 1

    if git rev-parse -q --verify "refs/tags/$version" >/dev/null; then
        echo "ERROR: Tag already exists: $version"
        return 1
    fi

    git tag -a "$version" -m "$description" &&
    git push origin "$version"
}