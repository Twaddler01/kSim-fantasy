import { el } from "./components/Element.js";
import NavigationBar from "./navigation/NavigationBar.js";

export default class GameUI {
    constructor({ getGame, unreadManager, overlayManager, panels = {} }) {
        this.getGame = getGame;
        this.unreadManager = unreadManager;
        this.overlayManager = overlayManager;
        this.panels = panels;

        this.activeDestinationId = null;
        this.navigationBar = null;
        this.navigationElement = null;
        this.moreMenu = null;
        this.moreOpen = false;

        this.destinations = this.createDestinations();
    }

    createDestinations() {
        return [
            {
                id: "character",
                label: "Character",
                icon: "👤"
            },
            {
                id: "inventory",
                label: "Inventory",
                icon: "🎒",
                unread: true
            },
            {
                id: "craft",
                label: "Craft",
                icon: "⚒️"
            },
            {
                id: "map",
                label: "Map",
                icon: "🗺️",
                unread: true,
                unreadKey: "world"
            },
            {
                id: "more",
                label: "More",
                icon: "⋯",
                action: true
            }
        ];
    }

    createMoreMenu() {
        const menu = el("div", {
            className: "game-more-menu",
            "aria-label": "More game sections"
        });

        const entries = [
            {
                id: "equipment",
                label: "Equipment",
                icon: "🛡️"
            },
            {
                id: "journal",
                label: "Journal",
                icon: "📖"
            },
            {
                id: "log",
                label: "Journey Log",
                icon: "📜",
                unread: true,
                unreadDisplay: "count"
            },
            {
                id: "debug",
                label: "Debug",
                icon: "🔧"
            }
        ];

        for (const entry of entries) {
            if (!this.overlayManager?.panels?.[entry.id]) {
                continue;
            }

            const button = el(
                "button",
                {
                    type: "button",
                    className: "game-more-menu-item",
                    onClick: () => {
                        this.closeMore();
                        this.selectDestination(entry.id);
                    }
                },
                [
                    el("span", {
                        className: "game-more-menu-icon",
                        text: entry.icon,
                        "aria-hidden": "true"
                    }),
                    el("span", {
                        text: entry.label
                    })
                ]
            );

            if (entry.unread) {
                const count = this.unreadManager?.getUnreadCount(entry.id) ?? 0;

                if (count > 0) {
                    button.append(
                        el("span", {
                            className: "navigation-unread-count",
                            text: String(count)
                        })
                    );
                }
            }

            menu.append(button);
        }

        menu.hidden = true;
        return menu;
    }

    createNavigation() {
        this.navigationBar = new NavigationBar({
            destinations: this.destinations,
            unreadManager: this.unreadManager,
            getActiveId: () =>
                this.moreOpen ? "more" : this.activeDestinationId,
            onSelect: id => this.selectDestination(id)
        });

        this.moreMenu = this.createMoreMenu();

        this.navigationElement = el(
            "div",
            {
                className: "game-navigation-shell"
            },
            [this.moreMenu, this.navigationBar.getElement()]
        );

        return this.navigationElement;
    }

    selectDestination(id) {
        if (id === "more") {
            this.toggleMore();
            return true;
        }

        if (!this.overlayManager?.panels?.[id]) {
            console.warn(`[GameUI] Unknown destination: ${id}`);
            return false;
        }

        this.closeMore();

        if (this.overlayManager.isOpen(id)) {
            this.overlayManager.close();
            return true;
        }

        return this.overlayManager.open(id);
    }

    toggleMore() {
        if (this.moreOpen) {
            this.closeMore();
        } else {
            this.openMore();
        }
    }

    openMore() {
        if (!this.moreMenu) return false;

        this.moreOpen = true;
        this.moreMenu.hidden = false;
        this.navigationBar?.update();

        return true;
    }

    closeMore() {
        this.moreOpen = false;

        if (this.moreMenu) {
            this.moreMenu.hidden = true;
        }

        this.navigationBar?.update();
    }

    handleOverlayChange(id) {
        this.activeDestinationId = id;
        this.closeMore();
        this.navigationBar?.update();
    }

    updateActiveDestination() {
        this.overlayManager?.update();
        this.navigationBar?.update();
    }

    updateNavigation() {
        this.navigationBar?.update();
    }

    /**
     * Route adapter used by itemNavigation.js.
     *
     * "world" is the persistent viewport, not a selectable
     * overlay destination.
     */
    navigateToRoute(tab, pageId) {
        if (tab === "world") {
            if (pageId === "map") {
                return true;
            }

            this.closeMore();
            this.overlayManager?.close();
            return true;
        }

        return this.selectDestination(tab);
    }
}
