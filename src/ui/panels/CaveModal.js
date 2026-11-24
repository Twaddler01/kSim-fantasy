// src/ui/panels/CaveModal.js
//
// Cave POI modal. v1 is single-room: narrative + a one-time loot search
// per session (tracked via a session-local Set — no persistence, resets
// on page reload).
//
// Future: replace with a nested ZoneScene for multi-room dungeons. The
// shape of show(caveId) and the loot reward flow stay the same.

import { el } from "../components/Element.js";
import { getCave } from "../../data/caves.js";

export default class CaveModal {
    constructor({ getGame, searchCave, hasSearched, onClose } = {}) {
        if (typeof getGame !== "function") {
            throw new Error("CaveModal requires getGame().");
        }

        this.getGame = getGame;
        this.searchCave = searchCave;
        this.hasSearched = hasSearched;
        this.onClose = onClose ?? (() => {});

        this.currentCave = null;
        this.currentRewards = null;
        this.visible = false;
        this.lastNewlyDiscovered = [];
        this.ignoreNextBackdropClick = false;

        this.buildDOM();
        document.body.append(this.element);

        this.onKeyDown = event => {
            if (!this.visible) return;
            if (event.key === "Escape") this.hide();
        };
        document.addEventListener("keydown", this.onKeyDown);
    }

    get game() {
        return this.getGame();
    }

    buildDOM() {
        this.backdrop = el("div", {
            className: "item-sheet-backdrop",
            role: "presentation",
            onClick: event => {
                if (event.target !== this.backdrop) return;

                if (this.ignoreNextBackdropClick) {
                    this.ignoreNextBackdropClick = false;
                    return;
                }

                this.hide();
            }
        });

        this.panel = el("section", {
            className: "item-sheet",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "cave-sheet-name",
            onClick: event => event.stopPropagation()
        });

        this.backdrop.append(this.panel);
        this.element = this.backdrop;
    }

    show(caveId) {
        const cave = getCave(caveId);
        if (!cave) {
            console.warn("[CaveModal] Unknown cave:", caveId);
            return;
        }

        this.currentCave = cave;
        this.currentRewards = null;
        this.lastNewlyDiscovered = [];

        this.render();
        this.ignoreNextBackdropClick = true;

        this.element.classList.add("is-visible");
        document.body.classList.add("modal-open", "sheet-open");
        this.visible = true;
    }

    hide() {
        if (!this.visible) return;
        this.visible = false;
        this.element.classList.remove("is-visible");
        document.body.classList.remove("modal-open", "sheet-open");

        try {
            this.onClose(this.lastNewlyDiscovered);
        } finally {
            this.currentCave = null;
            this.currentRewards = null;
            this.lastNewlyDiscovered = [];
        }
    }

    destroy() {
        document.removeEventListener("keydown", this.onKeyDown);
        document.body.classList.remove("modal-open", "sheet-open");
        this.element.remove();
    }

    // ==================================================
    // ACTIONS
    // ==================================================

    handleSearch() {
        const cave = this.currentCave;
        if (!cave) return;

        const result = this.searchCave(cave.id);

        if (!result.ok) {
            if (result.reason === "missing-loot-table") {
                console.warn(
                    "[CaveModal] Missing loot table:",
                    cave.lootTableId
                );
            }

            return;
        }

        this.currentRewards = { items: result.items };
        this.lastNewlyDiscovered = result.newlyDiscovered;

        this.render();
    }

    // ==================================================
    // RENDER
    // ==================================================

    render() {
        const cave = this.currentCave;
        if (!cave) return;

        const closeButton = el("button", {
            type: "button",
            className: "item-sheet-close",
            "aria-label": "Close",
            text: "×",
            onClick: () => this.hide()
        });

        const header = el("header", { className: "item-sheet-header" }, [
            el("div", { className: "item-sheet-icon" }, [
                el("span", {
                    className: "item-sheet-icon-emoji",
                    text: cave.icon
                })
            ]),
            el("div", { className: "item-sheet-title-block" }, [
                el("h2", {
                    className: "item-sheet-name",
                    id: "cave-sheet-name",
                    text: cave.name
                }),
                el("div", { className: "item-sheet-type", text: "Cave" })
            ]),
            closeButton
        ]);

        const body = el("div", { className: "item-sheet-body" });

        if (cave.description) {
            body.append(
                el("p", { className: "cave-narrative", text: cave.description })
            );
        }

        const alreadySearched = this.hasSearched(cave.id);

        if (this.currentRewards) {
            // Show search result inline.
            if (cave.searchNarrative) {
                body.append(
                    el("p", {
                        className: "cave-narrative",
                        text: cave.searchNarrative
                    })
                );
            }

            const list = el("div", { className: "loot-summary" });
            for (const item of this.currentRewards.items) {
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
            if (this.currentRewards.items.length === 0) {
                list.append(
                    el("div", {
                        className: "loot-line is-empty",
                        text: "Nothing but dust."
                    })
                );
            }
            body.append(list);
        } else if (alreadySearched) {
            body.append(
                el("p", {
                    className: "cave-searched-message",
                    text: "You have already searched this cave."
                })
            );
        }

        let footer;
        if (alreadySearched) {
            footer = el("footer", { className: "item-sheet-footer" }, [
                el("button", {
                    type: "button",
                    className: "item-sheet-action",
                    text: "LEAVE",
                    onClick: () => this.hide()
                })
            ]);
        } else {
            footer = el("footer", { className: "item-sheet-footer" }, [
                el("button", {
                    type: "button",
                    className: "item-sheet-action",
                    text: "SEARCH",
                    onClick: () => this.handleSearch()
                })
            ]);
        }

        this.panel.replaceChildren(header, body, footer);
        closeButton.focus({ preventScroll: true });
    }
}
