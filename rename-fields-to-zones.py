#!/usr/bin/env python3
"""
Field → Zone rename.

Run from the project root: python3 rename-fields-to-zones.py

Does:
1. git mv all files with "field" in their path
2. Replace all "field"-based identifiers, strings, and CSS classes in .js/.css
3. Word-boundary catch-all for remaining standalone "field"/"Field"/"FIELD"

Does NOT:
- Touch node_modules, releases/, mobile-dev-console/
- Migrate old save files (save key bumped to ksim-fantasy-v2 = fresh slate)
"""

import os
import re
import subprocess

os.chdir(os.path.expanduser("/data/data/com.termux/files/home/storage/shared/Documents/kSim-fantasy"))

# ============================================================
# 1. File renames
# ============================================================
RENAMES = [
    ("src/data/fields.js", "src/data/zones.js"),
    ("src/ui/panels/FieldScene.js", "src/ui/panels/ZoneScene.js"),
    ("src/ui/panels/FieldCanvas.js", "src/ui/panels/ZoneCanvas.js"),
    ("src/ui/panels/FieldWorkPanel.js", "src/ui/panels/WorldPanel.js"),
    ("src/ui/fieldIcons.js", "src/ui/zoneIcons.js"),
    ("src/domain/fieldHandlers.js", "src/domain/zoneHandlers.js"),
    ("src/assets/icons/fields/fieldDrawings.js", "src/assets/icons/zones/zoneDrawings.js"),
]

for old, new in RENAMES:
    if not os.path.exists(old):
        print(f"  SKIP {old} (not found)")
        continue
    os.makedirs(os.path.dirname(new), exist_ok=True)
    subprocess.run(["git", "mv", old, new], check=True)
    print(f"  mv {old} → {new}")

try:
    os.rmdir("src/assets/icons/fields")
    print("  rmdir src/assets/icons/fields")
except OSError:
    pass

# ============================================================
# 2. Identifier replacements — longest/most-specific first
# ============================================================
PAIRS = [
    # Compound identifiers with capital F (class names)
    ("FieldWorkPanel", "WorldPanel"),
    ("FieldScene", "ZoneScene"),
    ("FieldCanvas", "ZoneCanvas"),

    # Compound camelCase identifiers
    ("getFieldSpawnBreakdown", "getZoneSpawnBreakdown"),
    ("getFieldIconMaterialId", "getZoneIconMaterialId"),
    ("handleFieldOpenCache", "handleZoneOpenCache"),
    ("handleFieldEnterCave", "handleZoneEnterCave"),
    ("handleFieldEncounter", "handleZoneEncounter"),
    ("handleFieldGather", "handleZoneGather"),
    ("handleFieldUnlock", "handleZoneUnlock"),
    ("refreshFieldBackgrounds", "refreshZoneBackgrounds"),
    ("refreshFieldSprites", "refreshZoneSprites"),
    ("renderFieldMaterials", "renderZoneMaterials"),
    ("updateFieldSelectionBadge", "updateZoneSelectionBadge"),
    ("getFieldMaterials", "getZoneMaterials"),
    ("getMaterialField", "getMaterialZone"),
    ("createFieldHandlers", "createZoneHandlers"),
    ("fieldHandlers", "zoneHandlers"),
    ("updateFieldCards", "updateZoneCards"),
    ("getFieldDrawing", "getZoneDrawing"),
    ("hasFieldDrawing", "hasZoneDrawing"),
    ("renderActiveField", "renderActiveZone"),
    ("fieldSelectionButton", "zoneSelectionButton"),
    ("createFieldIcon", "createZoneIcon"),
    ("getFieldView", "getZoneView"),
    ("fieldDefinitions", "zoneDefinitions"),
    ("FIELD_DEFINITIONS", "ZONE_DEFINITIONS"),
    ("fieldDrawings", "zoneDrawings"),
    ("fieldWorkPanel", "worldPanel"),
    ("deactivateField", "deactivateZone"),
    ("activeFieldId", "activeZoneId"),
    ("activeField", "activeZone"),
    ("fieldViews", "zoneViews"),
    ("showField", "showZone"),
    ("fieldCards", "zoneCards"),
    ("fieldDebug", "zoneDebug"),
    ("createField", "createZone"),
    ("fieldId", "zoneId"),

    # Tab id / event prefix / unread keys
    ("\"fieldWork\"", "\"world\""),
    ("'fieldWork'", "'world'"),
    ("fieldWork", "world"),        # after fieldWorkPanel — safe
    ("\"field:", "\"zone:"),
    ("'field:", "'zone:"),
    ("`field:", "`zone:"),
    ("\"field-", "\"zone-"),
    ("`field-", "`zone-"),
    ("data-field-title", "data-zone-title"),
    ("fieldTitle", "zoneTitle"),

    # Journal type/category (used by getJournalEntry and catalog)
    ("\"fields\"", "\"zones\""),
    ("'fields'", "'zones'"),
    ("\"field\"", "\"zone\""),
    ("'field'", "'zone'"),

    # File paths (import statements)
    ("/fields.js", "/zones.js"),
    ("/FieldScene.js", "/ZoneScene.js"),
    ("/FieldCanvas.js", "/ZoneCanvas.js"),
    ("/FieldWorkPanel.js", "/WorldPanel.js"),
    ("/fieldIcons.js", "/zoneIcons.js"),
    ("/fieldHandlers.js", "/zoneHandlers.js"),
    ("/fieldDrawings.js", "/zoneDrawings.js"),
    ("icons/fields/", "icons/zones/"),
    ("/fields/", "/zones/"),

    # CSS classes derived from "field-work" tab → "world"
    ("field-work", "world"),
    ("field-selection", "zone-selection"),

    # UI strings (must come before word-boundary pass)
    ("FIELD WORK", "WORLD"),
    ("GATHERING LOCATIONS", "ZONES"),
    ("GATHERING FIELDS", "ZONES"),
    ("Select a Field", "Select a Zone"),
    ("Choose a field", "Choose a zone"),
    ("All Fields", "All Zones"),
    ("NEW FIELD AVAILABLE", "NEW ZONE DISCOVERED"),
    ("Fields", "Zones"),
]

WORD_REPLACEMENTS = [
    (re.compile(r"\bfield\b"), "zone"),
    (re.compile(r"\bField\b"), "Zone"),
    (re.compile(r"\bFIELD\b"), "ZONE"),
]

SKIP_DIRS = {".git", "node_modules", "releases", "mobile-dev-console", ".cache"}

def should_skip(path):
    parts = path.split(os.sep)
    return any(s in parts for s in SKIP_DIRS)

changed = []
for root, dirs, files in os.walk("."):
    if should_skip(root):
        continue
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    for fname in files:
        if not (fname.endswith(".js") or fname.endswith(".css")):
            continue
        path = os.path.join(root, fname)
        try:
            with open(path, "r") as fh:
                original = fh.read()
        except Exception:
            continue

        content = original
        for old, new in PAIRS:
            content = content.replace(old, new)
        for pattern, repl in WORD_REPLACEMENTS:
            content = pattern.sub(repl, content)

        if content != original:
            with open(path, "w") as fh:
                fh.write(content)
            changed.append(path)

print(f"\nModified {len(changed)} files:")
for f in sorted(changed):
    print(f"  {f}")
