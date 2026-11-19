import { el } from "../components/Element.js";
import { inventoryItems } from "../../data/inventory.js";
import { ItemIcon } from "../components/ItemIcon.js";
import { EQUIPMENT_SLOTS } from "../../data/equipment.js";
import { getMaterial } from "../../data/materials.js";
import { getDerivedStats, getPlayerLevel } from "../../systems/character.js";

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
        const discovered = this.game.inventoryDiscovered ?? {};

        return inventoryItems.filter(item => {
            if (!discovered[item.id]) return false;

            // Equippable items disappear from the list when you don't
            // have any. Equipped items live in the character sheet.
            if (item.equipment?.slot) {
                if ((this.game.inventory?.[item.id] ?? 0) === 0) {
                    return false;
                }
            }

            return true;
        });
    }

    getAmount(item) {
        return this.game.inventory?.[item.id] ?? 0;
    }

    getItemKey(item) {
        return `${item.inventoryType}:${item.id}`;
    }

    // ==================================================
    // CHARACTER SHEET
    // ==================================================

    renderCharacterSheet() {
        const game = this.game;
        const stats = getDerivedStats(game);
        const player = game.player ?? {};
        const level = getPlayerLevel(game);
        const hp = player.hp ?? stats.maxHealth;
        const equipment = game.equipment ?? {};

        const statRow = el("div", { className: "character-stats" }, [
            el("span", { className: "character-stat" }, [
                el("span", { className: "character-stat-label", text: "LV" }),
                el("strong", { text: String(level) })
            ]),
            el("span", { className: "character-stat" }, [
                el("span", { className: "character-stat-label", text: "HP" }),
                el("strong", { text: `${hp}/${stats.maxHealth}` })
            ]),
            el("span", { className: "character-stat" }, [
                el("span", { className: "character-stat-label", text: "ATK" }),
                el("strong", { text: String(stats.attack) })
            ]),
            el("span", { className: "character-stat" }, [
                el("span", { className: "character-stat-label", text: "DEF" }),
                el("strong", { text: String(stats.defense) })
            ]),
            el("span", { className: "character-stat" }, [
                el("span", { className: "character-stat-label", text: "CRIT" }),
                el("strong", { text: `${(stats.crit * 100).toFixed(1)}%` })
            ])
        ]);

        const slots = el("div", { className: "character-slots" });

        for (const slotDef of EQUIPMENT_SLOTS) {
            const equipped = equipment[slotDef.id] ?? null;
            const item = equipped ? getMaterial(equipped.id) : null;

            const slotEl = el(
                "button",
                {
                    type: "button",
                    className: [
                        "character-slot",
                        equipped ? "is-filled" : "is-empty"
                    ].join(" "),
                    "aria-label": equipped
                        ? `${slotDef.name}: ${item?.name ?? equipped.id}. Tap for details.`
                        : `${slotDef.name}: empty`,
                    onClick: () => {
                        if (!equipped) return;
                        this.openItemSheet(equipped.id);
                    }
                },
                [
                    el("span", {
                        className: "character-slot-label",
                        text: slotDef.name
                    }),
                    el("span", { className: "character-slot-item" }, [
                        item
                            ? ItemIcon(item, {
                                  size: 18,
                                  className: "character-slot-icon",
                                  materialId: item.id
                              })
                            : null,
                        el("span", {
                            className: "character-slot-name",
                            text: item?.name ?? "—"
                        })
                    ])
                ]
            );

            slots.append(slotEl);
        }

        return el("section", { className: "character-sheet" }, [
            el("h3", {
                className: "character-sheet-title",
                text: "Character"
            }),
            statRow,
            slots
        ]);
    }

    // ==================================================
    // ITEM LIST
    // ==================================================

    renderItemRow(item) {
        const key = this.getItemKey(item);
        const amount = this.getAmount(item);

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
        const items = this.getVisibleItems();

        this.values.clear();
        this.detailValues.clear();
        this.itemIds = items.map(item => this.getItemKey(item));

        // Snapshot equippable counts so update() can detect changes.
        this.equipCounts = new Map();
        for (const item of items) {
            if (item.equipment) {
                this.equipCounts.set(
                    this.getItemKey(item),
                    this.getAmount(item)
                );
            }
        }

        const chips = items.map(item => {
            const key = this.getItemKey(item);
            const value = el("span", {
                className: "resource-chip-value",
                text: this.formatNumber(this.getAmount(item))
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
                      "aria-label": "Character and materials"
                  },
                  [
                      this.renderCharacterSheet(),
                      el(
                          "div",
                          { className: "inventory-items-list" },
                          items.map(item => this.renderItemRow(item))
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
        const items = this.getVisibleItems();
        const ids = items.map(item => this.getItemKey(item));

        if (JSON.stringify(ids) !== JSON.stringify(this.itemIds)) {
            this.replaceElement();
            return;
        }

        // Equip / unequip changes the count of an equippable item — rebuild
        // so the character sheet and any conditional UI reflect new state.
        for (const item of items) {
            if (!item.equipment) continue;
            const key = this.getItemKey(item);
            const current = this.getAmount(item);
            const previous = this.equipCounts.get(key);
            if (previous !== current) {
                this.replaceElement();
                return;
            }
        }

        // Fast path: only text content changed.
        for (const item of items) {
            const key = this.getItemKey(item);
            const value = this.formatNumber(this.getAmount(item));

            const compactValue = this.values.get(key);
            if (compactValue) compactValue.textContent = value;

            const detailValue = this.detailValues.get(key);
            if (detailValue) detailValue.textContent = value;
        }
    }
}
