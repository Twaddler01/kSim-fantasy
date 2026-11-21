// debug/DebugPanel.js

import { el } from "../src/ui/components/Element.js";
import { Button } from "../src/ui/components/Button.js";
import { Card } from "../src/ui/components/Card.js";
import { getItemsByType } from "../src/data/items.js";
import {
    addItem,
    getItemAmount
} from "../src/systems/InventorySystem.js";
import { getResultMessage } from "../src/notifications/resultMessages.js";
import {
    getDerivedStats,
    gainXp,
    computeXpToNext,
    getXpToNext,
    getPlayerXp,
    getPlayerLevel
} from "../src/systems/character.js";

const GRANT_AMOUNTS = [1, 10, 100, 1000];

export default class DebugPanel {
    constructor({
        getGame,
        save,
        refreshUI,
        showToast,
        showAnnouncement,
        logEvent,
        processProgression
    }) {
        this.getGame = getGame;
        this.save = save;
        this.refreshUI = refreshUI;
        this.showToast = showToast;
        this.showAnnouncement = showAnnouncement;
        this.logEvent = logEvent;
        this.processProgression = processProgression;
        this.actions = [];

        this.element = null;
        this.valueDisplays = new Map();

        this.addActions();
    }

    get game() {
        return this.getGame();
    }

    addActions() {
        this.actions = [
            {
                label: "Queue 3 Announcements",
                run: () => {
                    for (let i = 1; i <= 3; i++) {
                        this.showAnnouncement({
                            title: `Announcement ${i}`,
                            message: `Queued test message ${i}.`
                        });
                    }
                    this.showToast("3 announcements queued.");
                }
            },
            {
                label: "Grant Starter Equipment",
                run: () => {
                    this.grantMany(
                        ["ironSword", "leatherVest"],
                        "Starter equipment"
                    );
                }
            },
            {
                label: "Show Character",
                run: () => {
                    const game = this.getGame();
                    const player = game.player;
                    const equipment = game.equipment;
                    const stats = getDerivedStats(player, equipment);

                    console.table([
                        {
                            hp: `${player.hp ?? 0} / ${stats.maxHealth}`,
                            xp: `${getPlayerXp(player)} / ${getXpToNext(player)}`,
                            strength: stats.strength,
                            agility: stats.agility,
                            vitality: stats.vitality,
                            attack: stats.attack,
                            defense: stats.defense,
                            crit: `${(stats.crit * 100).toFixed(1)}%`
                        }
                    ]);

                    console.log(
                        "Equipped:",
                        Object.fromEntries(
                            Object.entries(equipment).map(([slot, item]) => [
                                slot,
                                item?.id ?? null
                            ])
                        )
                    );

                    this.showToast("Character stats logged.");
                }
            },
            {
                label: "Add 50 XP",
                run: () => {
                    const result = gainXp(this.getGame(), 50);
                    const lvl = result.levelUps.length
                        ? ` · LEVEL ${result.levelUps.join(", ")}`
                        : "";
                    this.showToast(`+${result.gained} XP${lvl}`);
                    this.save?.();
                    this.refreshUI?.({ database: true });
                }
            },
            {
                label: "Process Progression",
                run: () => {
                    this.processProgression();
                    this.refreshUI({ database: true });
                    this.showToast("Progression processed.");
                }
            },
            {
                label: "Test Log Entry",
                run: () => {
                    this.logEvent(this.getGame(), "DEBUG: Test log entry A.", {
                        category: "activity",
                        tab: "log"
                    });
                    this.save?.();
                    this.showToast("Added log entry.");
                    this.refreshUI({ database: true });
                }
            },
            {
                label: "Test Announcement",
                run: () => {
                    this.showAnnouncement({
                        title: "DEBUG ANNOUNCEMENT",
                        message: "Testing the announcement system."
                    });
                }
            }
        ];
    }

    createActionSection(title, actions, description = "") {
        const content = [];

        if (description) {
            content.push(Card.Text(description));
        }

        content.push(
            Card.Actions(
                actions.map(action =>
                    Button(action.label, action.run, {
                        variant: action.variant ?? "secondary-button"
                    })
                )
            )
        );

        return Card(title, content, "DEBUG ACTIONS", {
            icon: "🧪"
        });
    }

    createItemCard(item) {
        const value = el("strong", {
            className: "debug-item-value",
            text: "0"
        });

        this.valueDisplays.set(item.id, value);

        const amountButtons = GRANT_AMOUNTS.map(amount =>
            Button(`+${amount}`, () => this.grantItem(item.id, amount), {
                variant: "secondary-button"
            })
        );

        const card = Card(
            item.name,
            [
                el(
                    "div",
                    {
                        className: "debug-item-current"
                    },
                    [
                        el("span", {
                            text: "Current amount"
                        }),
                        value
                    ]
                ),

                Card.Actions(amountButtons)
            ],
            item.id,
            { icon: item.icon ?? "◈" }
        );

        return card;
    }

    createItemSection(title, items) {
        const grid = el("div", {
            className: "debug-item-grid"
        });

        for (const item of items) {
            grid.append(this.createItemCard(item));
        }

        return el(
            "section",
            {
                className: "debug-section"
            },
            [
                el("h3", {
                    className: "debug-section-title",
                    text: title
                }),
                grid
            ]
        );
    }

    render() {
        this.element = el("div", {
            className: "debug-panel"
        });

        const actionSection = this.createActionSection(
            "Debug Actions",
            this.actions,
            "Manually trigger game systems and test application behavior."
        );

        const resources = this.createItemSection(
            "Primary Resources",
            getItemsByType("resource")
        );

        const materialSection = this.createItemSection(
            "Materials",
            getItemsByType("material")
        );

        const utilityCard = Card(
            "Testing Utilities",
            [
                Card.Text(
                    "Convenience actions for testing progression and crafting."
                ),

                Card.Actions([
                    {
                        label: "Grant All Materials ×100",
                        variant: "secondary-button",
                        onClick: () => this.grantAllMaterials(100)
                    },
                    {
                        label: "Grant All Resources ×1000",
                        variant: "secondary-button",
                        onClick: () => this.grantAllResources(1000)
                    },
                    {
                        label: "Refresh UI",
                        variant: "secondary-button",
                        onClick: () => this.refreshUI?.({ database: true })
                    }
                ])
            ],
            "Development tools",
            { icon: "🛠️" }
        );

        this.element.append(
            actionSection,
            utilityCard,
            resources,
            materialSection
        );
        this.update();

        return this.element;
    }

    getElement() {
        if (!this.element) {
            this.render();
        }

        this.update();

        return this.element;
    }

    grantItem(itemId, amount = 1) {
        const result = addItem(this.game, itemId, amount);

        if (!result.ok) {
            this.showToast?.(
                getResultMessage(result.reason, "Grant failed.")
            );
            return;
        }

        this.finishGrant(`${amount} ${itemId}`);
    }

    grantMany(items, label) {
        for (const item of items) {
            const itemId = typeof item === "string" ? item : item.id;
            const result = addItem(this.game, itemId, 1);

            if (!result.ok) {
                this.showToast?.(
                    getResultMessage(result.reason, "Grant failed.")
                );
                return;
            }
        }

        this.finishGrant(label);
    }

    grantAllMaterials(amount = 100) {
        this.grantAll(getItemsByType("material"), amount, "All materials");
    }

    grantAllResources(amount = 1000) {
        this.grantAll(getItemsByType("resource"), amount, "All resources");
    }

    grantAll(items, amount, label) {
        for (const item of items) {
            const result = addItem(this.game, item.id, amount);

            if (!result.ok) {
                this.showToast?.(
                    getResultMessage(result.reason, "Grant failed.")
                );
                return;
            }
        }

        this.finishGrant(label);
    }

    grantItemWithoutRefresh(itemId, amount) {
        addItem(this.game, itemId, amount);
    }

    finishGrant(label) {
        this.processProgression?.();

        this.save?.();
        this.update();
        this.refreshUI?.({ database: true });
        this.showToast?.(`${label} granted.`);
    }

    update() {
        if (!this.element) return this;

        for (const [itemId, display] of this.valueDisplays) {
            display.textContent = getItemAmount(this.game, itemId);
        }

        return this;
    }
}
