import { el } from "../components/Element.js";
import { ItemIcon } from "../components/ItemIcon.js";
import { getVisibleItems as getVisibleInventoryItems } from "../../systems/InventorySystem.js";

export default class Inventory {
    constructor({ getGame, formatNumber, openItemSheet }) {
        this.getGame = getGame;
        this.formatNumber = formatNumber ?? (value => String(value));
        this.openItemSheet = openItemSheet ?? (() => {});

        this.expanded = false;
        this.values = new Map();
        this.detailValues = new Map();
        this.itemIds = [];
        this.equipCounts = new Map();

        this._outsideBound = false;
        this.bindOutsideClick();

        this.element = this.render();
    }

    bindOutsideClick() {
        if (this._outsideBound) return;
        this._outsideBound = true;

        document.addEventListener(
            "pointerdown",
            e => {
                if (!this.expanded) return;
                if (this.element?.contains(e.target)) return;

                // A modal (item sheet, future dialogs) is on top.
                // It owns its own dismissal — don't collapse underneath it.
                if (document.body.classList.contains("modal-open")) return;

                this.expanded = false;
                document.body.classList.remove("inventory-open");
                this.replaceElement();
            },
            true
        );
    }

    get game() {
        return this.getGame();
    }

    createItemIcon(item, className, size = 24) {
        return ItemIcon(item, {
            size,
            className,
            materialId: item.inventoryType === "resource" ? null : item.id
        });
    }

    getVisibleItems() {
        return getVisibleInventoryItems(this.game);
    }

    getItemKey(item) {
        return `${item.inventoryType}:${item.id}`;
    }

    // ==================================================
    // ITEM LIST
    // ==================================================

    renderItemRow(entry) {
        const { item, amount } = entry;
        const key = this.getItemKey(item);

        const value = el("strong", {
            className: "inventory-item-value",
            text: this.formatNumber(amount)
        });
        this.detailValues.set(key, value);

        return el(
            "article",
            {
                className: "inventory-item is-tappable",
                role: "listitem",
                onClick: () => this.openItemSheet(item.id)
            },
            [
                this.createItemIcon(item, "inventory-item-icon", 26),
                el("div", { className: "inventory-item-copy" }, [
                    el("strong", { text: item.name }),
                    el("small", { text: item.description })
                ]),
                el("div", { className: "inventory-item-actions" }, [value])
            ]
        );
    }

    // ==================================================
    // RENDERING
    // ==================================================

    render() {
        const entries = this.getVisibleItems();

        this.values.clear();
        this.detailValues.clear();
        this.itemIds = entries.map(entry => this.getItemKey(entry.item));

        // Snapshot equippable counts so update() can detect changes.
        this.equipCounts = new Map();
        for (const entry of entries) {
            if (entry.item.equipment) {
                this.equipCounts.set(this.getItemKey(entry.item), entry.amount);
            }
        }

        const chips = entries.map(entry => {
            const { item, amount } = entry;
            const key = this.getItemKey(item);
            const value = el("span", {
                className: "resource-chip-value",
                text: this.formatNumber(amount)
            });
            this.values.set(key, value);

            return el(
                "div",
                {
                    className: "resource-chip",
                    role: "listitem",
                    title: item.name
                },
                [this.createItemIcon(item, "resource-chip-icon", 14), value]
            );
        });

        const header = el("div", { className: "inventory-header" }, [
            el(
                "div",
                {
                    className: "inventory-compact",
                    role: "list",
                    "aria-label": "Current resources and materials"
                },
                chips
            ),
            el(
                "button",
                {
                    type: "button",
                    className: "inventory-chevron-btn",
                    "aria-expanded": String(this.expanded),
                    "aria-label": this.expanded
                        ? "Collapse inventory"
                        : "Expand inventory",
                    onClick: () => {
                        this.expanded = !this.expanded;
                        this.replaceElement();
                    }
                },
                [this.expanded ? "▴" : "▾"]
            )
        ]);

        const expanded = this.expanded
            ? el(
                  "div",
                  {
                      className: "inventory-expanded",
                      role: "list",
                      "aria-label": "Inventory items"
                  },
                  [
                      el(
                          "div",
                          { className: "inventory-items-list" },
                          entries.map(entry => this.renderItemRow(entry))
                      )
                  ]
              )
            : null;

        return el(
            "section",
            {
                className: `inventory-panel${this.expanded ? " is-expanded" : ""}`
            },
            [header, expanded]
        );
    }

    replaceElement() {
        const oldElement = this.element;
        this.element = this.render();

        if (this.expanded) {
            document.body.classList.add("inventory-open");
        } else {
            document.body.classList.remove("inventory-open");
        }

        if (oldElement?.isConnected) {
            oldElement.replaceWith(this.element);
        }

        this.update();
    }

    update() {
        const entries = this.getVisibleItems();
        const ids = entries.map(entry => this.getItemKey(entry.item));

        if (JSON.stringify(ids) !== JSON.stringify(this.itemIds)) {
            this.replaceElement();
            return;
        }

        // Equip / unequip changes the count of an equippable item — rebuild
        // so the character sheet and any conditional UI reflect new state.
        for (const entry of entries) {
            if (!entry.item.equipment) continue;
            const key = this.getItemKey(entry.item);
            const previous = this.equipCounts.get(key);

            if (previous !== entry.amount) {
                this.replaceElement();
                return;
            }
        }

        // Fast path: only text content changed.
        for (const entry of entries) {
            const key = this.getItemKey(entry.item);
            const value = this.formatNumber(entry.amount);

            const compactValue = this.values.get(key);
            if (compactValue) compactValue.textContent = value;

            const detailValue = this.detailValues.get(key);
            if (detailValue) detailValue.textContent = value;
        }
    }
}
