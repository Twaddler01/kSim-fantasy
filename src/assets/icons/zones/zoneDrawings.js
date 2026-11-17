import { addShapes } from "../svgHelpers.js";

// Registry — each zone is an object of variants.
// Zones without an entry here fall back to their dominant material icon
// (via getZoneIconMaterialId + MaterialIcon variant="zone").
//
// To author a place icon for a zone later, add it here:
//   whisperingMeadow: { default: drawWhisperingMeadow }
export const zoneDrawings = {};

export function getZoneDrawing(zoneId, variant = "default") {
    const entry = zoneDrawings[zoneId];
    if (!entry) return null;
    return entry[variant] ?? entry.default ?? null;
}

export function hasZoneDrawing(zoneId, variant = "default") {
    return getZoneDrawing(zoneId, variant) !== null;
}
