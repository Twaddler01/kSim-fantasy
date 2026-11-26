// src/ui/panels/LootPanel.js
//
// Displays a temporary loot container.
// Items are inspected before being transferred into inventory.

import { el } from "../components/Element.js";
import { ItemIcon } from "../components/ItemIcon.js";
import { getItemDefinition, ITEM_STORAGE } from "../../data/items.js";

export default class LootPanel {
    constructor({
        getGame,
        lootSystem,
        itemTooltip,
        closeTooltip,
        save,
        refreshUI,
        showToast,
        onClose
    } = {}) {
        if (typeof getGame !== "function") {
            throw new Error("LootPanel requires getGame().");
        }

        if (!lootSystem) {
            throw new Error("LootPanel requires lootSystem.");
        }

        if (!itemTooltip) {
            throw new Error("LootPanel requires itemTooltip.");
        }

        this.getGame = getGame;
        this.lootSystem = lootSystem;
        this.itemTooltip = itemTooltip;
        this.closeTooltip = closeTooltip ?? (() => {});
        this.save = save ?? (() => {});
        this.refreshUI = refreshUI ?? (() => {});
        this.showToast = showToast ?? (() => {});
        this.onClose = onClose ?? (() => {});

        this.container = null;
        this.newlyDiscovered = [];
        this.visible = false;

        this.buildDOM();

        this.handleKeyDown = this.handleKeyDown.bind(this);
        document.addEventListener("keydown", this.handleKeyDown);
    }

    // ==================================================
    // DOM
    // ==================================================

    buildDOM() {
        this.backdrop = el("div", {
            className: "loot-panel-backdrop",
            onClick: event => {
                if (event.target === this.backdrop) {
                    this.hide();
                }
            }
        });

        this.panel = el("div", {
            className: "loot-panel",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "loot-panel-title"
        });

        this.backdrop.append(this.panel);
        document.body.append(this.backdrop);
    }

    render() {
        if (!this.container) return;

        const { title, icon } = this.container;
        const items = this.getResolvedItems();

        const slotItems = items.filter(
            entry => entry.item.storage === ITEM_STORAGE.SLOT
        );

        const stashItems = items.filter(
            entry => entry.item.storage === ITEM_STORAGE.STASH
        );

        const resourceItems = items.filter(
            entry => entry.item.storage === ITEM_STORAGE.RESOURCE
        );

        const header = el(
            "div",
            {
                className: "loot-panel-header"
            },
            [
                el(
                    "div",
                    {
                        className: "loot-panel-heading"
                    },
                    [
                        el("span", {
                            className: "loot-panel-icon",
                            text: icon || "🎁"
                        }),
                        el(
                            "div",
                            {
                                className: "loot-panel-title-block"
                            },
                            [
                                el("h2", {
                                    id: "loot-panel-title",
                                    className: "loot-panel-title",
                                    text: title || "Loot"
                                }),
                                el("div", {
                                    className: "loot-panel-subtitle",
                                    text:
                                        this.container.sourceType?.toUpperCase() ??
                                        "REWARDS"
                                })
                            ]
                        )
                    ]
                ),
                el("button", {
                    type: "button",
                    className: "loot-panel-close",
                    text: "✕",
                    "aria-label": "Close loot",
                    onClick: () => this.hide()
                })
            ]
        );

        const content = el("div", {
            className: "loot-panel-content"
        });

        if (slotItems.length) {
            content.append(this.renderSlotSection(slotItems));
        }

        if (stashItems.length) {
            content.append(this.renderListSection("Materials", stashItems));
        }

        if (resourceItems.length) {
            content.append(this.renderListSection("Resources", resourceItems));
        }

        if (items.length === 0) {
            content.append(
                el("div", {
                    className: "loot-panel-empty",
                    text: "Everything has been collected."
                })
            );
        }

        const remaining = this.container.items.length;

        const footer = el(
            "div",
            {
                className: "loot-panel-footer"
            },
            [
                el("div", {
                    className: "loot-panel-remaining",
                    text: `${remaining} stack${remaining === 1 ? "" : "s"} remaining`
                }),
                el(
                    "div",
                    {
                        className: "loot-panel-actions"
                    },
                    [
                        el("button", {
                            type: "button",
                            className: "loot-panel-take-all",
                            text: "TAKE ALL",
                            disabled: remaining === 0,
                            onClick: () => this.takeAll()
                        })
                    ]
                )
            ]
        );

        this.panel.replaceChildren(header, content, footer);
    }

    renderSlotSection(entries) {
        const grid = el("div", {
            className: "loot-panel-slot-grid"
        });

        for (const entry of entries) {
            grid.append(this.renderSlot(entry));
        }

        return el(
            "section",
            {
                className: "loot-panel-section"
            },
            [
                el("h3", {
                    className: "loot-panel-section-title",
                    text: "Items"
                }),
                grid
            ]
        );
    }

    renderSlot(entry) {
        const { item, quantity } = entry;

        const button = el(
            "button",
            {
                type: "button",
                className: "loot-panel-slot",
                "aria-label": `${item.name}, quantity ${quantity}`,
                onClick: () => this.inspect(entry, button)
            },
            [
                ItemIcon(item, { size: 34 }),
                el("span", {
                    className: "loot-panel-quantity",
                    text: quantity > 1 ? String(quantity) : ""
                })
            ]
        );

        return button;
    }

    renderListSection(title, entries) {
        const list = el("div", {
            className: "loot-panel-list"
        });

        for (const entry of entries) {
            list.append(this.renderListEntry(entry));
        }

        return el(
            "section",
            {
                className: "loot-panel-section"
            },
            [
                el("h3", {
                    className: "loot-panel-section-title",
                    text: title
                }),
                list
            ]
        );
    }

    renderListEntry(entry) {
        const { item, quantity } = entry;

        const button = el(
            "button",
            {
                type: "button",
                className: "loot-panel-list-entry",
                onClick: () => this.inspect(entry, button)
            },
            [
                ItemIcon(item, { size: 28 }),
                el("span", {
                    className: "loot-panel-item-name",
                    text: item.name
                }),
                el("span", {
                    className: "loot-panel-item-amount",
                    text: `×${quantity}`
                })
            ]
        );

        return button;
    }

    // ==================================================
    // INSPECTION
    // ==================================================

    inspect(entry, target) {
        this.itemTooltip.showLoot(
            {
                item: entry.item,
                amount: entry.quantity
            },
            target,
            () => this.takeItem(entry.itemId)
        );
    }

    // ==================================================
    // TRANSFERS
    // ==================================================

    takeItem(itemId) {
        if (!this.container) return false;

        const result = this.lootSystem.takeItem(
            this.getGame(),
            this.container,
            itemId
        );

        if (!result.ok) {
            this.showToast(
                result.reason === "inventory-full"
                    ? "Not enough inventory space."
                    : "Unable to collect this item."
            );

            return false;
        }

        this.recordDiscovery(result);
        this.afterTransfer();

        return true;
    }

    takeAll() {
        if (!this.container || this.lootSystem.isEmpty(this.container)) {
            return;
        }

        this.closeTooltip();

        const result = this.lootSystem.takeAll(this.getGame(), this.container);

        for (const entry of result.taken) {
            this.recordDiscovery(entry);
        }

        if (result.taken.length) {
            this.afterTransfer();
        }

        if (result.failed.length) {
            this.showToast(
                "Some items could not be collected. They remain here."
            );
        }
    }

    recordDiscovery(result) {
        if (!result.newlyDiscovered) return;

        this.newlyDiscovered.push({
            itemId: result.itemId,
            newlyDiscovered: true,
            failed: false
        });
    }

    afterTransfer() {
        this.save();
        this.refreshUI({ database: true });
        this.render();
    }

    // ==================================================
    // CONTAINER
    // ==================================================

    getResolvedItems() {
        if (!this.container) return [];

        return this.container.items
            .map(entry => {
                const item = getItemDefinition(entry.itemId);

                if (!item) {
                    console.warn(`[LootPanel] Unknown item: ${entry.itemId}`);
                    return null;
                }

                return {
                    itemId: entry.itemId,
                    quantity: entry.quantity,
                    item
                };
            })
            .filter(Boolean);
    }

    show(container) {
        if (!container || !Array.isArray(container.items)) {
            console.warn("[LootPanel] Invalid loot container.");
            return;
        }

        this.closeTooltip();

        this.container = container;
        this.newlyDiscovered = [];
        this.visible = true;

        this.render();

        this.backdrop.classList.add("is-visible");
        document.body.classList.add("modal-open");
    }

    hide() {
        if (!this.visible) return;

        this.closeTooltip();

        this.visible = false;
        this.backdrop.classList.remove("is-visible");
        document.body.classList.remove("modal-open");

        const discovered = [...this.newlyDiscovered];

        this.container = null;
        this.newlyDiscovered = [];

        this.onClose(discovered);
    }

    handleKeyDown(event) {
        if (event.key === "Escape" && this.visible) {
            this.hide();
        }
    }

    destroy() {
        this.hide();
        document.removeEventListener("keydown", this.handleKeyDown);
        this.backdrop.remove();
    }
}
