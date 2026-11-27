// src/ui/panels/WorldMapPanel.js

import { el } from "../components/Element.js";
import { createZoneIcon } from "../zoneIcons.js";
import { createSvgElement } from "../../assets/icons/svgHelpers.js";
import { getWorldDrawing } from "../../assets/icons/world/worldMap.js";

import { getItemDefinition } from "../../data/items.js";
import { getEnemy } from "../../data/enemies.js";
import { getCave } from "../../data/caves.js";
import { getZoneSpawnBreakdown } from "../../data/zones.js";
import { TOWN_DEFINITIONS } from "../../data/towns.js";

const FALLBACK_POSITION = { x: 50, y: 50 };

export default class WorldMapPanel {
    constructor({
        getGame,
        unlockManager,
        unreadManager,
        zoneDefinitions,
        onEnterZone,
        mapWidth = 700,
        mapHeight = 490,
        mapPadding = 100
    }) {
        this.getGame = getGame;
        this.unlockManager = unlockManager;
        this.unreadManager = unreadManager;
        this.zoneDefinitions = zoneDefinitions;
        this.onEnterZone = onEnterZone ?? (() => {});

        this.element = null;
        this.viewport = null;
        this.mapStage = null;
        this.mapContainer = null;
        this.pinLayer = null;
        this.detailsPanel = null;

        this.selectedZoneId = null;
        this.cameraPosition = null;

        this.detailsSummary = null;
        this.detailsContent = null;
        this.detailsToggleButton = null;
        this.detailsExpanded = false;

        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.mapPadding = mapPadding;

        this.stageWidth = mapWidth + mapPadding * 2;
        this.stageHeight = mapHeight + mapPadding * 2;
    }

    get game() {
        return this.getGame();
    }

    getElement() {
        if (!this.element) {
            this.render();
            this.initializeSelection();
        }

        this.update();
        this.positionCameraOnAshenbrook();

        return this.element;
    }

    render() {
        const svg = createSvgElement("svg", {
            viewBox: "0 0 400 280",
            preserveAspectRatio: "xMidYMid meet",
            class: "world-map-bg",
            "aria-hidden": "true",
            focusable: "false"
        });

        const draw = getWorldDrawing("valley");
        if (draw) draw(svg);

        this.pinLayer = el("div", {
            className: "world-map-pin-layer"
        });

        this.mapContainer = el(
            "div",
            {
                className: "world-map-container",
                style: {
                    width: `${this.mapWidth}px`,
                    height: `${this.mapHeight}px`,
                    left: `${this.mapPadding}px`,
                    top: `${this.mapPadding}px`
                }
            },
            [svg, this.pinLayer]
        );

        // Surrounding pannable terrain.
        this.mapStage = el(
            "div",
            {
                className: "world-map-stage",
                style: {
                    width: `${this.stageWidth}px`,
                    height: `${this.stageHeight}px`
                }
            },
            [this.mapContainer]
        );

        this.viewport = el(
            "div",
            {
                className: "world-map-viewport",
                "aria-label": "World map. Scroll to explore."
            },
            [this.mapStage]
        );

        // Reposition the camera when the map becomes visible or its
        // container changes size (such as when switching tabs).
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(() => {
                this.positionCameraOnAshenbrook();
            });

            this.resizeObserver.observe(this.viewport);
        }

        this.viewport.addEventListener(
            "scroll",
            () => {
                this.cameraPosition = {
                    left: this.viewport.scrollLeft,
                    top: this.viewport.scrollTop
                };
            },
            { passive: true }
        );

        // Persistent bottom-right zone details card.
        this.detailsSummary = el("div", {
            className: "world-map-details-summary"
        });

        this.detailsContent = el("div", {
            className: "world-map-details-content"
        });

        this.detailsPanel = el(
            "div",
            {
                className: "world-map-details"
            },
            [this.detailsSummary, this.detailsContent]
        );

        this.element = el(
            "div",
            {
                className: "world-map-body"
            },
            [this.viewport, this.detailsPanel]
        );
    }

    initializeSelection() {
        const activeZoneId = this.game?.appState?.navigation?.activeZoneId;

        const activeZoneExists = this.zoneDefinitions.some(
            zone => zone.id === activeZoneId
        );

        if (activeZoneExists) {
            this.selectedZoneId = activeZoneId;
            return;
        }

        const firstUnlocked = this.zoneDefinitions.find(zone =>
            this.unlockManager.isUnlocked(zone.id)
        );

        this.selectedZoneId =
            firstUnlocked?.id ?? this.zoneDefinitions[0]?.id ?? null;
    }

    update() {
        if (!this.pinLayer || !this.detailsSummary || !this.detailsContent) {
            return this;
        }

        this.pinLayer.replaceChildren(
            ...this.zoneDefinitions.map(zone => this.renderPin(zone))
        );

        const selectedZone = this.getSelectedZone();
        const detailsScrollTop = this.detailsContent.scrollTop;

        if (selectedZone) {
            const { summary, expanded } = this.renderZoneDetails(selectedZone);

            this.detailsSummary.replaceChildren(...summary);
            this.detailsContent.replaceChildren(...expanded);
        } else {
            this.detailsSummary.replaceChildren(
                el("p", {
                    className: "world-map-empty",
                    text: "No zones are available."
                })
            );

            this.detailsContent.replaceChildren();
        }

        this.detailsContent.scrollTop = detailsScrollTop;

        this.detailsPanel.classList.toggle("is-expanded", this.detailsExpanded);

        return this;
    }

    setDetailsVisible(visible) {
        this.detailsPanel?.classList.toggle("is-hidden", !visible);

        this.detailsShowButton?.classList.toggle("is-hidden", visible);
    }

    getSelectedZone() {
        return (
            this.zoneDefinitions.find(
                zone => zone.id === this.selectedZoneId
            ) ?? null
        );
    }

    renderPin(zone) {
        const unlocked = this.unlockManager.isUnlocked(zone.id);
        const unread = this.unreadManager.isUnread("world", `zone-${zone.id}`);

        const selected = this.selectedZoneId === zone.id;
        const pos = zone.mapPosition ?? FALLBACK_POSITION;

        return el(
            "button",
            {
                type: "button",
                className: [
                    "world-map-pin",
                    unlocked ? "is-unlocked" : "is-locked",
                    selected ? "is-active" : ""
                ]
                    .filter(Boolean)
                    .join(" "),
                style: {
                    left: `${pos.x}%`,
                    top: `${pos.y}%`
                },
                dataset: {
                    zoneId: zone.id
                },
                "aria-label": `Select ${zone.name}${unlocked ? "" : " (locked)"}`,
                "aria-pressed": selected ? "true" : "false",
                onClick: () => this.selectZone(zone.id)
            },
            [
                el(
                    "span",
                    {
                        className: "world-map-pin-icon"
                    },
                    [
                        createZoneIcon(zone, {
                            size: 26,
                            className: "world-map-pin-icon-svg"
                        })
                    ]
                ),

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

                unread
                    ? el("span", {
                          className: "world-map-pin-dot",
                          "aria-hidden": "true"
                      })
                    : null
            ].filter(Boolean)
        );
    }

    selectZone(zoneId) {
        if (this.selectedZoneId === zoneId) return;

        this.selectedZoneId = zoneId;

        // Every newly selected zone starts in compact mode.
        this.detailsExpanded = false;

        if (this.detailsContent) {
            this.detailsContent.scrollTop = 0;
        }

        this.update();
    }

    toggleDetails() {
        this.detailsExpanded = !this.detailsExpanded;

        this.detailsPanel?.classList.toggle(
            "is-expanded",
            this.detailsExpanded
        );

        if (this.detailsToggleButton) {
            this.detailsToggleButton.textContent = this.detailsExpanded
                ? "COLLAPSE ↑"
                : "MORE DETAILS ↓";
        }
    }

    renderZoneDetails(zone) {
        const unlocked = this.unlockManager.isUnlocked(zone.id);
        const unread = this.unreadManager.isUnread("world", `zone-${zone.id}`);

        // Always-visible summary.
        const summary = [
            el(
                "div",
                {
                    className: "world-map-details-header"
                },
                [
                    el(
                        "div",
                        {
                            className: "world-map-details-title"
                        },
                        [
                            el(
                                "span",
                                {
                                    className: "world-map-details-icon"
                                },
                                [createZoneIcon(zone, { size: 28 })]
                            ),

                            el(
                                "div",
                                {
                                    className: "world-map-status-row"
                                },
                                [
                                    el("span", {
                                        className: "world-map-zone-name",
                                        text: zone.name
                                    }),

                                    el("span", {
                                        className: unlocked
                                            ? "world-map-status is-unlocked"
                                            : "world-map-status is-locked",
                                        text: unlocked ? "AVAILABLE" : "LOCKED"
                                    }),

                                    unread
                                        ? el("span", {
                                              className: "ui-badge",
                                              text: "NEW",
                                              "aria-label": "NEW"
                                          })
                                        : null
                                ].filter(Boolean)
                            )
                        ]
                    )
                ]
            ),

            el(
                "div",
                {
                    className: "world-map-details-actions"
                },
                [
                    unlocked
                        ? el("button", {
                              type: "button",
                              className: "world-map-enter-button",
                              text: "ENTER ZONE",
                              onClick: () => this.onEnterZone(zone.id)
                          })
                        : null,

                    (this.detailsToggleButton = el("button", {
                        type: "button",
                        className: "world-map-details-toggle",
                        text: this.detailsExpanded
                            ? "COLLAPSE ↑"
                            : "MORE DETAILS ↓",
                        "aria-expanded": this.detailsExpanded
                            ? "true"
                            : "false",
                        onClick: () => this.toggleDetails()
                    }))
                ].filter(Boolean)
            )
        ];

        // Optional expanded information.
        const expanded = [
            el("p", {
                className: "world-map-description",
                text: zone.description ?? "No description available."
            })
        ];

        if (!unlocked) {
            expanded.push(this.renderUnlockRequirement(zone));
        }

        const resources = this.getResourceItems(zone);
        const enemies = this.getEnemyItems(zone);
        const pointsOfInterest = this.getPointOfInterestItems(zone);
        const buildings = this.getTownItems(zone);

        if (resources.length) {
            expanded.push(this.renderContentGroup("RESOURCES", resources));
        }

        if (enemies.length) {
            expanded.push(this.renderContentGroup("CREATURES", enemies));
        }

        if (pointsOfInterest.length) {
            expanded.push(
                this.renderContentGroup("POINTS OF INTEREST", pointsOfInterest)
            );
        }

        if (buildings.length) {
            expanded.push(this.renderContentGroup("SETTLEMENT", buildings));
        }

        if (
            !resources.length &&
            !enemies.length &&
            !pointsOfInterest.length &&
            !buildings.length
        ) {
            expanded.push(
                el("p", {
                    className: "world-map-empty",
                    text: "Nothing of note has been discovered here yet."
                })
            );
        }

        return { summary, expanded };
    }

    renderUnlockRequirement(zone) {
        const requirement = zone.unlockTrigger;

        let message = `${zone.name} is currently inaccessible.`;

        if (requirement?.type === "inventoryAmount" && requirement.item) {
            const material = getItemDefinition(requirement.item);
            const itemName = material?.name ?? requirement.item;
            const amount = requirement.amount ?? 1;

            message = `Requires ${amount} ${itemName}`;
        }

        return el(
            "div",
            {
                className: "world-map-lock-requirement"
            },
            [
                el("span", {
                    className: "world-map-lock-icon",
                    text: "🔒"
                }),
                el("span", {
                    text: message
                })
            ]
        );
    }

    getResourceItems(zone) {
        return getZoneSpawnBreakdown(zone)
            .map(entry => {
                const material = getItemDefinition(entry.materialId);
                if (!material) return null;

                return this.createContentItem({
                    icon: material.icon ?? "📦",
                    name: material.name,
                    detail: `${Math.round(entry.percent)}% chance`
                });
            })
            .filter(Boolean);
    }

    getEnemyItems(zone) {
        const enemiesById = new Map();

        const addEnemy = (enemyId, count = 0, guaranteed = false) => {
            if (!enemyId) return;

            const existing = enemiesById.get(enemyId) ?? {
                count: 0,
                guaranteed: false,
                possible: false
            };

            existing.count += count;
            existing.guaranteed ||= guaranteed;
            existing.possible = true;

            enemiesById.set(enemyId, existing);
        };

        for (const spawn of zone.guaranteedSpawns ?? []) {
            if (spawn.type === "enemy") {
                addEnemy(spawn.enemyId, spawn.count ?? 1, true);
            }
        }

        for (const spawn of zone.spawnTable ?? []) {
            if (spawn.type === "enemy") {
                addEnemy(spawn.enemyId);
            }
        }

        return [...enemiesById.entries()]
            .map(([enemyId, info]) => {
                const enemy = getEnemy(enemyId);
                if (!enemy) return null;

                const detail = info.guaranteed
                    ? `${info.count} guaranteed`
                    : "May appear";

                return this.createContentItem({
                    icon: enemy.icon ?? "🐾",
                    name: enemy.name,
                    detail
                });
            })
            .filter(Boolean);
    }

    getPointOfInterestItems(zone) {
        const entries = new Map();

        const addEntry = (key, item) => {
            const existing = entries.get(key);

            if (existing) {
                existing.count += item.count;
                existing.guaranteed ||= item.guaranteed;
                return;
            }

            entries.set(key, { ...item });
        };

        const processSpawn = (spawn, guaranteed) => {
            if (spawn.type === "cache") {
                addEntry("cache", {
                    icon: "📦",
                    name: "Treasure Cache",
                    count: guaranteed ? (spawn.count ?? 1) : 0,
                    guaranteed
                });
            }

            if (spawn.type === "cave" && spawn.dungeonId) {
                const cave = getCave(spawn.dungeonId);
                if (!cave) return;

                addEntry(`cave-${cave.id}`, {
                    icon: cave.icon ?? "🕳️",
                    name: cave.name,
                    count: guaranteed ? (spawn.count ?? 1) : 0,
                    guaranteed
                });
            }
        };

        for (const spawn of zone.guaranteedSpawns ?? []) {
            processSpawn(spawn, true);
        }

        for (const spawn of zone.spawnTable ?? []) {
            processSpawn(spawn, false);
        }

        return [...entries.values()].map(item => {
            return this.createContentItem({
                icon: item.icon,
                name: item.name,
                detail: item.guaranteed
                    ? `${item.count} guaranteed`
                    : "May be discovered"
            });
        });
    }

    getTownItems(zone) {
        if (!zone.townId) return [];

        const town = TOWN_DEFINITIONS.find(
            definition => definition.id === zone.townId
        );

        if (!town) return [];

        return (town.buildings ?? []).map(building => {
            return this.createContentItem({
                icon: building.icon ?? "🏠",
                name: building.label ?? building.name ?? building.id,
                detail: "Building"
            });
        });
    }

    createContentItem({ icon, name, detail }) {
        return el(
            "div",
            {
                className: "world-map-content-item"
            },
            [
                el("span", {
                    className: "world-map-content-icon",
                    text: icon
                }),
                el("span", {
                    className: "world-map-content-name",
                    text: name
                }),
                detail
                    ? el("span", {
                          className: "world-map-content-detail",
                          text: detail
                      })
                    : null
            ].filter(Boolean)
        );
    }

    renderContentGroup(title, items) {
        return el(
            "div",
            {
                className: "world-map-content-group"
            },
            [
                el("h4", {
                    className: "world-map-content-heading",
                    text: title
                }),
                el(
                    "div",
                    {
                        className: "world-map-content-items"
                    },
                    items
                )
            ]
        );
    }

    positionCameraOnAshenbrook() {
        requestAnimationFrame(() => {
            if (!this.viewport?.isConnected) return;

            // A hidden tab may have zero dimensions.
            // Don't calculate or save a camera position yet.
            if (
                this.viewport.clientWidth === 0 ||
                this.viewport.clientHeight === 0
            ) {
                return;
            }

            // Returning to the map: restore its previous camera position.
            if (this.cameraPosition) {
                this.viewport.scrollLeft = this.cameraPosition.left;
                this.viewport.scrollTop = this.cameraPosition.top;
                return;
            }

            // First opening: center on Ashenbrook.
            const ashBrook = this.zoneDefinitions.find(
                zone => zone.id === "ashenbrook"
            );

            const pos = ashBrook?.mapPosition ?? FALLBACK_POSITION;

            const targetX =
                this.mapContainer.offsetLeft +
                (this.mapContainer.clientWidth * pos.x) / 100;

            const targetY =
                this.mapContainer.offsetTop +
                (this.mapContainer.clientHeight * pos.y) / 100;

            this.viewport.scrollLeft = targetX - this.viewport.clientWidth / 2;

            this.viewport.scrollTop = targetY - this.viewport.clientHeight / 2;

            this.cameraPosition = {
                left: this.viewport.scrollLeft,
                top: this.viewport.scrollTop
            };
        });
    }
}
