// src/ui/panels/TownScene.js
//
// Town-specific scene adapter.
//
// TownScene owns:
//   - Town background rendering (ground, decorations, square, buildings, fountain)
//   - Building door placement as POI entities
//   - Per-building interaction messages
//
// ZoneCanvas owns:
//   - Camera, player, input, interaction ring rendering, hit detection

import ZoneCanvas from "./ZoneCanvas.js";
import { TOWN_DEFINITIONS } from "../../data/towns.js";

export default class TownScene {
    constructor({ zone, showToast }) {
        this.zone = zone;
        this.showToast = showToast ?? (() => {});

        this.town = TOWN_DEFINITIONS.find(town => town.id === zone.townId);

        if (!this.town) {
            throw new Error(
                `TownScene: No town definition found for "${zone.townId}".`
            );
        }

        this.world = this.town.world;
        this.backgroundCanvas = this.buildBackground();

        this.canvas = new ZoneCanvas({
            entities: this.buildObjects(),
            world: this.world,
            backgroundCanvas: this.backgroundCanvas,
            title: this.town.name,
            onInteract: (entity, screenPos) =>
                this.handleInteract(entity, screenPos)
        });
    }

    getElement() {
        return this.canvas.getElement();
    }

    update() {
        this.canvas.update();
    }

    deactivate() {
        this.canvas.deactivate();
    }

    // ==================================================
    // INTERACTION OBJECTS
    // ==================================================

    buildObjects() {
        return this.town.buildings.map(building => ({
            id: building.id,
            type: "poi",
            label: building.label,

            // Interaction point is on the door.
            x: building.interaction.x,
            y: building.interaction.y,
            r: building.interaction.r ?? 28,

            icon: building.interaction.icon,
            message: building.interaction.message,

            // Universal indicator: green ring over the door.
            showInteractionIndicator: true,

            strikesRequired: 1,
            respawnSeconds: null
        }));
    }

    handleInteract(entity) {
        this.showToast(
            entity.message ?? `${entity.label} is not available yet.`
        );

        // POIs persist — the door is always there.
        return false;
    }

    // ==================================================
    // BACKGROUND
    // ==================================================

    buildBackground() {
        const { width, height } = this.world;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        // --------------------------------------------------
        // Base ground
        // --------------------------------------------------

        ctx.fillStyle = "#536447";
        ctx.fillRect(0, 0, width, height);

        // Subtle grass variation.
        let seed = 12345;

        const random = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        };

        for (let i = 0; i < 650; i++) {
            const x = random() * width;
            const y = random() * height;

            ctx.fillStyle =
                random() > 0.5
                    ? "rgba(170,190,115,0.12)"
                    : "rgba(25,45,25,0.12)";

            ctx.fillRect(x, y, 3, 3);
        }

        // --------------------------------------------------
        // Decorations (trees, bushes) — drawn before the square
        // and buildings so they sit behind them.
        // --------------------------------------------------

        this.drawDecorations(ctx);

        // --------------------------------------------------
        // Central town square
        // --------------------------------------------------

        this.drawSquare(ctx, this.town.square);

        // --------------------------------------------------
        // Buildings
        // --------------------------------------------------

        for (const building of this.town.buildings) {
            this.drawBuilding(ctx, building);
        }

        // --------------------------------------------------
        // Central fountain
        // --------------------------------------------------

        this.drawFountain(ctx, 600, 455);

        return canvas;
    }

    // ==================================================
    // DECORATIONS
    // ==================================================

    drawDecorations(ctx) {
        for (const decoration of this.town.decorations ?? []) {
            switch (decoration.type) {
                case "tree":
                    this.drawTree(ctx, decoration);
                    break;
                case "bush":
                    this.drawBush(ctx, decoration);
                    break;
            }
        }
    }

    drawTree(ctx, tree) {
        const { x, y, size = 1 } = tree;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(size, size);

        // Shadow.
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath();
        ctx.ellipse(0, 20, 25, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Trunk.
        ctx.fillStyle = "#65452e";
        ctx.fillRect(-6, -5, 12, 30);

        // Foliage (three overlapping circles for depth).
        ctx.fillStyle = "#294d32";
        ctx.beginPath();
        ctx.arc(0, -25, 28, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#426b3d";
        ctx.beginPath();
        ctx.arc(-12, -35, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#547c45";
        ctx.beginPath();
        ctx.arc(12, -38, 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    drawBush(ctx, bush) {
        const { x, y, size = 1 } = bush;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(size, size);

        // Shadow.
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.beginPath();
        ctx.ellipse(0, 10, 22, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Foliage clusters.
        ctx.fillStyle = "#315638";
        for (const [dx, dy, radius] of [
            [-12, 0, 13],
            [0, -7, 16],
            [13, 0, 13]
        ]) {
            ctx.beginPath();
            ctx.arc(dx, dy, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Small highlight cluster.
        ctx.fillStyle = "#4a7a52";
        ctx.beginPath();
        ctx.arc(-4, -11, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ==================================================
    // TOWN SQUARE
    // ==================================================

    drawSquare(ctx, square) {
        const { x, y, width, height } = square;

        const left = x - width / 2;
        const top = y - height / 2;

        // Outer border.
        ctx.fillStyle = "#655c4d";
        ctx.fillRect(left - 12, top - 12, width + 24, height + 24);

        // Main paved area.
        ctx.fillStyle = "#8a8272";
        ctx.fillRect(left, top, width, height);

        // Cobblestone pattern.
        const stoneWidth = 36;
        const stoneHeight = 24;
        const gap = 3;

        for (let row = 0; row < Math.ceil(height / stoneHeight); row++) {
            const offset = row % 2 === 0 ? 0 : stoneWidth / 2;

            for (let col = 0; col < Math.ceil(width / stoneWidth) + 1; col++) {
                const px = left + col * stoneWidth - offset;
                const py = top + row * stoneHeight;

                const shade = Math.floor(112 + Math.random() * 28);

                ctx.fillStyle = `rgb(${shade}, ${shade - 5}, ${shade - 13})`;

                ctx.fillRect(
                    px + gap,
                    py + gap,
                    stoneWidth - gap * 2,
                    stoneHeight - gap * 2
                );
            }
        }

        // Decorative border.
        ctx.strokeStyle = "#b7aa91";
        ctx.lineWidth = 5;
        ctx.strokeRect(left, top, width, height);
    }

    // ==================================================
    // BUILDINGS
    // ==================================================

    drawBuilding(ctx, building) {
        const {
            x,
            y,
            width,
            height,
            wallColor,
            roofColor,
            doorColor,
            sign,
            label
        } = building;

        const left = x - width / 2;
        const top = y - height / 2;

        const roofHeight = height * 0.38;
        const wallTop = top + roofHeight * 0.65;
        const wallHeight = height - roofHeight * 0.65;

        // Building shadow.
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.fillRect(left + 8, wallTop + 12, width, wallHeight);

        // Roof silhouette.
        ctx.beginPath();
        ctx.moveTo(left - 12, wallTop + 5);
        ctx.lineTo(x, top - 12);
        ctx.lineTo(left + width + 12, wallTop + 5);
        ctx.closePath();
        ctx.fillStyle = roofColor;
        ctx.fill();

        // Roof highlight.
        ctx.beginPath();
        ctx.moveTo(left - 5, wallTop);
        ctx.lineTo(x, top - 7);
        ctx.lineTo(x, wallTop);
        ctx.closePath();
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fill();

        // Main walls.
        ctx.fillStyle = wallColor;
        ctx.fillRect(left, wallTop, width, wallHeight);
        ctx.strokeStyle = "rgba(40,30,20,0.65)";
        ctx.lineWidth = 4;
        ctx.strokeRect(left, wallTop, width, wallHeight);

        // Windows.
        const windowY = wallTop + 28;
        const windowWidth = 25;
        const windowHeight = 32;

        this.drawWindow(ctx, left + 22, windowY, windowWidth, windowHeight);
        this.drawWindow(
            ctx,
            left + width - windowWidth - 22,
            windowY,
            windowWidth,
            windowHeight
        );

        // Door.
        const doorWidth = building.style === "hall" ? 38 : 30;
        const doorHeight = 52;
        const doorX = x - doorWidth / 2;
        const doorY = wallTop + wallHeight - doorHeight;

        ctx.fillStyle = doorColor;
        ctx.fillRect(doorX, doorY, doorWidth, doorHeight);
        ctx.strokeStyle = "rgba(25,15,10,0.8)";
        ctx.lineWidth = 3;
        ctx.strokeRect(doorX, doorY, doorWidth, doorHeight);

        // Door handle.
        ctx.fillStyle = "#d6b66d";
        ctx.beginPath();
        ctx.arc(
            doorX + doorWidth - 8,
            doorY + doorHeight / 2,
            3,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // Sign.
        if (sign) {
            const signWidth = Math.min(width - 30, 100);

            ctx.fillStyle = "#49382b";
            ctx.fillRect(x - signWidth / 2, wallTop + 5, signWidth, 19);

            ctx.fillStyle = "#e6d5a9";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(sign, x, wallTop + 15);
        }

        // Building name.
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(x - 65, top - 30, 130, 19);

        ctx.fillStyle = "#fff2d6";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x, top - 20);
    }

    drawWindow(ctx, x, y, width, height) {
        ctx.fillStyle = "#394c50";
        ctx.fillRect(x, y, width, height);

        ctx.strokeStyle = "#49362b";
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, width, height);

        ctx.fillStyle = "rgba(180,215,220,0.5)";
        ctx.fillRect(x + 4, y + 4, width - 8, 4);

        ctx.fillStyle = "#49362b";
        ctx.fillRect(x + width / 2 - 2, y, 4, height);
        ctx.fillRect(x, y + height / 2 - 2, width, 4);
    }

    // ==================================================
    // FOUNTAIN
    // ==================================================

    drawFountain(ctx, x, y) {
        // Outer stone base.
        ctx.fillStyle = "#625c54";
        ctx.beginPath();
        ctx.ellipse(x, y, 62, 42, 0, 0, Math.PI * 2);
        ctx.fill();

        // Water.
        ctx.fillStyle = "#648e9b";
        ctx.beginPath();
        ctx.ellipse(x, y - 4, 49, 30, 0, 0, Math.PI * 2);
        ctx.fill();

        // Center pillar.
        ctx.fillStyle = "#aaa18e";
        ctx.fillRect(x - 9, y - 45, 18, 43);

        // Fountain top.
        ctx.fillStyle = "#c1b69f";
        ctx.beginPath();
        ctx.ellipse(x, y - 44, 24, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Small water detail.
        ctx.fillStyle = "#a8d7df";
        ctx.beginPath();
        ctx.arc(x, y - 53, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}
