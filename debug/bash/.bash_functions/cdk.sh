# ========================================
# KSIM-FANTASY PROJECT
# ========================================

KSIM_FANTASY_PATH="$HOME/storage/shared/Documents/kSim-fantasy"

# Navigate to project
cdk() {
    cd "$KSIM_FANTASY_PATH" || {
        echo "ERROR: Could not enter kSim-fantasy."
        return 1
    }
}


