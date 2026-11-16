// src/ui/panels/WorldMapPanel.js
//
// Stylized world map for FIELD WORK. Replaces the field card list as the
// default navigation view. Pins are DOM buttons absolutely positioned by
// percentage on top of a static SVG background.
//
// Tap an unlocked pin → enters the field (immediately, no intermediate
// info screen — the field view has all the detail). Tap a locked pin →
// toast with the unlock requirement.

import { el } from "../components/Element.js";
import { createFieldIcon } from "../fieldIcons.js";
import { createSvgElement } from "../../assets/icons/svgHelpers.js";
import { getWorldDrawing } from "../../assets/icons/world/worldMap.js";
import { getMaterial } from "../../data/materials.js";

const FALLBACK_POSITION = { x: 50, y: 50 };

export default class WorldMapPanel {
    constructor({
        getGame,
        unlockManager,
        unreadManager,
        fieldDefinitions,
        onSelectField,
        showToast
    }) {
        this.getGame = getGame;
        this.unlockManager = unlockManager;
        this.unreadManager = unreadManager;
        this.fieldDefinitions = fieldDefinitions;
        this.onSelectField = onSelectField ?? (() => {});
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

        const activeFieldId = this.game?.appState?.navigation?.activeFieldId;

        this.pinLayer.replaceChildren(
            ...this.fieldDefinitions.map(field =>
                this.renderPin(field, { activeFieldId })
            )
        );

        return this;
    }

    renderPin(field, { activeFieldId }) {
        const unlocked = this.unlockManager.isUnlocked(field.id);
        const unread = this.unreadManager.isUnread(
            "fieldWork",
            `field-${field.id}`
        );
        const active = activeFieldId === field.id;
        const pos = field.mapPosition ?? FALLBACK_POSITION;

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
                dataset: { fieldId: field.id },
                "aria-label": unlocked
                    ? `Enter ${field.name}`
                    : `${field.name} (locked)`,
                onClick: () => this.handlePinClick(field, unlocked)
            },
            [
                el("span", { className: "world-map-pin-icon" }, [
                    createFieldIcon(field, {
                        size: 26,
                        className: "world-map-pin-icon-svg"
                    })
                ]),
                el("span", {
                    className: "world-map-pin-label",
                    text: field.name
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

    handlePinClick(field, unlocked) {
        if (!unlocked) {
            this.showToast(this.getLockMessage(field));
            return;
        }

        this.onSelectField(field.id);
    }

    getLockMessage(field) {
        const req = field.unlockTrigger;
        if (!req) return `${field.name} is locked.`;

        if (req.type === "inventoryAmount" && req.item) {
            const material = getMaterial(req.item);
            const itemName = material?.name ?? req.item;
            return `${field.name} — requires ${req.amount} ${itemName}.`;
        }

        return `${field.name} is locked.`;
    }
}
