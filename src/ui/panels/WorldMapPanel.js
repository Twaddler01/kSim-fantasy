// src/ui/panels/WorldMapPanel.js
//
// Stylized world map for WORLD. Replaces the zone card list as the
// default navigation view. Pins are DOM buttons absolutely positioned by
// percentage on top of a static SVG background.
//
// Tap an unlocked pin → enters the zone (immediately, no intermediate
// info screen — the zone view has all the detail). Tap a locked pin →
// toast with the unlock requirement.

import { el } from "../components/Element.js";
import { createZoneIcon } from "../zoneIcons.js";
import { createSvgElement } from "../../assets/icons/svgHelpers.js";
import { getWorldDrawing } from "../../assets/icons/world/worldMap.js";
import { getMaterial } from "../../data/materials.js";

const FALLBACK_POSITION = { x: 50, y: 50 };

export default class WorldMapPanel {
    constructor({
        getGame,
        unlockManager,
        unreadManager,
        zoneDefinitions,
        onSelectZone,
        showToast
    }) {
        this.getGame = getGame;
        this.unlockManager = unlockManager;
        this.unreadManager = unreadManager;
        this.zoneDefinitions = zoneDefinitions;
        this.onSelectZone = onSelectZone ?? (() => {});
        this.showToast = showToast ?? (() => {});

        this.element = null;
        this.pinLayer = null;
    }

    get game() {
        return this.getGame();
    }

    getElement() {
        if (!this.element) this.render();
        this.update();
        return this.element;
    }

    // ==================================================
    // RENDER (one-time DOM structure)
    // ==================================================

    render() {
        this.background = createSvgElement("svg", {
            viewBox: "0 0 400 280",
            preserveAspectRatio: "xMidYMid meet",
            class: "world-map-bg",
            "aria-hidden": "true",
            focusable: "false"
        });

        const draw = getWorldDrawing("valley");
        if (draw) draw(this.background);

        this.pinLayer = el("div", {
            className: "world-map-pin-layer"
        });

        this.element = el("div", { className: "world-map-container" }, [
            this.background,
            this.pinLayer
        ]);
    }

    // ==================================================
    // UPDATE (pin state)
    // ==================================================

    update() {
        if (!this.pinLayer) return this;

        const activeZoneId = this.game?.appState?.navigation?.activeZoneId;

        this.pinLayer.replaceChildren(
            ...this.zoneDefinitions.map(zone =>
                this.renderPin(zone, { activeZoneId })
            )
        );

        return this;
    }

    renderPin(zone, { activeZoneId }) {
        const unlocked = this.unlockManager.isUnlocked(zone.id);
        const unread = this.unreadManager.isUnread(
            "world",
            `zone-${zone.id}`
        );
        const active = activeZoneId === zone.id;
        const pos = zone.mapPosition ?? FALLBACK_POSITION;

        const button = el(
            "button",
            {
                type: "button",
                className: [
                    "world-map-pin",
                    unlocked ? "is-unlocked" : "is-locked",
                    active ? "is-active" : ""
                ]
                    .filter(Boolean)
                    .join(" "),
                style: {
                    left: `${pos.x}%`,
                    top: `${pos.y}%`
                },
                dataset: { zoneId: zone.id },
                "aria-label": unlocked
                    ? `Enter ${zone.name}`
                    : `${zone.name} (locked)`,
                onClick: () => this.handlePinClick(zone, unlocked)
            },
            [
                el("span", { className: "world-map-pin-icon" }, [
                    createZoneIcon(zone, {
                        size: 26,
                        className: "world-map-pin-icon-svg"
                    })
                ]),
                el("span", {
                    className: "world-map-pin-label",
                    text: zone.name
                }),
                unlocked
                    ? null
                    : el("span", {
                          className: "world-map-pin-lock",
                          text: "🔒",
                          "aria-hidden": "true"
                      }),
                unread && !active
                    ? el("span", {
                          className: "world-map-pin-dot",
                          "aria-hidden": "true"
                      })
                    : null
            ].filter(Boolean)
        );

        return button;
    }

    // ==================================================
    // ACTIONS
    // ==================================================

    handlePinClick(zone, unlocked) {
        if (!unlocked) {
            this.showToast(this.getLockMessage(zone));
            return;
        }

        this.onSelectZone(zone.id);
    }

    getLockMessage(zone) {
        const req = zone.unlockTrigger;
        if (!req) return `${zone.name} is locked.`;

        if (req.type === "inventoryAmount" && req.item) {
            const material = getMaterial(req.item);
            const itemName = material?.name ?? req.item;
            return `${zone.name} — requires ${req.amount} ${itemName}.`;
        }

        return `${zone.name} is locked.`;
    }
}
