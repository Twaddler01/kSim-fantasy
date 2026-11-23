import { el } from "../components/Element.js";
import WorldMapPanel from "./WorldMapPanel.js";
import NewBadge from "../../notifications/NewBadge.js";

export default class WorldPanel {
    constructor({
        getGame,
        save,
        unlockManager,
        unreadManager,
        zoneDefinitions,
        createZone,
        refreshTab,
        onZoneEnter
    }) {
        this.getGame = getGame;
        this.save = save;
        this.unlockManager = unlockManager;
        this.unreadManager = unreadManager;
        this.zoneDefinitions = zoneDefinitions;
        this.refreshTab = refreshTab;
        this.onZoneEnter = onZoneEnter;
        
        // The viewport starts empty.
        this.view = "blank";

        // Stable viewport and replaceable content.
        this.element = null;
        this.contentElement = null;

        this._viewKey = null;

        // Cached world views.
        this.zoneViews = new Map();
        this.worldMap = null;

        this.mapTitleBadge = new NewBadge({
            unreadManager: this.unreadManager,
            isUnread: () => this.hasUnread(),
            getElement: () => this.element?.querySelector(".world-map-title"),
            placement: "inline",
            ariaLabel: "NEW"
        });

        if (typeof createZone !== "function") {
            throw new Error(
                "WorldPanel requires a createZone(zone) factory. " +
                    "It must return an object with getElement() and update() " +
                    "(optionally deactivate() and refreshSprites())."
            );
        }

        this.createZone = createZone;
    }

    // --- public navigation ---------------------------------------------

    showBlank() {
        this.deactivateCurrentZone();

        this.view = "blank";
        this.refreshTab();

        return true;
    }

    showMap() {
        this.deactivateCurrentZone();

        this.view = "map";
        this.refreshTab();

        return true;
    }

    showZone(zoneId) {
        const zone = this.zoneDefinitions.find(
            definition => definition.id === zoneId
        );

        if (!zone || !this.unlockManager.isUnlocked(zoneId)) {
            return false;
        }

        const previousZoneId = this.activeZoneId();

        if (this.view === "zone" && previousZoneId !== zoneId) {
            this.getZoneView(previousZoneId)?.deactivate?.();
        }

        const game = this.getGame();

        game.appState.navigation.activeZoneId = zoneId;

        this.view = "zone";

        this.unreadManager.markRead("world", `zone-${zoneId}`);

        this.save();
        this.refreshTab();

        return true;
    }

    // --- viewport contract --------------------------------------------

    getMapElement() {
        if (!this.worldMap) {
            this.renderMap();
        }
    
        return this.worldMap.getElement();
    }
    
    getElement() {
        if (!this.element) {
            this.contentElement = el("div", {
                className: "world-viewport-content"
            });

            this.element = el(
                "div",
                {
                    className: "zone-work-content world-viewport"
                },
                [this.contentElement]
            );
        }

        this.update();

        return this.element;
    }

    update() {
        if (!this.contentElement) return this;

        const zoneId = this.view === "zone" ? this.activeZoneId() : null;

        const viewKey = zoneId ? `zone:${zoneId}` : `view:${this.view}`;

        // Keep the current DOM intact when the active view hasn't changed.
        if (this._viewKey === viewKey) {
            this.updateCurrentView(zoneId);
            return this;
        }

        this._viewKey = viewKey;

        let viewElement;

        switch (this.view) {
            case "map":
                viewElement = this.renderMap();
                break;

            case "zone":
                viewElement = this.renderActiveZone();
                break;

            case "blank":
            default:
                viewElement = this.renderBlank();
                break;
        }

        this.contentElement.replaceChildren(viewElement);

        this.updateCurrentView(zoneId);

        return this;
    }

    updateCurrentView(zoneId) {
        if (zoneId) {
            this.getZoneView(zoneId)?.update?.();
        } else if (this.view === "map") {
            this.worldMap?.update?.();
            this.mapTitleBadge.refresh();
        }
    }

    // --- internal world views ------------------------------------------

    renderBlank() {
        return el("div", {
            className: "world-blank-state"
        });
    }

    renderMap() {
        if (!this.worldMap) {
            this.worldMap = new WorldMapPanel({
                getGame: this.getGame,
                unlockManager: this.unlockManager,
                unreadManager: this.unreadManager,
                zoneDefinitions: this.zoneDefinitions,
                onEnterZone: zoneId => {
                    const entered = this.showZone(zoneId);
                
                    if (entered) {
                        this.onZoneEnter?.(zoneId);
                    }
                }
            });
        }

        return el(
            "section",
            {
                className: "world-map-section"
            },
            [
                el(
                    "div",
                    {
                        className: "world-map-header"
                    },
                    [
                        el("div", {}, [
                            el("div", {
                                className: "eyebrow",
                                text: "THE VALLEY"
                            }),
                            el("h2", {
                                className: "world-map-title",
                                text: "World Map"
                            })
                        ])
                    ]
                ),
                this.worldMap.getElement()
            ]
        );
    }

    renderActiveZone() {
        const zoneId = this.activeZoneId();

        if (!zoneId) {
            this.view = "blank";
            return this.renderBlank();
        }

        return this.getZoneView(zoneId).getElement();
    }

    // --- cached zone views ---------------------------------------------

    getZoneView(zoneId) {
        if (!zoneId) return null;

        if (!this.zoneViews.has(zoneId)) {
            const zone = this.zoneDefinitions.find(
                definition => definition.id === zoneId
            );

            if (!zone) return null;

            this.zoneViews.set(zoneId, this.createZone(zone));
        }

        return this.zoneViews.get(zoneId);
    }

    activeZoneId() {
        return this.getGame()?.appState?.navigation?.activeZoneId ?? null;
    }

    deactivateCurrentZone() {
        if (this.view !== "zone") return;

        this.getZoneView(this.activeZoneId())?.deactivate?.();
    }

    // --- notifications and refreshes ----------------------------------

    refreshUnreadIndicators() {
        if (this.view !== "map") return;

        this.worldMap?.update?.();
        this.mapTitleBadge.refresh();
    }

    hasUnread() {
        return this.zoneDefinitions.some(zone =>
            this.unreadManager.isUnread("world", `zone-${zone.id}`)
        );
    }

    // --- world maintenance --------------------------------------------

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
}
