import { addShapes } from "../svgHelpers.js";

// Registry — each field is an object of variants.
// Fields without an entry here fall back to their dominant material icon
// (via getFieldIconMaterialId + MaterialIcon variant="field").
//
// To author a place icon for a field later, add it here:
//   whisperingMeadow: { default: drawWhisperingMeadow }
export const fieldDrawings = {};

export function getFieldDrawing(fieldId, variant = "default") {
    const entry = fieldDrawings[fieldId];
    if (!entry) return null;
    return entry[variant] ?? entry.default ?? null;
}

export function hasFieldDrawing(fieldId, variant = "default") {
    return getFieldDrawing(fieldId, variant) !== null;
}
