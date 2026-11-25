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

        // Slot movement state.
        this.moveSourceIndex = null;
        this.pressState = null;
        this.longPressTimer = null;
        this.ignoreClickUntil = 0;

        this.element = this.render();

        this.handleMoveOutsidePointerDown = event => {
            // Tapping anything other than an actual slot cancels move mode.
            if (!event.target.closest(".inventory-slot")) {
                this.cancelMoveMode();
            }
        };
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

    // RESOURCES

    renderResources() {
        const resources = this.getVisibleItems().filter(
            entry => entry.item.storage === "resource"
        );

        return el(
            "div",
            {
                className: "inventory-resources",
                "aria-label": "Tracked resources"
            },
            resources.map(({ item, amount }) =>
                el(
                    "div",
                    {
                        className: "inventory-resource",
                        title: item.name
                    },
                    [
                        this.createItemIcon(
                            item,
                            "inventory-resource-icon",
                            16
                        ),
                        el("span", {
                            className: "inventory-resource-name",
                            text: item.name
                        }),
                        el("strong", {
                            className: "inventory-resource-value",
                            text: this.formatNumber(amount)
                        })
                    ]
                )
            )
        );
    }

    // SLOT MOVEMENT

    getMoveAction(sourceIndex, destinationIndex, slots) {
        if (sourceIndex === destinationIndex) return null;

        const source = slots[sourceIndex];
        const destination = slots[destinationIndex];

        if (!source) return null;

        // Empty destination: move.
        if (!destination) return "move";

        // Same item: merge if space remains.
        if (source.itemId === destination.itemId) {
            const item = getItemDefinition(source.itemId);
            const stackLimit = item?.stackLimit ?? 1;

            return destination.quantity < stackLimit ? "merge" : null;
        }

        // Different items: swap.
        return "swap";
    }

    startMoveMode(index) {
        const slots = getInventorySlots(this.game);
    
        if (!slots[index]) return;
    
        this.moveSourceIndex = index;
    
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
    
        document.removeEventListener(
            "pointerdown",
            this.handleMoveOutsidePointerDown,
            true
        );
    
        if (render) {
            this.replaceElement();
        }
    }

    beginSlotPress(index, event) {
        if (this.moveSourceIndex !== null) return;

        if (event.button !== undefined && event.button !== 0) {
            return;
        }

        const slots = getInventorySlots(this.game);

        // Only occupied slots can start move mode.
        if (!slots[index]) return;

        this.clearSlotPress();

        this.pressState = {
            index,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY
        };

        // Keep receiving pointer events if the pointer moves outside
        // the original slot.
        event.currentTarget.setPointerCapture?.(event.pointerId);

        this.longPressTimer = setTimeout(() => {
            if (this.pressState?.index !== index) return;

            this.pressState = null;
            this.longPressTimer = null;

            // Prevent the click generated after a long press from
            // accidentally selecting a destination.
            this.ignoreClickUntil = Date.now() + 700;

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

        // Movement beyond this tolerance cancels the long press.
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

        // We are already moving a stack.
        if (this.moveSourceIndex !== null) {
            // Tapping the source again cancels movement.
            if (index === this.moveSourceIndex) {
                this.cancelMoveMode();
                return;
            }

            const action = this.getMoveAction(
                this.moveSourceIndex,
                index,
                slots
            );

            // Invalid destination: cancel move mode.
            if (!action) {
                this.cancelMoveMode();
                return;
            }

            const result = moveInventoryStack(
                this.game,
                this.moveSourceIndex,
                index
            );

            if (result?.ok === false) return;

            this.moveSourceIndex = null;

            this.save();
            this.refreshUI();

            return;
        }

        // Normal tap: open item details.
        const slot = slots[index];

        if (slot) {
            this.openItemSheet(slot.itemId);
        }
    }

    // INVENTORY SLOTS

    renderSlot(slot, index, slots) {
        const isMoving = this.moveSourceIndex !== null;
        const isSource = this.moveSourceIndex === index;

        const action =
            isMoving && !isSource
                ? this.getMoveAction(this.moveSourceIndex, index, slots)
                : null;

        const classes = ["inventory-slot"];

        if (slot) {
            classes.push("is-occupied");
        } else {
            classes.push("is-empty");
        }

        if (isSource) {
            classes.push("is-move-source");
        }

        if (action) {
            classes.push("is-move-target");
            classes.push(`is-move-${action}`);
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

        // Small visual indicator for valid destinations.
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
                    text: "MOVE",
                    "aria-hidden": "true"
                })
            );
        }

        let label = slot
            ? `${getItemDefinition(slot.itemId)?.name ?? "Item"}, quantity ${slot.quantity}`
            : `Empty slot ${index + 1}`;

        if (isSource) {
            label += ", selected for movement";
        } else if (action === "move") {
            label += ", move destination";
        } else if (action === "merge") {
            label += ", merge destination";
        } else if (action === "swap") {
            label += ", swap destination";
        }

        return el(
            "button",
            {
                type: "button",
                className: classes.join(" "),
                role: "listitem",
                title: label,
                "aria-label": label,

                onPointerdown: event => {
                    this.beginSlotPress(index, event);
                },

                onPointermove: event => {
                    this.moveSlotPress(index, event);
                },

                onPointerup: event => {
                    this.endSlotPress(index, event);
                },

                onPointercancel: () => {
                    this.clearSlotPress();
                },

                onContextmenu: event => {
                    event.preventDefault();
                },

                onClick: event => {
                    this.handleSlotClick(index, event);
                }
            },
            children
        );
    }

    renderItemsTab() {
        const slots = getInventorySlots(this.game);
        const capacity = getInventoryCapacity();
        const used = getUsedSlotCount(this.game);

        return el("div", { className: "inventory-tab-content" }, [
            el("div", { className: "inventory-section-heading" }, [
                el("strong", { text: "Inventory Slots" }),
                el("span", {
                    className: "inventory-capacity",
                    text: `${used} / ${capacity}`
                })
            ]),

            el(
                "div",
                {
                    className: "inventory-slot-grid",
                    role: "list",
                    "aria-label": "Inventory slots"
                },
                Array.from({ length: capacity }, (_, index) =>
                    this.renderSlot(slots[index], index, slots)
                )
            )
        ]);
    }

    // MATERIAL STASH

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

        return el("div", { className: "inventory-tab-content" }, [
            el("div", { className: "inventory-section-heading" }, [
                el("strong", { text: "Material Stash" }),
                el("span", {
                    className: "inventory-capacity",
                    text: `${materials.length} materials`
                })
            ]),

            materials.length
                ? el(
                      "div",
                      {
                          className: "inventory-material-list",
                          role: "list",
                          "aria-label": "Stored materials"
                      },
                      materials.map(entry => this.renderMaterialRow(entry))
                  )
                : el("div", {
                      className: "inventory-empty-message",
                      text: "No materials collected yet."
                  })
        ]);
    }

    // TABS

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

    renderTabContent() {
        return this.activeTab === "materials"
            ? this.renderMaterialsTab()
            : this.renderItemsTab();
    }

    // RENDERING

    render() {
        const used = getUsedSlotCount(this.game);
        const capacity = getInventoryCapacity();

        return el(
            "section",
            {
                className: "inventory-panel",

                onClick: event => {
                    // Clicking elsewhere in the inventory cancels
                    // move mode.
                    if (
                        this.moveSourceIndex !== null &&
                        !event.target.closest(".inventory-slot-grid")
                    ) {
                        this.cancelMoveMode();
                    }
                }
            },
            [
                el("div", { className: "inventory-main-header" }, [
                    el("strong", {
                        className: "inventory-title",
                        text: "Inventory"
                    }),
                    el("span", {
                        className: "inventory-header-capacity",
                        text: `${used} / ${capacity} slots`
                    })
                ]),

                this.renderResources(),

                el(
                    "nav",
                    {
                        className: "inventory-tabs",
                        "aria-label": "Inventory categories"
                    },
                    [
                        this.renderTabButton("items", "Items"),
                        this.renderTabButton("materials", "Materials")
                    ]
                ),

                this.renderTabContent()
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
        // An external inventory refresh invalidates any active move.
        this.clearSlotPress();
        this.cancelMoveMode({ render: false });

        this.replaceElement();
    }
}
