#!/usr/bin/env python3
"""
Finish field→zone rename: catch identifiers the first script missed.
Safe to run more than once.
"""
import os

os.chdir(os.path.expanduser("/data/data/com.termux/files/home/storage/shared/Documents/kSim-fantasy"))

PAIRS = [
    # Cross-file prop contract: WorldPanel ↔ WorldMapPanel.
    # These two must change together — the script keeps them in sync.
    ("onSelectField", "onSelectZone"),

    # Local variables
    ("fieldView", "zoneView"),
    ("fieldEntries", "zoneEntries"),

    # Methods / helpers
    ("renderFieldRelationships", "renderZoneRelationships"),
    ("getFieldUnlock", "getZoneUnlock"),

    # Function names in the material drawing registry.
    # The registry keys became `zone:` but the function bodies kept
    # their old names — normalize them.
    ("drawStoneField", "drawStoneZone"),
    ("drawQuartzField", "drawQuartzZone"),
    ("drawCopperField", "drawCopperZone"),

    # Comment
    ("gathered from fields", "gathered from zones"),
]

SKIP_DIRS = {
    ".git", "node_modules", "releases", "mobile-dev-console",
    "formulas",  # dead asset
}

changed = []
for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    for fname in files:
        if not fname.endswith(".js"):
            continue
        path = os.path.join(root, fname)
        try:
            with open(path) as fh:
                orig = fh.read()
        except Exception:
            continue

        content = orig
        for old, new in PAIRS:
            content = content.replace(old, new)

        if content != orig:
            with open(path, "w") as fh:
                fh.write(content)
            changed.append(path)

print(f"Modified {len(changed)} files:")
for f in sorted(changed):
    print(f"  {f}")
