// src/ui/panels/TownScene.js
//
// Town-specific scene adapter.
//
// TownScene owns:
//   - Fixed town object placement
//   - Town object interactions
//   - Town background generation
//
// ZoneCanvas owns:
//   - Rendering
//   - Camera and player movement
//   - Pointer input and interaction approach
//   - Entity hit detection

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

            onInteract: entity => this.handleInteract(entity),

            // Town objects never respawn or disappear.
            onRespawn: () => null
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

    // --------------------------------------------------
    // OBJECTS
    // --------------------------------------------------

    buildObjects() {
        return this.town.objects.map(object => ({
            id: object.id,
            type: "poi",
            label: object.label,
            icon: object.icon,

            x: object.x,
            y: object.y,
            r: object.r ?? 28,

            message: object.message,

            strikesRequired: 1,
            sparkleTier: 0,
            rotation: 0,
            scale: 1,
            crumbs: [],

            consumeOnInteract: false,
            respawnSeconds: null
        }));
    }

    handleInteract(entity) {
        this.showToast(
            entity.message ?? `${entity.label} is not available yet.`
        );

        // false tells ZoneCanvas to leave the object in place.
        return false;
    }

    // --------------------------------------------------
    // BACKGROUND
    // --------------------------------------------------

    buildBackground() {
        const { width, height } = this.world;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        // Base stone color.
        ctx.fillStyle = "#625e59";
        ctx.fillRect(0, 0, width, height);

        // Deterministic pattern so the town looks consistent.
        let seed = 12345;

        const rand = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        };

        const stoneWidth = 48;
        const stoneHeight = 30;
        const gap = 3;

        for (let row = 0; row < Math.ceil(height / stoneHeight); row++) {
            const offset = row % 2 === 0 ? 0 : stoneWidth / 2;

            for (let col = -1; col < Math.ceil(width / stoneWidth) + 1; col++) {
                const x = col * stoneWidth + offset;
                const y = row * stoneHeight;

                const shade = Math.floor(82 + rand() * 35);

                ctx.fillStyle = `rgb(${shade}, ${shade - 3}, ${shade - 8})`;

                ctx.fillRect(
                    x + gap,
                    y + gap,
                    stoneWidth - gap * 2,
                    stoneHeight - gap * 2
                );

                // Subtle stone highlight.
                ctx.fillStyle = "rgba(255,255,255,0.06)";
                ctx.fillRect(
                    x + gap + 2,
                    y + gap + 2,
                    stoneWidth - gap * 2 - 4,
                    2
                );
            }
        }

        return canvas;
    }
}
