import { el } from "./components/Element.js";
import { Tabs } from "./navigation/Tabs/Tabs.js";

/**
 * Owns the game's tab navigation and active-tab presentation lifecycle.
 *
 * GameUI does not own gameplay rules or application workflows.
 * It receives panels and callbacks from the composition root.
 */
export default class GameUI {
    constructor({
        getGame,
        getCurrentStage,
        unreadManager,
        panels = {},
        onTabChange
    }) {
        this.getGame = getGame;
        this.getCurrentStage = getCurrentStage;
        this.unreadManager = unreadManager;
        this.panels = panels;
        this.onTabChange = onTabChange;

        this.activeTab = "camp";
        this.tabs = null;
        this.campContent = null;
    }

    createTabDefinitions() {
        const {
            debugPanel,
            worldPanel,
            craftingPanel,
            upgradePanel,
            logPanel,
            journalPanel
        } = this.panels;

        return [
            {
                id: "debug",
                label: "DEBUG",
                render: () => debugPanel.getElement()
            },
            {
                id: "camp",
                label: "CAMP",
                render: () => this.campContent
            },
            {
                id: "world",
                label: "WORLD",
                render: () => worldPanel.getElement()
            },
            {
                id: "craft",
                label: "CRAFT",
                render: () => craftingPanel.getElement()
            },
            {
                id: "equipment",
                label: "EQUIPMENT",
                render: () =>
                    this.renderDatabasePanel(
                        "Equipment",
                        `${Object.values(this.getGame().upgrades).reduce(
                            (a, b) => a + b,
                            0
                        )} levels`,
                        upgradePanel.render()
                    )
            },
            {
                id: "log",
                label: "LOG",
                render: () =>
                    this.renderDatabasePanel(
                        "Journey",
                        `${this.getGame().log.length} entries`,
                        logPanel.render()
                    )
            },
            {
                id: "journal",
                label: "JOURNAL",
                render: () => journalPanel.getElement()
            }
        ];
    }

    createTabs() {
        const definitions = this.createTabDefinitions();

        this.tabs = new Tabs({
            activeId: this.activeTab,
            label: "Sections",
            unreadManager: this.unreadManager,
            tabs: definitions.map(tab => ({
                ...tab,
                unread: ["camp", "world", "equipment", "log"].includes(tab.id)
            })),
            onChange: id => {
                this.activeTab = id;
                this.onTabChange?.(id);
            }
        });

        return this.tabs.element;
    }

    renderDatabasePanel(title, count, content) {
        return el("section", { className: "database-view" }, [
            el("div", { className: "section-heading" }, [
                el("div", {}, [
                    el("div", {
                        className: "eyebrow",
                        text: "DATABASE"
                    }),
                    el("h2", { text: title })
                ]),
                el("span", {
                    className: "count-pill",
                    text: count
                })
            ]),
            content
        ]);
    }

    updateActiveTab() {
        const game = this.getGame();
        const {
            debugPanel,
            mainObjective,
            worldPanel,
            craftingPanel,
            upgradePanel,
            logPanel,
            journalPanel
        } = this.panels;

        if (this.activeTab !== "world") {
            worldPanel.deactivateZone?.();
        }

        if (this.activeTab === "camp") {
            const stage = this.getCurrentStage(game);

            if (stage) {
                this.unreadManager.markRead("camp", `objective-${stage.id}`);
            }
        }

        switch (this.activeTab) {
            case "debug":
                debugPanel.update();
                break;
            case "camp":
                mainObjective?.update?.();
                break;
            case "world":
                worldPanel.update();
                break;
            case "craft":
                craftingPanel.update();
                break;
            case "equipment":
                upgradePanel.update();
                this.updateDatabaseCount(
                    `${Object.values(game.upgrades).reduce(
                        (a, b) => a + b,
                        0
                    )} levels`
                );
                break;
            case "log":
                logPanel.update();
                this.updateDatabaseCount(`${game.log.length} entries`);
                break;
            case "journal":
                journalPanel.update();
                break;
        }
    }

    updateDatabaseCount(count) {
        const countPill = this.tabs?.panel?.querySelector(
            ".database-view .count-pill"
        );

        if (countPill) {
            countPill.textContent = count;
        }
    }

    navigateTo(target = {}) {
        return this.tabs?.setActiveTab?.(target.tab, { notify: true });
    }
}
