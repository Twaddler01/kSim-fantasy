
# === kSim-fantasy ===
uk v0.4.7.6 "Renamed fields to zones"

# scripted HOW-TO
# regular commit: "update"
uk
# update commit only
uk "small update"
# update with tagging
uk v0.4.7.6 "Renamed fields to zones"
# update latest push to tag
uktag v0.4.7.6 "Renamed fields to zones"





# regular push
cd /data/data/com.termux/files/home/storage/shared/Documents/kSim-fantasy
git add .
git commit -m "migration: 2"
git push origin main

##################
# ── start a phase with BRANCH ──────────────────────────────────
cd /data/data/com.termux/files/home/storage/shared/Documents/kSim-fantasy
git status
git switch -c phase-4-3-character-stats

# ── TEST and VERIFY ─────────────────────────

# ── lock in progress (may repeat several times) ────
git add -A
git commit -m "4.3: character stats"

# ── merge to main + tag + push ─────────────────────
git switch main
git merge phase-4-3-character-stats
git tag v0.4.3
git branch -d phase-4-3-character-stats
git push --follow-tags

##################
# update NO BRANCH
cd /data/data/com.termux/files/home/storage/shared/Documents/kSim-fantasy
git add -A
git commit -m "4.1: add equipment blocks to crafted items"
git tag v0.4.1
git push --follow-tags



# COPY: rsync -av \
mkdir -p releases/v1.0.1
rsync -avn \
  --exclude='/.git/' \
  --exclude='/releases/' \
  --exclude='/node_modules/' \
  --exclude='/gitignored/' \
  --exclude='/LICENSE' \
  --exclude='/DevServer/' \
  --exclude='/_old/' \
  --exclude='/.gitignore' \
  --exclude='/code-dump.txt' \
  ./ releases/v1.0.1/
cd /data/data/com.termux/files/home/storage/shared/Documents/main-project/mobile-dev-console/releases/v1.0.1









directory: /data/data/com.termux/files/home/storage/shared/Documents/main-project
start_page: index.html



git tag -f v1.0.1 944c10f
git push --force origin refs/tags/v1.0.1




# === TERMUX ===

grep -rnE "NEW SYSTEM AVAILABLE: Fabricator" --include="*.js" .

multiple...

grep -rnE "effects.js" --include="*.js" .
grep -rnE "toast" --include="*.css" .

# sed line range
sed -n 'START,ENDp' styles/styles.css

# MORE:
# Include line numbers
grep -n "function" main.js
# Case-insensitive
grep -in "function" main.js
# Search recursively through JS files
grep -rn -C 6 -E "craftRecipe|applyEffects" .
grep -rn -C 1 \
    --color=always \
    --group-separator="----------" \
    -E "synthesis|inventory" . \
    --include="*.css"

# CUSTOM:

fc src/ui/Badge.js src/ui/CollapsiblePanel.js src/ui/SynthesisPanel.js styles.css

fc -clip src/ui/Badge.js src/ui/CollapsiblePanel.js src/ui/SynthesisPanel.js styles.css

fc -log src/ui/Badge.js src/ui/CollapsiblePanel.js src/ui/SynthesisPanel.js styles.css

fc -clip -log "styles" "badge"

fc SynthesisEngine.js src/triggers/effects.js -clip


fc -clip data.js functions.js EventProcessor.js SaveManager.js


# TEMP RUNS

grep -RIn 'panel' \
  --include="*.css" \
  --exclude-dir=node_modules \
  --exclude-dir=mobile-dev-console \
  .






grep -rn "unread\|badge" styles/styles.css --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=mobile-dev-console --exclude-dir=ideas --exclude-dir=debug




git mv src/ui/panels/GatheringField.js src/ui/panels/FieldWorkPanel.js

grep -IlRZ \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=mobile-dev-console \
  --exclude-dir=ideas \
  --exclude-dir=debug \
  "GatheringField" . |
xargs -0 -r sed -i 's/GatheringField/FieldWorkPanel/g'




fc -clip FieldCanvas.js FieldScene.js FieldWorkPanel.js




port: 8080
directory: /data/data/com.termux/files/home/projects/kSim-mobile
start_page: index.html
folder_listing: false
disable_cache: true
live_reload: true
exclude_git: true
launch_browser: true
browser_package: org.mozilla.firefox



fc src/data/zones.js \
src/data/initialGameData.js \
src/ui/panels/ZoneCanvas.js \
src/ui/navigation/Tabs/Tabs.js 




# WorldPanel remaining lifecycle
sed -n '120,250p' src/ui/panels/WorldPanel.js
# Character update and surrounding methods
sed -n '385,430p' src/ui/panels/Character.js
# Inventory update and surrounding methods
sed -n '175,235p' src/ui/panels/Inventory.js

grep -nE "class WorldMapPanel|constructor|getElement|update\\(" \
  src/ui/panels/WorldMapPanel.js



