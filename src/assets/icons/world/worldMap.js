import { addShapes } from "../svgHelpers.js";

// Stylized valley map. viewBox is 400×280 (10:7) to match the
// WorldMapPanel container. Pins are positioned by percentage, so
// SVG elements and pins scale together.

function drawValley(svg) {
    addShapes(svg, [
        // Base terrain
        { tag: "rect", attrs: { width: 400, height: 280, fill: "#0e1710" } },

        // Distant hills (back)
        {
            tag: "path",
            attrs: {
                d: "M0 110 Q40 85 80 95 Q120 70 160 85 Q200 60 240 80 Q280 55 320 75 Q360 60 400 70 L400 280 L0 280 Z",
                fill: "#16211a"
            }
        },

        // Mid hills
        {
            tag: "path",
            attrs: {
                d: "M0 160 Q40 135 90 145 Q140 120 190 135 Q240 115 290 130 Q340 115 400 125 L400 280 L0 280 Z",
                fill: "#1f2a1e"
            }
        },

        // Foreground hills
        {
            tag: "path",
            attrs: {
                d: "M0 210 Q60 185 130 195 Q200 175 270 190 Q340 175 400 185 L400 280 L0 280 Z",
                fill: "#293625"
            }
        },

        // Stream
        {
            tag: "path",
            attrs: {
                d: "M0 200 Q60 195 120 205 Q180 220 240 210 Q320 195 400 205",
                fill: "none",
                stroke: "#2a4560",
                "stroke-width": 5,
                opacity: 0.55
            }
        },

        // Grassland (Whispering Meadow area, ~35% / 73%)
        {
            tag: "ellipse",
            attrs: {
                cx: 130,
                cy: 205,
                rx: 70,
                ry: 40,
                fill: "#3a5230",
                opacity: 0.7
            }
        },
        {
            tag: "ellipse",
            attrs: {
                cx: 130,
                cy: 205,
                rx: 45,
                ry: 26,
                fill: "#4a6240",
                opacity: 0.55
            }
        },

        // Rocky outcrop (Ironhollow Mine area, ~75% / 38%)
        {
            tag: "path",
            attrs: {
                d: "M260 95 L282 78 L308 88 L326 80 L345 95 L338 122 L302 138 L272 128 Z",
                fill: "#3a3630",
                stroke: "#504a44",
                "stroke-width": 1
            }
        },
        {
            tag: "path",
            attrs: { d: "M282 78 L300 100 L275 110 Z", fill: "#4a4540" }
        },
        {
            tag: "path",
            attrs: { d: "M326 80 L330 105 L305 115 Z", fill: "#4a4540" }
        },
        {
            tag: "path",
            attrs: {
                d: "M308 88 L315 108 L295 118 Z",
                fill: "#5a5550",
                opacity: 0.5
            }
        },

        // Dirt path connecting the two regions
        {
            tag: "path",
            attrs: {
                d: "M140 200 Q180 175 220 145 Q255 120 290 105",
                fill: "none",
                stroke: "#5a4530",
                "stroke-width": 2,
                "stroke-dasharray": "5 4",
                opacity: 0.55
            }
        },

        // Trees (scattered)
        { tag: "circle", attrs: { cx: 75, cy: 180, r: 5, fill: "#1a3a2a" } },
        { tag: "circle", attrs: { cx: 100, cy: 225, r: 6, fill: "#1a3a2a" } },
        { tag: "circle", attrs: { cx: 160, cy: 185, r: 4, fill: "#1a3a2a" } },
        { tag: "circle", attrs: { cx: 55, cy: 215, r: 4, fill: "#1a3a2a" } },
        { tag: "circle", attrs: { cx: 195, cy: 220, r: 5, fill: "#1a3a2a" } },
        { tag: "circle", attrs: { cx: 340, cy: 200, r: 4, fill: "#1a3a2a" } },
        { tag: "circle", attrs: { cx: 370, cy: 230, r: 5, fill: "#1a3a2a" } },

        // Compass rose (top-right)
        {
            tag: "circle",
            attrs: {
                cx: 360,
                cy: 40,
                r: 14,
                fill: "rgba(15, 22, 16, 0.6)",
                stroke: "#5a6050",
                "stroke-width": 1,
                opacity: 0.7
            }
        },
        {
            tag: "path",
            attrs: {
                d: "M360 28 L362 36 L370 40 L362 44 L360 52 L358 44 L350 40 L358 36 Z",
                fill: "#7a8070",
                opacity: 0.8
            }
        },

        // Inner border
        {
            tag: "rect",
            attrs: {
                x: 2,
                y: 2,
                width: 396,
                height: 276,
                fill: "none",
                stroke: "#3a4a35",
                "stroke-width": 1.5,
                opacity: 0.4,
                rx: 4
            }
        }
    ]);
}

export const worldDrawings = {
    valley: { default: drawValley }
};

export function getWorldDrawing(worldId, variant = "default") {
    const entry = worldDrawings[worldId];
    if (!entry) return null;
    return entry[variant] ?? entry.default ?? null;
}
