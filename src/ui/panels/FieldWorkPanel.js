import { el } from "../components/Element.js";
import { Button } from "../components/Button.js";
import Badge from "../components/Badge.js";
import NewBadge from "../../notifications/NewBadge.js";
import { createFieldIcon } from "../fieldIcons.js";
import { materials } from "../../data/materials.js";
import { getFieldSpawnBreakdown } from "../../data/fields.js";
import { MaterialIcon } from "../../assets/icons/materials/MaterialIcon.js";
import WorldMapPanel from "./WorldMapPanel.js";

export default class FieldWorkPanel {
    constructor({
        getGame,
        save,
        unlockManager,
        unreadManager,
        fieldDefinitions,
        navigateTo,
        createField,
        refreshTab,
        showToast
    }) {
        this.getGame = getGame;
        this.save = save;
        this.unlockManager = unlockManager;
        this.unreadManager = unreadManager;
        this.fieldDefinitions = fieldDefinitions;
        this.navigateTo = navigateTo;
        this.refreshTab = refreshTab;
        this.showToast = showToast ?? (() => {});

        this._viewKey = null;
        this.view = "map"; // default view
        this.fieldViews = new Map();
        this.badges = new Map();
        this.worldMap = null;

        this.element = null;
        this.fieldCards = null;
        this.fieldSelectionButton = null;

        if (typeof createField !== "function") {
            throw new Error(
                "FieldWorkPanel requires a createField(field) factory. " +
                    "It must return an object with getElement() and update() " +
                    "(optionally deactivate() and refreshSprites())."
            );
        }
        this.createField = createField;
    }

    // --- navigation entry points ---------------------------------------
    showMap() {
        this.deactivateField();
        this.view = "map";
        this.fieldSelectionButton = null;
        this.refreshTab();
        return true;
    }

    showList() {
        this.deactivateField();
        this.view = "list";
        this.fieldSelectionButton = null;
        this.refreshTab();
        return true;
    }

    showField(fieldId) {
        if (!this.unlockManager.isUnlocked(fieldId)) return false;
        if (this.view === "field" && this.activeFieldId() !== fieldId) {
            this.deactivateField();
        }

        const game = this.getGame();
        game.appState.navigation.activeFieldId = fieldId;
        this.view = "field";
        this.unreadManager.markRead("fieldWork", `field-${fieldId}`);
        this.save();
        this.refreshTab();
        return true;
    }

    // --- tab contract ---------------------------------------------------

    getElement() {
        if (!this.element) {
            this.element = el("div", { className: "field-work-content" });
        }
        this.update();
        return this.element;
    }

    update() {
        if (!this.element) return this;

        const fieldId = this.view === "field" ? this.activeFieldId() : null;
        const viewKey = fieldId ? `field:${fieldId}` : `view:${this.view}`;

        // Skip rebuild if the view hasn't changed. Rebuilding would detach
        // and re-attach the canvas, losing pointer capture mid-gesture.
        if (this._viewKey === viewKey) {
            if (fieldId) this.getFieldView(fieldId)?.update?.();
            else if (this.view === "map") this.worldMap?.update?.();
            return this;
        }

        this._viewKey = viewKey;

        if (fieldId) {
            this.element.replaceChildren(this.renderActiveField());
            this.getFieldView(fieldId)?.update?.();
        } else if (this.view === "map") {
            this.element.replaceChildren(this.renderMap());
            this.worldMap?.update?.();
        } else {
            this.element.replaceChildren(this.renderList());
        }

        return this;
    }

    // --- internal -------------------------------------------------------

    getFieldView(fieldId) {
        if (!this.fieldViews.has(fieldId)) {
            const field = this.fieldDefinitions.find(f => f.id === fieldId);
            this.fieldViews.set(fieldId, this.createField(field));
        }
        return this.fieldViews.get(fieldId);
    }

    activeFieldId() {
        return this.getGame().appState.navigation.activeFieldId;
    }

    // --- MAP VIEW -------------------------------------------------------

    renderMap() {
        if (!this.worldMap) {
            this.worldMap = new WorldMapPanel({
                getGame: this.getGame,
                unlockManager: this.unlockManager,
                unreadManager: this.unreadManager,
                fieldDefinitions: this.fieldDefinitions,
                onSelectField: fieldId => this.showField(fieldId),
                showToast: message => this.showToast(message)
            });
        }

        return el("section", { className: "world-map-section" }, [
            el("div", { className: "world-map-header" }, [
                el("div", {}, [
                    el("div", { className: "eyebrow", text: "THE VALLEY" }),
                    el("h2", { text: "World Map" })
                ]),
                el("button", {
                    type: "button",
                    className: "world-map-list-toggle",
                    text: "☰ LIST",
                    "aria-label": "Show field list",
                    onClick: () => this.showList()
                })
            ]),
            this.worldMap.getElement()
        ]);
    }

    // --- LIST VIEW ------------------------------------------------------

    renderList() {
        const section = el(
            "section",
            { className: "field-selection-section" },
            [
                el("div", { className: "world-map-header" }, [
                    el("div", {}, [
                        el("div", {
                            className: "eyebrow",
                            text: "GATHERING LOCATIONS"
                        }),
                        el("h2", { text: "All Fields" })
                    ]),
                    el("button", {
                        type: "button",
                        className: "world-map-list-toggle",
                        text: "🗺 MAP",
                        "aria-label": "Show world map",
                        onClick: () => this.showMap()
                    })
                ]),
                el("p", {
                    className: "muted",
                    text: "Choose a field, then enter it when you're ready."
                }),
                (this.fieldCards = el("div", {
                    className: "field-selection-list"
                }))
            ]
        );

        this.updateFieldCards();
        return section;
    }

    // --- FIELD VIEW -----------------------------------------------------

    renderActiveField() {
        const fieldId = this.activeFieldId();
        if (!fieldId) {
            this.view = "map";
            this.fieldSelectionButton = null;
            return this.renderMap();
        }

        const fieldView = this.getFieldView(fieldId);

        const back = Button("← MAP", () => this.showMap(), {
            variant: "secondary-button"
        });
        this.fieldSelectionButton = back;
        this.updateFieldSelectionBadge();

        return el("div", { className: "field-work-active-view" }, [
            el("div", { className: "field-work-toolbar" }, [back]),
            fieldView.getElement()
        ]);
    }

    // --- FIELD CARDS (list view only) ----------------------------------

    updateFieldCards() {
        if (!this.fieldCards) return;

        const game = this.getGame();

        const cards = this.fieldDefinitions.map(field => {
            const unlocked = this.unlockManager.isUnlocked(field.id);
            const active = this.activeFieldId() === field.id;

            const selectButton = el(
                "button",
                {
                    type: "button",
                    className: "field-selection-card__main",
                    disabled: !unlocked,
                    "aria-label": unlocked
                        ? `Select ${field.name}`
                        : `${field.name}, locked`,
                    onClick: () => {
                        if (!unlocked) return;
                        game.appState.navigation.activeFieldId = field.id;
                        this.save();
                        this.updateFieldCards();
                    }
                },
                [
                    el("span", { className: "field-selection-card__icon" }, [
                        createFieldIcon(field, {
                            size: 32,
                            className: "field-selection-card__icon-svg"
                        })
                    ]),
                    el("span", { className: "field-selection-card__copy" }, [
                        el(
                            "span",
                            {
                                className: "field-selection-card__title",
                                dataset: { fieldTitle: field.id }
                            },
                            [el("strong", { text: field.name })]
                        ),
                        el("span", {
                            className: "field-selection-card__description",
                            text: unlocked
                                ? field.description
                                : `Requires ${field.unlockTrigger?.amount ?? 0} ${
                                      this.materialName(
                                          field.unlockTrigger?.item
                                      ) ??
                                      field.unlockTrigger?.item ??
                                      "resources"
                                  } Samples`
                        }),
                        unlocked ? this.renderFieldMaterials(field) : null
                    ])
                ]
            );

            const actions = el(
                "span",
                { className: "field-selection-card__actions" },
                [
                    el("span", {
                        className: "field-selection-card__status",
                        text: !unlocked
                            ? "LOCKED"
                            : active
                              ? "SELECTED"
                              : "AVAILABLE"
                    }),
                    ...(unlocked && active
                        ? [
                              Button(
                                  "GO",
                                  () => {
                                      this.navigateTo({
                                          tab: "fieldWork",
                                          pageId: field.id
                                      });
                                  },
                                  { variant: "primary-button" }
                              )
                          ]
                        : [])
                ]
            );

            return el(
                "div",
                {
                    className: [
                        "field-selection-card",
                        unlocked ? "is-unlocked" : "is-locked",
                        active ? "is-active" : ""
                    ]
                        .filter(Boolean)
                        .join(" ")
                },
                [selectButton, actions]
            );
        });

        this.fieldCards.replaceChildren(...cards);
        this.refreshBadges();
    }

    getBadge(fieldId) {
        if (!this.badges.has(fieldId)) {
            this.badges.set(
                fieldId,
                new NewBadge({
                    unreadManager: this.unreadManager,
                    tabId: "fieldWork",
                    itemId: `field-${fieldId}`,
                    getElement: () =>
                        [
                            ...(this.fieldCards?.querySelectorAll(
                                "[data-field-title]"
                            ) ?? [])
                        ].find(el => el.dataset.fieldTitle === fieldId),
                    placement: "inline",
                    ariaLabel: "New field"
                })
            );
        }
        return this.badges.get(fieldId);
    }

    refreshBadges() {
        for (const field of this.fieldDefinitions) {
            this.getBadge(field.id).refresh();
        }
        // Map pins render unread state directly; refresh them too.
        if (this.view === "map") {
            this.worldMap?.update?.();
        }
    }

    hasUnread() {
        return this.fieldDefinitions.some(field =>
            this.unreadManager.isUnread("fieldWork", `field-${field.id}`)
        );
    }

    updateFieldSelectionBadge() {
        const button = this.fieldSelectionButton;
        if (!button) return;
        button.querySelector(".field-selection-button__badge")?.remove();
        if (!this.hasUnread()) return;
        button.append(
            Badge({
                text: "NEW",
                variant: "new",
                className: "field-selection-button__badge",
                ariaLabel: "New field content"
            })
        );
    }

    refreshFieldSprites() {
        for (const view of this.fieldViews.values()) {
            view.refreshSprites?.();
        }
    }

    deactivateField() {
        for (const view of this.fieldViews.values()) {
            view.deactivate?.();
        }
    }

    refreshFieldBackgrounds() {
        for (const view of this.fieldViews.values()) {
            view.refreshBackground?.();
        }
    }

    renderFieldMaterials(field) {
        const breakdown = getFieldSpawnBreakdown(field);
        if (breakdown.length === 0) return null;

        const top = breakdown.slice(0, 3);

        return el(
            "span",
            {
                className: "field-selection-card__materials",
                "aria-label": `Field materials: ${top
                    .map(
                        b =>
                            `${this.materialName(b.materialId)} ${Math.round(b.percent)}%`
                    )
                    .join(", ")}`
            },
            top.map(spawn => {
                const pct = Math.round(spawn.percent);
                const name = this.materialName(spawn.materialId);

                return el(
                    "span",
                    {
                        className: "field-selection-card__chip",
                        title: `${name} · ${pct}%`
                    },
                    [
                        MaterialIcon(spawn.materialId, {
                            size: 14,
                            variant: "core",
                            className: "field-selection-card__chip-icon"
                        }),
                        el("span", {
                            className: "field-selection-card__chip-label",
                            text: `${pct}%`
                        })
                    ]
                );
            })
        );
    }

    materialName(materialId) {
        return materials.find(m => m.id === materialId)?.name ?? materialId;
    }
}
