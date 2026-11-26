import { el } from "../components/Element.js";
import { ItemIcon } from "../components/ItemIcon.js";

import {
    getInventorySlots,
    getInventoryCapacity,
    getUsedSlotCount,
    getStashItems,
    getVisibleItems as getVisibleInventoryItems,
    moveInventoryStack
} from "../../systems/InventorySystem.js";

import { getItemDefinition } from "../../data/items.js";

export default class Inventory {
    constructor({ getGame, formatNumber, save, refreshUI, openItemSheet }) {
        this.getGame = getGame;
        this.formatNumber = formatNumber ?? (value => String(value));
        this.save = save ?? (() => {});
        this.refreshUI = refreshUI ?? (() => {});
        this.openItemSheet = openItemSheet ?? (() => {});

        this.activeTab = "items";

        // Movement state.
        this.moveSourceIndex = null;
        this.moveAmountMode = "all";

        this.pressState = null;
        this.longPressTimer = null;
        this.ignoreClickUntil = 0;

        // Only cancel from document when tapping outside this panel.
        this.handleMoveOutsidePointerDown = event => {
            if (!this.element?.contains(event.target)) {
                this.cancelMoveMode();
            }
        };

        this.element = this.render();
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

    // ===================================
    // GOLD FOOTER
    // ===================================

    renderGold() {
        const gold = this.getVisibleItems().find(
            entry =>
                entry.item.id === "gold" ||
                entry.item.name?.toLowerCase() === "gold"
        );

        if (!gold) return el("div", { className: "inventory-footer-gold" });

        return el("div", { className: "inventory-footer-gold" }, [
            this.createItemIcon(gold.item, "inventory-gold-icon", 20),
            el("strong", {
                className: "inventory-gold-value",
                text: this.formatNumber(gold.amount)
            })
        ]);
    }

    renderFooter() {
        const used = getUsedSlotCount(this.game);
        const capacity = getInventoryCapacity();

        return el("footer", { className: "inventory-footer" }, [
            this.renderGold(),
            el("span", {
                className: "inventory-footer-capacity",
                text: `${used} / ${capacity} slots`
            })
        ]);
    }

    // ===================================
    // TIP / MOVE CONTROLS
    // ===================================

    renderTipArea() {
        if (this.moveSourceIndex !== null) {
            return this.renderMoveControls();
        }

        return el("div", { className: "inventory-tip-area" }, [
            el("span", {
                className: "inventory-tip-title",
                text: "TIP"
            }),
            el("span", {
                className: "inventory-tip-text",
                text: "Tap an item to view details. Press and hold to move items."
            })
        ]);
    }

    renderMoveControls() {
        const slots = getInventorySlots(this.game);
        const source = slots[this.moveSourceIndex];

        if (!source) return this.renderTipArea();

        const item = getItemDefinition(source.itemId);
        const stackLimit = item?.stackLimit ?? 1;
        const isStackable = stackLimit > 1;

        const options = [
            {
                id: "one",
                label: "1",
                amount: 1
            },
            {
                id: "half",
                label: "HALF",
                amount: Math.max(1, Math.floor(source.quantity / 2))
            },
            {
                id: "all",
                label: "ALL",
                amount: source.quantity
            }
        ];

        return el("div", { className: "inventory-move-controls" }, [
            el("div", { className: "inventory-move-heading" }, [
                el("span", {
                    className: "inventory-move-item-name",
                    text: `Moving: ${item?.name ?? "Item"}`
                }),
                el("span", {
                    className: "inventory-move-quantity",
                    text: `×${source.quantity}`
                })
            ]),

            el("div", { className: "inventory-move-options" }, [
                ...options
                    .filter(option => isStackable || option.id === "all")
                    .map(option => {
                        const active = this.moveAmountMode === option.id;

                        return el(
                            "button",
                            {
                                type: "button",
                                className:
                                    "inventory-move-option" +
                                    (active ? " is-active" : ""),
                                "aria-pressed": String(active),
                                onClick: () => {
                                    this.moveAmountMode = option.id;
                                    this.replaceElement();
                                }
                            },
                            [
                                el("strong", { text: option.label }),
                                isStackable
                                    ? el("span", {
                                          text: String(option.amount)
                                      })
                                    : null
                            ]
                        );
                    }),

                el(
                    "button",
                    {
                        type: "button",
                        className: "inventory-move-cancel",
                        title: "Cancel movement",
                        "aria-label": "Cancel movement",
                        onClick: () => this.cancelMoveMode()
                    },
                    ["×"]
                )
            ])
        ]);
    }

    getSelectedTransferAmount(source) {
        switch (this.moveAmountMode) {
            case "one":
                return 1;

            case "half":
                return Math.max(1, Math.floor(source.quantity / 2));

            default:
                return source.quantity;
        }
    }

    // ===================================
    // SLOT MOVEMENT
    // ===================================

    getMoveAction(sourceIndex, destinationIndex, slots) {
        if (sourceIndex === destinationIndex) return null;

        const source = slots[sourceIndex];
        const destination = slots[destinationIndex];

        if (!source) return null;

        const amount = this.getSelectedTransferAmount(source);

        if (!destination) return "move";

        if (source.itemId === destination.itemId) {
            const item = getItemDefinition(source.itemId);
            const limit = item?.stackLimit ?? 1;

            return destination.quantity < limit ? "merge" : null;
        }

        // Swaps only make sense when transferring the entire stack.
        return amount === source.quantity ? "swap" : null;
    }

    startMoveMode(index) {
        const slots = getInventorySlots(this.game);

        if (!slots[index]) return;

        this.moveSourceIndex = index;
        this.moveAmountMode = "all";

        document.addEventListener(
            "pointerdown",
            this.handleMoveOutsidePointerDown,
            true
        );

        this.replaceElement();
    }

    cancelMoveMode({ render = true } = {}) {
        if (this.moveSourceIndex === null) return;

        this.moveSourceIndex = null;
        this.moveAmountMode = "all";

        document.removeEventListener(
            "pointerdown",
            this.handleMoveOutsidePointerDown,
            true
        );

        if (render) this.replaceElement();
    }

    beginSlotPress(index, event) {
        if (this.moveSourceIndex !== null) return;

        if (event.button !== undefined && event.button !== 0) return;

        const slots = getInventorySlots(this.game);

        if (!slots[index]) return;

        this.clearSlotPress();

        this.pressState = {
            index,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY
        };

        event.currentTarget.setPointerCapture?.(event.pointerId);

        this.longPressTimer = setTimeout(() => {
            if (this.pressState?.index !== index) return;

            this.pressState = null;
            this.longPressTimer = null;
            this.ignoreClickUntil = Date.now() + 150;

            this.startMoveMode(index);
        }, 450);
    }

    moveSlotPress(index, event) {
        const press = this.pressState;

        if (!press || press.index !== index) return;

        if (
            press.pointerId !== undefined &&
            event.pointerId !== press.pointerId
        ) {
            return;
        }

        const deltaX = event.clientX - press.startX;
        const deltaY = event.clientY - press.startY;

        if (Math.hypot(deltaX, deltaY) > 12) {
            this.clearSlotPress();
        }
    }

    endSlotPress(index, event) {
        const press = this.pressState;

        if (!press || press.index !== index) return;

        if (
            press.pointerId !== undefined &&
            event.pointerId !== press.pointerId
        ) {
            return;
        }

        this.clearSlotPress();
    }

    clearSlotPress() {
        if (this.longPressTimer !== null) {
            clearTimeout(this.longPressTimer);
        }

        this.longPressTimer = null;
        this.pressState = null;
    }

    handleSlotClick(index, event) {
        if (Date.now() < this.ignoreClickUntil) {
            event.preventDefault();
            return;
        }

        const slots = getInventorySlots(this.game);

        // -----------------------------------
        // Move mode
        // -----------------------------------

        if (this.moveSourceIndex !== null) {
            if (index === this.moveSourceIndex) {
                this.cancelMoveMode();
                return;
            }

            const source = slots[this.moveSourceIndex];

            const action = this.getMoveAction(
                this.moveSourceIndex,
                index,
                slots
            );

            if (!action) {
                this.cancelMoveMode();
                return;
            }

            const amount = this.getSelectedTransferAmount(source);

            const result = moveInventoryStack(
                this.game,
                this.moveSourceIndex,
                index,
                amount
            );

            if (result?.ok === false) return;

            const remaining = slots[this.moveSourceIndex]?.quantity ?? 0;

            this.save();

            // Keep moving while the source still has items.
            if (remaining > 0 && action !== "swap") {
                this.replaceElement();
                return;
            }

            // Source is empty, or a swap completed.
            this.cancelMoveMode({ render: false });
            this.refreshUI();

            return;
        }

        // -----------------------------------
        // Normal item selection
        // -----------------------------------

        const slot = slots[index];

        if (slot) {
            this.openItemSheet(slot.itemId);
        }
    }

    // ===================================
    // INVENTORY SLOTS
    // ===================================

    renderSlot(slot, index, slots) {
        const isMoving = this.moveSourceIndex !== null;
        const isSource = this.moveSourceIndex === index;

        const action =
            isMoving && !isSource
                ? this.getMoveAction(this.moveSourceIndex, index, slots)
                : null;

        const classes = ["inventory-slot"];

        classes.push(slot ? "is-occupied" : "is-empty");

        if (isSource) classes.push("is-move-source");

        if (action) {
            classes.push("is-move-target", `is-move-${action}`);
        }

        const children = [];

        if (!slot) {
            children.push(
                el("span", {
                    className: "inventory-slot-number",
                    text: String(index + 1)
                })
            );
        } else {
            const item = getItemDefinition(slot.itemId);

            if (item) {
                children.push(
                    this.createItemIcon(item, "inventory-slot-icon", 32)
                );

                if (slot.quantity > 1) {
                    children.push(
                        el("span", {
                            className: "inventory-slot-quantity",
                            text: this.formatNumber(slot.quantity)
                        })
                    );
                }
            }
        }

        if (action) {
            const indicator = {
                move: "↧",
                merge: "+",
                swap: "⇄"
            }[action];

            children.push(
                el("span", {
                    className: "inventory-slot-move-indicator",
                    text: indicator,
                    "aria-hidden": "true"
                })
            );
        }

        if (isSource) {
            children.push(
                el("span", {
                    className: "inventory-slot-move-label",
                    text: "SOURCE",
                    "aria-hidden": "true"
                })
            );
        }

        const label = slot
            ? `${getItemDefinition(slot.itemId)?.name ?? "Item"}, quantity ${slot.quantity}`
            : `Empty slot ${index + 1}`;

        return el(
            "button",
            {
                type: "button",
                className: classes.join(" "),
                role: "listitem",
                title: label,
                "aria-label": label,

                onPointerdown: event => this.beginSlotPress(index, event),
                onPointermove: event => this.moveSlotPress(index, event),
                onPointerup: event => this.endSlotPress(index, event),
                onPointercancel: () => this.clearSlotPress(),
                onContextmenu: event => event.preventDefault(),
                onClick: event => this.handleSlotClick(index, event)
            },
            children
        );
    }

    // ===================================
    // TABS AND CONTENT
    // ===================================

    renderItemsTab() {
        const slots = getInventorySlots(this.game);
        const capacity = getInventoryCapacity();

        return el(
            "div",
            {
                className: "inventory-slot-grid",
                role: "list",
                "aria-label": "Inventory slots"
            },
            Array.from({ length: capacity }, (_, index) =>
                this.renderSlot(slots[index], index, slots)
            )
        );
    }

    renderMaterialRow(entry) {
        const { item, amount } = entry;

        return el(
            "button",
            {
                type: "button",
                className: "inventory-material-row",
                onClick: () => this.openItemSheet(item.id),
                title: item.name
            },
            [
                this.createItemIcon(item, "inventory-material-icon", 26),
                el("span", {
                    className: "inventory-material-name",
                    text: item.name
                }),
                el("strong", {
                    className: "inventory-material-amount",
                    text: this.formatNumber(amount)
                })
            ]
        );
    }

    renderMaterialsTab() {
        const materials = getStashItems(this.game);

        if (!materials.length) {
            return el("div", {
                className: "inventory-empty-message",
                text: "No materials collected yet."
            });
        }

        return el(
            "div",
            {
                className: "inventory-material-list",
                role: "list",
                "aria-label": "Stored materials"
            },
            materials.map(entry => this.renderMaterialRow(entry))
        );
    }

    renderTabButton(id, label) {
        const active = this.activeTab === id;

        return el(
            "button",
            {
                type: "button",
                className: `inventory-tab${active ? " is-active" : ""}`,
                "aria-pressed": String(active),
                onClick: () => {
                    if (this.activeTab === id) return;

                    this.clearSlotPress();
                    this.cancelMoveMode({ render: false });

                    this.activeTab = id;
                    this.replaceElement();
                }
            },
            [label]
        );
    }

    renderTabs() {
        return el(
            "nav",
            {
                className: "inventory-tabs",
                "aria-label": "Inventory categories"
            },
            [
                this.renderTabButton("items", "Items"),
                this.renderTabButton("materials", "Materials")
            ]
        );
    }

    renderTabContent() {
        const content =
            this.activeTab === "materials"
                ? this.renderMaterialsTab()
                : this.renderItemsTab();

        return el(
            "div",
            {
                className: "inventory-scroll-area"
            },
            [content]
        );
    }

    // ===================================
    // RENDERING
    // ===================================

    render() {
        return el(
            "div",
            {
                className: "inventory-panel",
                onClick: event => {
                    if (
                        this.moveSourceIndex !== null &&
                        !event.target.closest(
                            ".inventory-slot, .inventory-move-controls"
                        )
                    ) {
                        this.cancelMoveMode();
                    }
                }
            },
            [
                this.renderTipArea(),
                this.renderTabs(),
                this.renderTabContent(),
                this.renderFooter()
            ]
        );
    }

    replaceElement() {
        const oldElement = this.element;
        this.element = this.render();

        if (oldElement?.isConnected) {
            oldElement.replaceWith(this.element);
        }
    }

    update() {
        this.clearSlotPress();
        this.cancelMoveMode({ render: false });

        this.replaceElement();
    }
}
