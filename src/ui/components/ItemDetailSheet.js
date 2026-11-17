// src/ui/components/ItemDetailSheet.js
//
// Bottom-sheet item detail view.
//
// Trigger: tap any item (inventory row, equipped slot, future loot popup).
// Dismiss: ×, backdrop tap, or Escape.
// Action: EQUIP / UNEQUIP when the item has an equipment block.
//
// The sheet reads game state on open (never caches). This makes it safe to
// leave mounted for the lifetime of the app — the current game object is
// always resolved via getGame().
//
// Comparison is automatic: if the item has a slot and something else is
// equipped in that slot, the sheet shows the equipped item's name plus
// per-stat deltas (new − equipped).

import { el } from "./Element.js";
import { ItemIcon } from "./ItemIcon.js";
import { getInventoryItem } from "../../data/inventory.js";
import { getMaterial } from "../../data/materials.js";
import {
    getItemStats,
    compareItemStats,
    getTierColor,
    getTierLabel,
    getItemTypeLine
} from "../../utils/itemMeta.js";

export default class ItemDetailSheet {
    constructor({ getGame, onEquip, onUnequip, onUse } = {}) {
        if (typeof getGame !== "function") {
            throw new Error("ItemDetailSheet requires getGame().");
        }

        this.getGame = getGame;
        this.onEquip = onEquip ?? (() => false);
        this.onUnequip = onUnequip ?? (() => false);

        this.visible = false;
        this.currentItemId = null;

        this.buildDOM();
        document.body.append(this.element);

        this.onKeyDown = event => {
            if (!this.visible) return;
            if (event.key === "Escape") this.hide();
        };
        document.addEventListener("keydown", this.onKeyDown);

        this.onUse = onUse ?? (() => false);
    }

    get game() {
        return this.getGame();
    }

    // ==================================================
    // DOM
    // ==================================================

    buildDOM() {
        this.backdrop = el("div", {
            className: "item-sheet-backdrop",
            role: "presentation",
            onClick: event => {
                if (event.target === this.backdrop) this.hide();
            }
        });

        this.panel = el("section", {
            className: "item-sheet",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "item-sheet-name"
        });

        this.headerIcon = el("div", { className: "item-sheet-icon" });

        this.headerName = el("h2", {
            className: "item-sheet-name",
            id: "item-sheet-name"
        });

        this.headerType = el("div", { className: "item-sheet-type" });

        this.closeButton = el("button", {
            type: "button",
            className: "item-sheet-close",
            "aria-label": "Close",
            text: "×",
            onClick: () => this.hide()
        });

        const header = el("header", { className: "item-sheet-header" }, [
            this.headerIcon,
            el("div", { className: "item-sheet-title-block" }, [
                this.headerName,
                this.headerType
            ]),
            this.closeButton
        ]);

        this.body = el("div", { className: "item-sheet-body" });

        this.footer = el("footer", { className: "item-sheet-footer" });
        this.footer.hidden = true;

        this.panel.append(header, this.body, this.footer);
        this.backdrop.append(this.panel);
        this.element = this.backdrop;
    }

    // ==================================================
    // PUBLIC API
    // ==================================================

    show(itemId) {
        if (!itemId) return;

        const item = getInventoryItem(itemId);
        if (!item) {
            console.warn("[ItemDetailSheet] Unknown item:", itemId);
            return;
        }

        this.currentItemId = itemId;
        this.render(item);

        this.element.classList.add("is-visible");
        document.body.classList.add("modal-open", "sheet-open");

        this.visible = true;

        // Move focus to the close button so Escape / screen readers work.
        this.closeButton.focus({ preventScroll: true });
    }

    hide() {
        if (!this.visible) return;
        this.visible = false;
        this.element.classList.remove("is-visible");
        document.body.classList.remove("modal-open", "sheet-open");
    }

    destroy() {
        document.removeEventListener("keydown", this.onKeyDown);
        document.body.classList.remove("modal-open", "sheet-open");
        this.element.remove();
    }

    // ==================================================
    // RENDER
    // ==================================================

    render(item) {
        const game = this.game;
        const slotId = item.equipment?.slot ?? null;
        const equipped = slotId ? game.equipment?.[slotId] : null;
        const isEquipped = equipped?.id === item.id;
        const compareTo = slotId && !isEquipped ? equipped : null;

        // Header
        this.headerIcon.replaceChildren(this.renderIcon(item));
        this.headerName.textContent = item.name;
        this.headerName.style.color = getTierColor(item);

        const typeLine = getItemTypeLine(item);
        const tierLabel = item.equipment ? getTierLabel(item.tier ?? 1) : null;

        this.headerType.textContent = [typeLine, tierLabel]
            .filter(Boolean)
            .join(" · ");

        // Body
        this.body.replaceChildren();

        const stats = getItemStats(item);
        if (stats.length > 0) {
            const statsBlock = el("div", {
                className: "item-sheet-stats"
            });

            for (const stat of stats) {
                statsBlock.append(
                    el("div", { className: "item-stat" }, [
                        el("span", {
                            className: "item-stat-label",
                            text: stat.label
                        }),
                        el("span", {
                            className: "item-stat-value",
                            text:
                                stat.value >= 0
                                    ? `+${stat.value}`
                                    : String(stat.value)
                        })
                    ])
                );
            }

            this.body.append(statsBlock);
        }

        if (compareTo) {
            this.body.append(this.renderCompareBlock(item, compareTo));
        }

        if (item.description) {
            this.body.append(
                el("p", {
                    className: "item-sheet-description",
                    text: item.description
                })
            );
        }

        // Footer / action
        this.footer.replaceChildren();
        this.footer.hidden = true;
        
        const amount = game.inventory?.[item.id] ?? 0;
        
        if (item.consumable) {
            this.footer.hidden = false;
        
            this.footer.append(
                el("button", {
                    type: "button",
                    className: "item-sheet-action",
                    text: "USE",
                    disabled: amount < 1,
                    onClick: () => this.handleUse(item.id)
                })
            );
        } else if (slotId && isEquipped) {
            this.footer.hidden = false;
        
            this.footer.append(
                el("button", {
                    type: "button",
                    className: "item-sheet-action",
                    text: "UNEQUIP",
                    onClick: () => this.handleUnequip(slotId)
                })
            );
        } else if (slotId) {
            this.footer.hidden = false;
        
            this.footer.append(
                el("button", {
                    type: "button",
                    className: "item-sheet-action",
                    text: "EQUIP",
                    onClick: () => this.handleEquip(item.id)
                })
            );
        }
    }

    renderIcon(item) {
        // Real materials use the SVG pipeline. Resources use their emoji.
        if (getMaterial(item.id)) {
            return ItemIcon(item, { size: 32, materialId: item.id });
        }
        return el("span", {
            className: "item-sheet-icon-emoji",
            text: item.icon || "◈"
        });
    }

    renderCompareBlock(item, compareTo) {
        const block = el("div", { className: "item-sheet-compare" });

        block.append(
            el("div", {
                className: "item-sheet-compare-title",
                text: `Compared to ${compareTo.name ?? compareTo.id}`
            })
        );

        const diffs = compareItemStats(item, compareTo).filter(
            d => d.delta !== 0
        );

        if (diffs.length === 0) {
            block.append(
                el("div", {
                    className: "item-sheet-compare-empty",
                    text: "Same stats"
                })
            );
            return block;
        }

        for (const diff of diffs) {
            const positive = diff.delta > 0;
            block.append(
                el("div", { className: "item-stat" }, [
                    el("span", {
                        className: "item-stat-label",
                        text: diff.label
                    }),
                    el("span", {
                        className: `item-stat-delta ${
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

    // ==================================================
    // ACTIONS
    // ==================================================

    handleEquip(itemId) {
        this.onEquip(itemId);
        this.hide();
    }

    handleUnequip(slotId) {
        this.onUnequip(slotId);
        this.hide();
    }

    handleUse(itemId) {
        this.onUse(itemId);
        this.hide();
    }
}
