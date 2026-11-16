// src/ui/panels/LootModal.js
//
// Simple reward reveal. Reuses the item-sheet CSS shell for consistency.
// Opens instantly with rolled loot already granted to inventory.
//
// onClose(newlyDiscoveredItems) is called when the modal closes, so callers
// can defer "NEW MATERIAL DISCOVERED" announcements until the modal is gone
// (rather than stacking modals).

import { el } from "../components/Element.js";

export default class LootModal {
    constructor({ onClose } = {}) {
        this.onClose = onClose ?? (() => {});
        this.rewards = null;
        this.visible = false;
        this.lastNewlyDiscovered = [];

        this.buildDOM();
        document.body.append(this.element);

        this.onKeyDown = event => {
            if (!this.visible) return;
            if (event.key === "Escape") this.hide();
        };
        document.addEventListener("keydown", this.onKeyDown);
    }

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
            "aria-labelledby": "loot-sheet-name"
        });

        this.backdrop.append(this.panel);
        this.element = this.backdrop;
    }

    show({ title = "Rewards", icon = "🎁", rewards } = {}) {
        this.rewards = rewards;
        this.lastNewlyDiscovered = (rewards?.items ?? []).filter(
            item => item.newlyDiscovered && !item.failed
        );

        const closeButton = el("button", {
            type: "button",
            className: "item-sheet-close",
            "aria-label": "Close",
            text: "×",
            onClick: () => this.hide()
        });

        const header = el("header", { className: "item-sheet-header" }, [
            el("div", { className: "item-sheet-icon" }, [
                el("span", { className: "item-sheet-icon-emoji", text: icon })
            ]),
            el("div", { className: "item-sheet-title-block" }, [
                el("h2", {
                    className: "item-sheet-name",
                    id: "loot-sheet-name",
                    text: title
                })
            ]),
            closeButton
        ]);

        const body = el("div", { className: "item-sheet-body" });

        if (rewards.gold > 0 || rewards.xp > 0) {
            const currency = el("div", { className: "loot-summary" });
            if (rewards.gold > 0) {
                currency.append(
                    el("div", { className: "loot-line" }, [
                        el("span", { className: "loot-line-icon", text: "🪙" }),
                        el("span", {
                            className: "loot-line-label",
                            text: "Gold"
                        }),
                        el("span", {
                            className: "loot-line-amount",
                            text: `+${rewards.gold}`
                        })
                    ])
                );
            }
            if (rewards.xp > 0) {
                currency.append(
                    el("div", { className: "loot-line" }, [
                        el("span", { className: "loot-line-icon", text: "🌟" }),
                        el("span", {
                            className: "loot-line-label",
                            text: "Experience"
                        }),
                        el("span", {
                            className: "loot-line-amount",
                            text: `+${rewards.xp}`
                        })
                    ])
                );
            }
            body.append(currency);
        }

        const items = rewards.items ?? [];
        if (items.length === 0 && !(rewards.gold || rewards.xp)) {
            body.append(
                el("div", { className: "loot-empty-message", text: "Empty." })
            );
        } else if (items.length > 0) {
            const list = el("div", { className: "loot-summary" });
            for (const item of items) {
                list.append(
                    el(
                        "div",
                        {
                            className: `loot-line${item.failed ? " is-failed" : ""}`
                        },
                        [
                            el("span", {
                                className: "loot-line-icon",
                                text: "◈"
                            }),
                            el("span", {
                                className: "loot-line-label",
                                text: item.failed
                                    ? `${item.name} (bag full)`
                                    : item.name
                            }),
                            el("span", {
                                className: "loot-line-amount",
                                text: `×${item.qty}`
                            })
                        ]
                    )
                );
            }
            body.append(list);
        }

        const footer = el("footer", { className: "item-sheet-footer" }, [
            el("button", {
                type: "button",
                className: "item-sheet-action",
                text: "CLOSE",
                onClick: () => this.hide()
            })
        ]);

        this.panel.replaceChildren(header, body, footer);

        this.element.classList.add("is-visible");
        document.body.classList.add("modal-open", "sheet-open");
        this.visible = true;
        closeButton.focus({ preventScroll: true });
    }

    hide() {
        if (!this.visible) return;
        this.visible = false;
        this.element.classList.remove("is-visible");
        document.body.classList.remove("modal-open", "sheet-open");

        try {
            this.onClose(this.lastNewlyDiscovered);
        } finally {
            this.lastNewlyDiscovered = [];
            this.rewards = null;
        }
    }

    destroy() {
        document.removeEventListener("keydown", this.onKeyDown);
        document.body.classList.remove("modal-open", "sheet-open");
        this.element.remove();
    }
}
