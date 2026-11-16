// src/data/caves.js
//
// Cave definitions. A cave is a POI: tapping it opens a narrative modal.
// v1 caves are single-room: narrative + a one-time loot search per session.
// Multi-room dungeons (replacing the modal with a nested FieldScene) come
// in a later phase — the data shape here is designed to accommodate that
// without changing how caves are spawned or interacted with.

export const caveDefinitions = [
    {
        id: "whisperingCave",
        name: "Whispering Cave",
        icon: "🕳️",
        description:
            "A narrow gap in the rock at the meadow's edge. Cold air moves through it, carrying a sound that could be water — or something else.",
        lootTableId: "whisperingCaveLoot",
        searchNarrative:
            "You slip inside. The walls are damp and dark, and something glints in the far corner."
    }
];

export function getCave(caveId) {
    return caveDefinitions.find(c => c.id === caveId) ?? null;
}
