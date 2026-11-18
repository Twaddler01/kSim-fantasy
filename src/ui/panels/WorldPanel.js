import { el } from "../components/Element.js";
import { Button } from "../components/Button.js";
import Badge from "../components/Badge.js";
import NewBadge from "../../notifications/NewBadge.js";
import { createZoneIcon } from "../zoneIcons.js";
import { materials } from "../../data/materials.js";
import { getZoneSpawnBreakdown } from "../../data/zones.js";
import { MaterialIcon } from "../../assets/icons/materials/MaterialIcon.js";
import WorldMapPanel from "./WorldMapPanel.js";

export default class WorldPanel {
    constructor({
        getGame,
        save,
        unlockManager,
        unreadManager,
        zoneDefinitions,
        navigateTo,
        createZone,
        refreshTab,
        showToast
    }) {
        this.getGame = getGame;
        this.save = save;
        this.unlockManager = unlockManager;
        this.unreadManager = unreadManager;
        this.zoneDefinitions = zoneDefinitions;
        this.navigateTo = navigateTo;
        this.refreshTab = refreshTab;
        this.showToast = showToast ?? (() => {});

        this._viewKey = null;
        this.view = "map"; // default view
        this.zoneViews = new Map();
        this.badges = new Map();
        this.worldMap = null;

        this.element = null;
        this.zoneCards = null;
        this.zoneSelectionButton = null;

        if (typeof createZone !== "function") {
            throw new Error(
                "WorldPanel requires a createZone(zone) factory. " +
                    "It must return an object with getElement() and update() " +
                    "(optionally deactivate() and refreshSprites())."
            );
        }
        this.createZone = createZone;
    }

    // --- navigation entry points ---------------------------------------
    showMap() {
        this.deactivateZone();
        this.view = "map";
        this.zoneSelectionButton = null;
        this.refreshTab();
        return true;
    }

    showList() {
        this.deactivateZone();
        this.view = "list";
        this.zoneSelectionButton = null;
        this.refreshTab();
        return true;
    }

    showZone(zoneId) {
        if (!this.unlockManager.isUnlocked(zoneId)) return false;
        if (this.view === "zone" && this.activeZoneId() !== zoneId) {
            this.deactivateZone();
        }

        const game = this.getGame();
        game.appState.navigation.activeZoneId = zoneId;
        this.view = "zone";
        this.unreadManager.markRead("world", `zone-${zoneId}`);
        this.save();
        this.refreshTab();
        return true;
    }

    // --- tab contract ---------------------------------------------------

    getElement() {
        if (!this.element) {
            this.element = el("div", { className: "zone-work-content" });
        }
        this.update();
        return this.element;
    }

    update() {
        if (!this.element) return this;

        const zoneId = this.view === "zone" ? this.activeZoneId() : null;
        const viewKey = zoneId ? `zone:${zoneId}` : `view:${this.view}`;

        // Skip rebuild if the view hasn't changed. Rebuilding would detach
        // and re-attach the canvas, losing pointer capture mid-gesture.
        if (this._viewKey === viewKey) {
            if (zoneId) this.getZoneView(zoneId)?.update?.();
            else if (this.view === "map") this.worldMap?.update?.();
            return this;
        }

        this._viewKey = viewKey;

        if (zoneId) {
            this.element.replaceChildren(this.renderActiveZone());
            this.getZoneView(zoneId)?.update?.();
        } else if (this.view === "map") {
            this.element.replaceChildren(this.renderMap());
            this.worldMap?.update?.();
        } else {
            this.element.replaceChildren(this.renderList());
        }

        return this;
    }

    // --- internal -------------------------------------------------------

    getZoneView(zoneId) {
        if (!this.zoneViews.has(zoneId)) {
            const zone = this.zoneDefinitions.find(f => f.id === zoneId);
            this.zoneViews.set(zoneId, this.createZone(zone));
        }
        return this.zoneViews.get(zoneId);
    }

    activeZoneId() {
        return this.getGame().appState.navigation.activeZoneId;
    }

    // --- MAP VIEW -------------------------------------------------------

    renderMap() {
        if (!this.worldMap) {
            this.worldMap = new WorldMapPanel({
                getGame: this.getGame,
                unlockManager: this.unlockManager,
                unreadManager: this.unreadManager,
                zoneDefinitions: this.zoneDefinitions,
                onEnterZone: zoneId => this.showZone(zoneId),
                showToast: message => this.showToast(message)
            });
        }

        return el("section", { className: "world-map-section" }, [
            el("div", { className: "world-map-header" }, [
                el("div", {}, [
                    el("div", { className: "eyebrow", text: "THE VALLEY" }),
                    el("h2", { text: "World Map" })
                ]),
                el("button", {
                    type: "button",
                    className: "world-map-list-toggle",
                    text: "☰ LIST",
                    "aria-label": "Show zone list",
                    onClick: () => this.showList()
                })
            ]),
            this.worldMap.getElement()
        ]);
    }

    // --- LIST VIEW ------------------------------------------------------

    renderList() {
        const section = el(
            "section",
            { className: "zone-selection-section" },
            [
                el("div", { className: "world-map-header" }, [
                    el("div", {}, [
                        el("div", {
                            className: "eyebrow",
                            text: "ZONES"
                        }),
                        el("h2", { text: "All Zones" })
                    ]),
                    el("button", {
                        type: "button",
                        className: "world-map-list-toggle",
                        text: "🗺 MAP",
                        "aria-label": "Show world map",
                        onClick: () => this.showMap()
                    })
                ]),
                el("p", {
                    className: "muted",
                    text: "Choose a zone, then enter it when you're ready."
                }),
                (this.zoneCards = el("div", {
                    className: "zone-selection-list"
                }))
            ]
        );

        this.updateZoneCards();
        return section;
    }

    // --- ZONE VIEW -----------------------------------------------------

    renderActiveZone() {
        const zoneId = this.activeZoneId();
        if (!zoneId) {
            this.view = "map";
            this.zoneSelectionButton = null;
            return this.renderMap();
        }

        const zoneView = this.getZoneView(zoneId);

        const back = Button("← MAP", () => this.showMap(), {
            variant: "secondary-button"
        });
        this.zoneSelectionButton = back;
        this.updateZoneSelectionBadge();

        return el("div", { className: "zone-work-active-view" }, [
            el("div", { className: "zone-work-toolbar" }, [back]),
            zoneView.getElement()
        ]);
    }

    // --- ZONE CARDS (list view only) ----------------------------------

    updateZoneCards() {
        if (!this.zoneCards) return;

        const game = this.getGame();

        const cards = this.zoneDefinitions.map(zone => {
            const unlocked = this.unlockManager.isUnlocked(zone.id);
            const active = this.activeZoneId() === zone.id;

            const selectButton = el(
                "button",
                {
                    type: "button",
                    className: "zone-selection-card__main",
                    disabled: !unlocked,
                    "aria-label": unlocked
                        ? `Select ${zone.name}`
                        : `${zone.name}, locked`,
                    onClick: () => {
                        if (!unlocked) return;
                        game.appState.navigation.activeZoneId = zone.id;
                        this.save();
                        this.updateZoneCards();
                    }
                },
                [
                    el("span", { className: "zone-selection-card__icon" }, [
                        createZoneIcon(zone, {
                            size: 32,
                            className: "zone-selection-card__icon-svg"
                        })
                    ]),
                    el("span", { className: "zone-selection-card__copy" }, [
                        el(
                            "span",
                            {
                                className: "zone-selection-card__title",
                                dataset: { zoneTitle: zone.id }
                            },
                            [el("strong", { text: zone.name })]
                        ),
                        el("span", {
                            className: "zone-selection-card__description",
                            text: unlocked
                                ? zone.description
                                : `Requires ${zone.unlockTrigger?.amount ?? 0} ${
                                      this.materialName(
                                          zone.unlockTrigger?.item
                                      ) ??
                                      zone.unlockTrigger?.item ??
                                      "resources"
                                  } Samples`
                        }),
                        unlocked ? this.renderZoneMaterials(zone) : null
                    ])
                ]
            );

            const actions = el(
                "span",
                { className: "zone-selection-card__actions" },
                [
                    el("span", {
                        className: "zone-selection-card__status",
                        text: !unlocked
                            ? "LOCKED"
                            : active
                              ? "SELECTED"
                              : "AVAILABLE"
                    }),
                    ...(unlocked && active
                        ? [
                              Button(
                                  "GO",
                                  () => {
                                      this.navigateTo({
                                          tab: "world",
                                          pageId: zone.id
                                      });
                                  },
                                  { variant: "primary-button" }
                              )
                          ]
                        : [])
                ]
            );

            return el(
                "div",
                {
                    className: [
                        "zone-selection-card",
                        unlocked ? "is-unlocked" : "is-locked",
                        active ? "is-active" : ""
                    ]
                        .filter(Boolean)
                        .join(" ")
                },
                [selectButton, actions]
            );
        });

        this.zoneCards.replaceChildren(...cards);
        this.refreshBadges();
    }

    getBadge(zoneId) {
        if (!this.badges.has(zoneId)) {
            this.badges.set(
                zoneId,
                new NewBadge({
                    unreadManager: this.unreadManager,
                    tabId: "world",
                    itemId: `zone-${zoneId}`,
                    getElement: () =>
                        [
                            ...(this.zoneCards?.querySelectorAll(
                                "[data-zone-title]"
                            ) ?? [])
                        ].find(el => el.dataset.zoneTitle === zoneId),
                    placement: "inline",
                    ariaLabel: "New zone"
                })
            );
        }
        return this.badges.get(zoneId);
    }

    refreshBadges() {
        for (const zone of this.zoneDefinitions) {
            this.getBadge(zone.id).refresh();
        }
        // Map pins render unread state directly; refresh them too.
        if (this.view === "map") {
            this.worldMap?.update?.();
        }
    }

    hasUnread() {
        return this.zoneDefinitions.some(zone =>
            this.unreadManager.isUnread("world", `zone-${zone.id}`)
        );
    }

    updateZoneSelectionBadge() {
        const button = this.zoneSelectionButton;
        if (!button) return;
        button.querySelector(".zone-selection-button__badge")?.remove();
        if (!this.hasUnread()) return;
        button.append(
            Badge({
                text: "NEW",
                variant: "new",
                className: "zone-selection-button__badge",
                ariaLabel: "New zone content"
            })
        );
    }

    refreshZoneSprites() {
        for (const view of this.zoneViews.values()) {
            view.refreshSprites?.();
        }
    }

    deactivateZone() {
        for (const view of this.zoneViews.values()) {
            view.deactivate?.();
        }
    }

    refreshZoneBackgrounds() {
        for (const view of this.zoneViews.values()) {
            view.refreshBackground?.();
        }
    }

    renderZoneMaterials(zone) {
        const breakdown = getZoneSpawnBreakdown(zone);
        if (breakdown.length === 0) return null;

        const top = breakdown.slice(0, 3);

        return el(
            "span",
            {
                className: "zone-selection-card__materials",
                "aria-label": `Zone materials: ${top
                    .map(
                        b =>
                            `${this.materialName(b.materialId)} ${Math.round(b.percent)}%`
                    )
                    .join(", ")}`
            },
            top.map(spawn => {
                const pct = Math.round(spawn.percent);
                const name = this.materialName(spawn.materialId);

                return el(
                    "span",
                    {
                        className: "zone-selection-card__chip",
                        title: `${name} · ${pct}%`
                    },
                    [
                        MaterialIcon(spawn.materialId, {
                            size: 14,
                            variant: "core",
                            className: "zone-selection-card__chip-icon"
                        }),
                        el("span", {
                            className: "zone-selection-card__chip-label",
                            text: `${pct}%`
                        })
                    ]
                );
            })
        );
    }

    materialName(materialId) {
        return materials.find(m => m.id === materialId)?.name ?? materialId;
    }
}
