import { el } from "../components/Element.js";
import { Button } from "../components/Button.js";
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
        refreshTab
    }) {
        this.getGame = getGame;
        this.save = save;
        this.unlockManager = unlockManager;
        this.unreadManager = unreadManager;
        this.zoneDefinitions = zoneDefinitions;
        this.refreshTab = refreshTab;

        this._viewKey = null;
        this.view = "map"; // default view
        this.zoneViews = new Map();
        this.worldMap = null;

        this.mapTitleBadge = new NewBadge({
            unreadManager: this.unreadManager,
            isUnread: () => this.hasUnread(),
            getElement: () =>
                this.element?.querySelector(".world-map-title"),
            placement: "inline",
            ariaLabel: "NEW"
        });
        
        this.element = null;

        if (typeof createZone !== "function") {
            throw new Error(
                "WorldPanel requires a createZone(zone) factory. " +
                    "It must return an object with getElement() and update() " +
                    "(optionally deactivate() and refreshSprites())."
            );
        }
        this.createZone = createZone;
    }

    showMap() {
        this.deactivateZone();
        this.view = "map";
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
        const viewKey = zoneId ? `zone:${zoneId}` : "view:map";
    
        // Avoid rebuilding an active canvas.
        if (this._viewKey === viewKey) {
            if (zoneId) {
                this.getZoneView(zoneId)?.update?.();
            } else {
                this.worldMap?.update?.();
                this.mapTitleBadge.refresh();
            }
    
            return this;
        }
    
        this._viewKey = viewKey;
    
        if (zoneId) {
            this.element.replaceChildren(this.renderActiveZone());
            this.getZoneView(zoneId)?.update?.();
        } else {
            this.element.replaceChildren(this.renderMap());
            this.worldMap?.update?.();
    
            // The title now exists in the DOM.
            this.mapTitleBadge.refresh();
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

    renderMap() {
        if (!this.worldMap) {
            this.worldMap = new WorldMapPanel({
                getGame: this.getGame,
                unlockManager: this.unlockManager,
                unreadManager: this.unreadManager,
                zoneDefinitions: this.zoneDefinitions,
                onEnterZone: zoneId => this.showZone(zoneId)
            });
        }
    
        const section = el("section", {
            className: "world-map-section"
        }, [
            el("div", { className: "world-map-header" }, [
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
            ]),
            this.worldMap.getElement()
        ]);
    
        return section;
    }

    renderActiveZone() {
        const zoneId = this.activeZoneId();
        if (!zoneId) {
            this.view = "map";
            return this.renderMap();
        }

        const zoneView = this.getZoneView(zoneId);

        const back = Button("← MAP", () => this.showMap(), {
            variant: "secondary-button"
        });
    
        return el("div", { className: "zone-work-active-view" }, [
            el("div", { className: "zone-work-toolbar" }, [back]),
            zoneView.getElement()
        ]);
    }

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
