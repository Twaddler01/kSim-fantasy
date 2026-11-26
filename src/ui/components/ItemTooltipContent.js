// src/ui/components/ItemTooltipContent.js

import { el } from "./Element.js";
import { ItemIcon } from "./ItemIcon.js";
import { getItemEntry } from "../../systems/InventorySystem.js";
import {
    getItemStats,
    compareItemStats,
    getTierColor,
    getTierLabel,
    getItemTypeLine
} from "../../utils/itemMeta.js";

export default class ItemTooltipContent {
    constructor({ getGame, tooltipManager, onEquip, onUnequip, onUse } = {}) {
        if (typeof getGame !== "function") {
            throw new Error("ItemTooltipContent requires getGame().");
        }

        if (!tooltipManager) {
            throw new Error("ItemTooltipContent requires tooltipManager.");
        }

        this.getGame = getGame;
        this.tooltipManager = tooltipManager;

        this.onEquip = onEquip ?? (() => false);
        this.onUnequip = onUnequip ?? (() => false);
        this.onUse = onUse ?? (() => false);
    }

    get game() {
        return this.getGame();
    }

    // ==================================================
    // PUBLIC API
    // ==================================================

    show(itemId, target) {
        if (!itemId || !target) return;

        const entry = getItemEntry(this.game, itemId);

        if (!entry) {
            console.warn("[ItemTooltipContent] Unknown item:", itemId);
            return;
        }

        this.tooltipManager.show({
            target,
            content: this.build(entry),
            pinned: true
        });
    }

    build(entry) {
        const { item, amount } = entry;
        const game = this.game;

        const slotId = item.equipment?.slot ?? null;
        const equipped = slotId ? game.equipment?.[slotId] : null;
        const isEquipped = equipped?.id === item.id;
        const compareTo = slotId && !isEquipped ? equipped : null;

        const content = el("div", {
            className: "item-tooltip-content"
        });

        // Header
        const icon = el(
            "div",
            {
                className: "item-tooltip-icon"
            },
            this.renderIcon(item)
        );

        const name = el("div", {
            className: "item-tooltip-name",
            text: item.name
        });

        name.style.color = getTierColor(item);

        const typeLine = getItemTypeLine(item);
        const tierLabel = item.equipment ? getTierLabel(item.tier ?? 1) : null;

        const type = el("div", {
            className: "item-tooltip-type",
            text: [typeLine, tierLabel].filter(Boolean).join(" · ")
        });

        content.append(
            el("div", { className: "item-tooltip-header" }, [
                icon,
                el("div", { className: "item-tooltip-title-block" }, [
                    name,
                    type
                ])
            ])
        );

        // Stats
        const stats = getItemStats(item);

        if (stats.length > 0) {
            const statsBlock = el("div", {
                className: "item-tooltip-stats"
            });

            for (const stat of stats) {
                statsBlock.append(
                    el("div", { className: "item-tooltip-stat" }, [
                        el("span", {
                            className: "item-tooltip-stat-label",
                            text: stat.label
                        }),
                        el("span", {
                            className: "item-tooltip-stat-value",
                            text:
                                stat.value >= 0
                                    ? `+${stat.value}`
                                    : String(stat.value)
                        })
                    ])
                );
            }

            content.append(statsBlock);
        }

        // Equipment comparison
        if (compareTo) {
            content.append(this.renderCompareBlock(item, compareTo));
        }

        // Description
        if (item.description) {
            content.append(
                el("p", {
                    className: "item-tooltip-description",
                    text: item.description
                })
            );
        }

        // Action
        const action = this.renderAction(item, amount, slotId, isEquipped);

        if (action) {
            content.append(
                el("div", { className: "item-tooltip-footer" }, action)
            );
        }

        return content;
    }

    // ==================================================
    // CONTENT
    // ==================================================

    renderIcon(item) {
        if (item.inventoryType === "material") {
            return ItemIcon(item, {
                size: 32,
                materialId: item.id
            });
        }

        return el("span", {
            className: "item-tooltip-icon-emoji",
            text: item.icon || "◈"
        });
    }

    renderCompareBlock(item, compareTo) {
        const block = el("div", {
            className: "item-tooltip-compare"
        });

        block.append(
            el("div", {
                className: "item-tooltip-compare-title",
                text: `Compared to ${compareTo.name ?? compareTo.id}`
            })
        );

        const diffs = compareItemStats(item, compareTo).filter(
            diff => diff.delta !== 0
        );

        if (diffs.length === 0) {
            block.append(
                el("div", {
                    className: "item-tooltip-compare-empty",
                    text: "Same stats"
                })
            );

            return block;
        }

        for (const diff of diffs) {
            const positive = diff.delta > 0;

            block.append(
                el("div", { className: "item-tooltip-stat" }, [
                    el("span", {
                        className: "item-tooltip-stat-label",
                        text: diff.label
                    }),
                    el("span", {
                        className: `item-tooltip-stat-delta ${
                            positive ? "is-positive" : "is-negative"
                        }`,
                        text: `${positive ? "▲" : "▼"} ${
                            positive ? `+${diff.delta}` : String(diff.delta)
                        }`
                    })
                ])
            );
        }

        return block;
    }

    renderAction(item, amount, slotId, isEquipped) {
        if (item.consumable) {
            return el("button", {
                type: "button",
                className: "item-tooltip-action",
                text: "USE",
                disabled: amount < 1,
                onClick: () => this.handleAction(this.onUse, item.id)
            });
        }

        if (slotId && isEquipped) {
            return el("button", {
                type: "button",
                className: "item-tooltip-action",
                text: "UNEQUIP",
                onClick: () => this.handleAction(this.onUnequip, slotId)
            });
        }

        if (slotId) {
            return el("button", {
                type: "button",
                className: "item-tooltip-action",
                text: "EQUIP",
                onClick: () => this.handleAction(this.onEquip, item.id)
            });
        }

        return null;
    }

    // ==================================================
    // ACTIONS
    // ==================================================

    handleAction(callback, value) {
        if (callback(value)) {
            this.tooltipManager.hide();
        }
    }
}
