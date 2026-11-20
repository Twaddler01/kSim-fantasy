import { el } from "../../components/Element.js";

import { getJournalEntriesByCategory } from "../../../data/journal/catalog.js";

import {
    getZoneMaterials,
    getMaterialZone,
    getRecipesUsing,
    getRecipesProducing,
    getRecipeInputs,
    getRecipeOutputs
} from "../../../data/journal/relationships.js";
import { createJournalIcon } from "./JournalIcon.js";

const TREE_SECTIONS = [
    {
        id: "locations",
        label: "LOCATIONS",
        icon: "📍"
    },
    {
        id: "zones",
        label: "ZONES",
        icon: "🌎"
    },
    {
        id: "craft",
        label: "CRAFT",
        icon: "⚙️",
        children: [
            {
                id: "refinementRecipes",
                label: "REFINEMENT",
                icon: "🧪"
            },
            {
                id: "fabricationRecipes",
                label: "FABRICATION",
                icon: "🔧"
            },
            {
                id: "assemblyRecipes",
                label: "ASSEMBLY",
                icon: "🏗️"
            }
        ]
    },
    {
        id: "rawMaterials",
        label: "RAW MATERIALS",
        icon: "🪨"
    },
    {
        id: "processedMaterials",
        label: "PROCESSED MATERIALS",
        icon: "⚙️"
    },
    {
        id: "craftedMaterials",
        label: "CRAFTED COMPONENTS",
        icon: "🔩"
    },
    {
        id: "resources",
        label: "RESOURCES",
        icon: "📦"
    }
];

export default class JournalTree {
    constructor({ getGame = () => null } = {}) {
        this.getGame = getGame;

        this.selectedEntryId = null;
        this.selectedEntryType = null;

        this.expanded = new Set(["locations", "zones", "craft"]);

        this.element = el("div", {
            className: "journal-tree-layout"
        });

        this.render();
    }

    getElement() {
        return this.element;
    }

    getEntries(category) {
        return getJournalEntriesByCategory(category) ?? [];
    }

    getSelectedEntry() {
        if (!this.selectedEntryId) return null;

        const categories = TREE_SECTIONS.flatMap(section => [
            section.id,
            ...(section.children ?? []).map(child => child.id)
        ]);

        for (const category of categories) {
            const entry = this.getEntries(category).find(
                item =>
                    item.id === this.selectedEntryId &&
                    item.type === this.selectedEntryType
            );

            if (entry) return entry;
        }

        return null;
    }

    getEntryCategory(entry) {
        if (!entry) return null;

        const categories = TREE_SECTIONS.flatMap(section => [
            section.id,
            ...(section.children ?? []).map(child => child.id)
        ]);

        return (
            categories.find(category =>
                this.getEntries(category).some(
                    item => item.id === entry.id && item.type === entry.type
                )
            ) ?? null
        );
    }

    toggleBranch(id) {
        if (this.expanded.has(id)) {
            this.expanded.delete(id);
        } else {
            this.expanded.add(id);
        }

        this.render();
    }

    selectEntry(entry) {
        if (!entry) return;

        const category = this.getEntryCategory(entry);
        if (!category) return;

        this.selectedEntryId = entry.id;
        this.selectedEntryType = entry.type;

        // Expand the entry's category.
        this.expanded.add(category);

        // Recipe categories live beneath Craft.
        if (
            [
                "refinementRecipes",
                "fabricationRecipes",
                "assemblyRecipes"
            ].includes(category)
        ) {
            this.expanded.add("craft");
            this.expanded.add(`craft:${category}`);
        }

        // If this is a material found in a zone,
        // expand that zone branch as well.
        if (entry.type === "material") {
            const zone = getMaterialZone(entry.id);

            if (zone) {
                this.expanded.add(`zone:${zone.id}`);
            }
        }

        this.render();

        const selected = this.element.querySelector(
            ".journal-tree-entry.active"
        );

        selected?.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    }

    createBranch({ id, label, icon = "", count = null, children = [] }) {
        const isExpanded = this.expanded.has(id);

        const button = el(
            "button",
            {
                type: "button",
                className: "journal-tree-branch",
                onClick: () => this.toggleBranch(id)
            },
            [
                el("span", {
                    className: "journal-tree-chevron",
                    text: isExpanded ? "▾" : "▸"
                }),
                el("span", {
                    className: "journal-tree-icon",
                    text: icon
                }),
                el("span", {
                    className: "journal-tree-label",
                    text: label
                }),
                count !== null
                    ? el("span", {
                          className: "journal-tree-count",
                          text: String(count)
                      })
                    : null
            ].filter(Boolean)
        );

        const container = el(
            "div",
            {
                className: "journal-tree-section"
            },
            [button]
        );

        if (isExpanded && children.length) {
            container.append(
                el(
                    "div",
                    {
                        className: "journal-tree-children"
                    },
                    children
                )
            );
        }

        return container;
    }

    createEntryNode(entry) {
        const isSelected =
            this.selectedEntryId === entry.id &&
            this.selectedEntryType === entry.type;

        return el(
            "button",
            {
                type: "button",
                className: ["journal-tree-entry", isSelected ? "active" : ""]
                    .filter(Boolean)
                    .join(" "),
                onClick: () => this.selectEntry(entry)
            },
            [
                createJournalIcon(entry),
                el("span", {
                    className: "journal-tree-entry-label",
                    text: entry.name
                })
            ]
        );
    }

    createEntryBranch(
        entry,
        children = [],
        branchId = `${entry.type}:${entry.id}`
    ) {
        const id = branchId;
        const isExpanded = this.expanded.has(id);

        const button = el(
            "button",
            {
                type: "button",
                className: [
                    "journal-tree-entry",
                    this.selectedEntryId === entry.id &&
                    this.selectedEntryType === entry.type
                        ? "active"
                        : ""
                ]
                    .filter(Boolean)
                    .join(" "),
                onClick: () => {
                    this.selectEntry(entry);
                    this.toggleBranch(id);
                }
            },
            [
                el("span", {
                    className: "journal-tree-chevron",
                    text: isExpanded ? "▾" : "▸"
                }),
                createJournalIcon(entry),
                el("span", {
                    className: "journal-tree-entry-label",
                    text: entry.name
                })
            ]
        );

        const container = el(
            "div",
            {
                className: "journal-tree-section"
            },
            [button]
        );

        if (isExpanded && children.length) {
            container.append(
                el(
                    "div",
                    {
                        className: "journal-tree-children"
                    },
                    children
                )
            );
        }

        return container;
    }

    renderCategoryEntries(category) {
        return this.getEntries(category).map(entry =>
            this.createEntryNode(entry)
        );
    }

    renderLocations() {
        return this.renderCategoryEntries("locations");
    }

    renderZones() {
        return this.getEntries("zones").map(zone => {
            const materials = getZoneMaterials(zone.id);

            const children = [];

            if (materials.length) {
                children.push(
                    el("div", {
                        className: "journal-tree-subheading",
                        text: "RAW RESOURCES FOUND"
                    })
                );

                children.push(
                    ...materials
                        .filter(item => item.material)
                        .map(item => this.createEntryNode(item.material))
                );
            }

            return this.createEntryBranch(zone, children, `zone:${zone.id}`);
        });
    }

    renderCraft() {
        const children = [];

        for (const category of [
            {
                id: "refinementRecipes",
                label: "REFINEMENT",
                icon: "🧪"
            },
            {
                id: "fabricationRecipes",
                label: "FABRICATION",
                icon: "🔧"
            },
            {
                id: "assemblyRecipes",
                label: "ASSEMBLY",
                icon: "🏗️"
            }
        ]) {
            const recipes = this.getEntries(category.id);

            children.push(
                this.createBranch({
                    id: `craft:${category.id}`,
                    label: category.label,
                    icon: category.icon,
                    count: recipes.length,
                    children: recipes.map(recipe =>
                        this.createEntryNode(recipe)
                    )
                })
            );
        }

        return children;
    }

    renderSection(section) {
        let children = [];

        if (section.id === "locations") {
            children = this.renderLocations();
        } else if (section.id === "zones") {
            children = this.renderZones();
        } else if (section.id === "craft") {
            children = this.renderCraft();
        } else {
            children = this.renderCategoryEntries(section.id);
        }

        return this.createBranch({
            id: section.id,
            label: section.label,
            icon: section.icon,
            count: section.children ? null : children.length,
            children
        });
    }

    renderDetails() {
        const entry = this.getSelectedEntry();

        if (!entry) {
            return el(
                "div",
                {
                    className: "journal-tree-details"
                },
                [
                    el(
                        "div",
                        {
                            className: "journal-tree-detail-heading"
                        }
                    ),
                    el("p", {
                        text: "Select an entry from the tree to view its details and relationships."
                    })
                ]
            );
        }

        const details = el("div", {
            className: "journal-tree-details"
        });

        details.append(
            el(
                "div",
                {
                    className: "journal-tree-detail-heading"
                },
                [
                    createJournalIcon(entry, {
                        size: 36,
                        className: "journal-tree-detail-icon"
                    }),
                    el("div", {}, [
                        el("div", {
                            className: "journal-eyebrow",
                            text: entry.type.toUpperCase()
                        }),
                        el("h3", {
                            text: entry.name
                        })
                    ])
                ]
            )
        );

        if (entry.description) {
            details.append(
                el("p", {
                    text: entry.description
                })
            );
        }

        this.renderRelationships(details, entry);

        return details;
    }

    renderRelationships(container, entry) {
        if (entry.type === "zone") {
            const materials = getZoneMaterials(entry.id)
                .filter(item => item.material)
                .map(item => item.material);

            this.renderRelatedSection(container, "RAW MATERIALS", materials);
        }

        if (entry.type === "material") {
            const zone = getMaterialZone(entry.id);

            if (zone) {
                this.renderRelatedSection(container, "FOUND IN ZONE", [zone]);
            }

            const usedIn = getRecipesUsing(entry.id);
            const producedBy = getRecipesProducing(entry.id);

            this.renderRelatedSection(container, "USED IN RECIPES", usedIn);

            this.renderRelatedSection(container, "PRODUCED BY", producedBy);
        }

        if (entry.type === "recipe") {
            const inputs = getRecipeInputs(entry.id);
            const outputs = getRecipeOutputs(entry.id);

            this.renderItemSection(container, "INPUTS", inputs);

            this.renderItemSection(container, "OUTPUTS", outputs);
        }
    }

    renderRelatedSection(container, heading, entries) {
        if (!entries?.length) return;

        const section = el(
            "div",
            {
                className: "journal-tree-relationship"
            },
            [
                el("h4", {
                    text: heading
                })
            ]
        );

        for (const entry of entries) {
            section.append(this.createRelatedButton(entry));
        }

        container.append(section);
    }

    renderItemSection(container, heading, items) {
        if (!items?.length) return;

        const section = el(
            "div",
            {
                className: "journal-tree-relationship"
            },
            [
                el("h4", {
                    text: heading
                })
            ]
        );

        for (const item of items) {
            const entry = item.item;

            if (!entry) continue;

            section.append(
                this.createRelatedButton(entry, `${item.amount} × `)
            );
        }

        if (section.children.length > 1) {
            container.append(section);
        }
    }

    createRelatedButton(entry, prefix = "") {
        return el(
            "button",
            {
                type: "button",
                className: "journal-tree-related",
                onClick: () => this.selectEntry(entry)
            },
            [
                el("span", {
                    text: prefix
                }),
                createJournalIcon(entry),
                el("span", {
                    text: entry.name
                })
            ]
        );
    }

    render() {
        const navigation = el("div", {
            className: "journal-tree-navigation"
        });

        for (const section of TREE_SECTIONS) {
            navigation.append(this.renderSection(section));
        }

        this.element.replaceChildren(navigation, this.renderDetails());
    }

    update() {
        this.render();
    }
}
