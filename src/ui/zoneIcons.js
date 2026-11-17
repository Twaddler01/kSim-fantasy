import { createSvgElement } from "../assets/icons/svgHelpers.js";
import { MaterialIcon } from "../assets/icons/materials/MaterialIcon.js";
import { getZoneDrawing } from "../assets/icons/zones/zoneDrawings.js";
import { getZoneIconMaterialId } from "../data/zones.js";

/**
 * Resolution chain:
 *   1. zoneDrawings[zone.id][variant]  — authored place icon
 *   2. material `zone` variant          — dominant-material fallback
 *   3. zone.icon (emoji)                — last-resort for legacy
 */
export function createZoneIcon(
    zone,
    { size = 32, className = "", variant = "default" } = {}
) {
    const draw = getZoneDrawing(zone.id, variant);

    if (draw) {
        const svg = createSvgElement("svg", {
            xmlns: "http://www.w3.org/2000/svg",
            viewBox: "0 0 48 48",
            width: size,
            height: size,
            preserveAspectRatio: "xMidYMid meet",
            "aria-hidden": "true",
            focusable: "false",
            class: ["zone-icon", className].filter(Boolean).join(" ")
        });
        draw(svg);
        return svg;
    }

    const materialId = getZoneIconMaterialId(zone);
    if (materialId) {
        return MaterialIcon(materialId, {
            size,
            variant: "zone",
            className: ["zone-icon", className].filter(Boolean).join(" ")
        });
    }

    const span = document.createElement("span");
    span.className = ["zone-icon", "zone-icon--fallback", className]
        .filter(Boolean)
        .join(" ");
    span.setAttribute("aria-hidden", "true");
    span.textContent = zone.icon ?? "◈";
    return span;
}
