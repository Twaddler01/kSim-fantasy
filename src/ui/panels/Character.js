// src/ui/panels/Character.js
//
// Persistent character panel.
// Displays player progression, health, stats, and equipment.
//
// State access is deliberately limited to:
//   player
//   equipment
//
// All calculations are handled by CharacterSystem.

import { el } from "../components/Element.js";
import { ItemIcon } from "../components/ItemIcon.js";
import { getItemDefinition } from "../../data/items.js";
import { EQUIPMENT_SLOTS } from "../../data/equipment.js";
import { getCharacterData } from "../../systems/character.js";

export default class Character {
    constructor({ getPlayer, getEquipment, openItemSheet }) {
        this.getPlayer = getPlayer;
        this.getEquipment = getEquipment;
        this.openItemSheet = openItemSheet ?? (() => {});

        this.values = {};
        this.bars = {};
        this.equipmentSignature = "";

        this.element = this.render();
    }

    get player() {
        return this.getPlayer();
    }

    get equipment() {
        return this.getEquipment();
    }

    get data() {
        return getCharacterData(this.player, this.equipment);
    }

    // ==================================================
    // DISPLAY HELPERS
    // ==================================================

    createBar(className) {
        const fill = el("div", {
            className: `${className}-fill`
        });

        const track = el(
            "div",
            {
                className: `${className}-track`
            },
            [fill]
        );

        return { track, fill };
    }

    setBar(bar, current, maximum) {
        const progress =
            maximum > 0 ? Math.max(0, Math.min(1, current / maximum)) : 0;

        bar.fill.style.width = `${progress * 100}%`;
    }

    createValue(className, value) {
        return el("strong", {
            className,
            text: String(value)
        });
    }

    // ==================================================
    // EQUIPMENT
    // ==================================================

    getEquipmentSignature() {
        return EQUIPMENT_SLOTS.map(slot => {
            const equipped = this.equipment?.[slot.id];
            return `${slot.id}:${equipped?.id ?? ""}`;
        }).join("|");
    }

    renderEquipment() {
        const slots = el("div", {
            className: "character-slots"
        });

        for (const slotDef of EQUIPMENT_SLOTS) {
            const equipped = this.equipment?.[slotDef.id] ?? null;
            const item = equipped ? getItemDefinition(equipped.id) : null;

            const slot = el(
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
                        if (equipped) {
                            this.openItemSheet(equipped.id);
                        }
                    }
                },
                [
                    el("span", {
                        className: "character-slot-label",
                        text: slotDef.name
                    }),

                    el(
                        "span",
                        {
                            className: "character-slot-item"
                        },
                        [
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
                        ]
                    )
                ]
            );

            slots.append(slot);
        }

        this.equipmentSignature = this.getEquipmentSignature();

        return slots;
    }

    // ==================================================
    // RENDERING
    // ==================================================

    render() {
        const data = this.data;

        const level = this.createValue("character-level-value", data.level);

        const xpText = this.createValue(
            "character-xp-value",
            `${data.xp} / ${data.xpToNext} XP`
        );

        const xpBar = this.createBar("character-xp");

        const hpText = this.createValue(
            "character-hp-value",
            `${data.hp} / ${data.maxHealth}`
        );

        const hpBar = this.createBar("character-hp");

        const attributes = el("div", {
            className: "character-attributes"
        });

        const combat = el("div", {
            className: "character-combat"
        });

        const attributeValues = {};
        const combatValues = {};

        for (const stat of ["strength", "agility", "vitality"]) {
            const value = this.createValue(
                "character-stat-value",
                data.stats[stat]
            );

            attributeValues[stat] = value;

            attributes.append(
                el(
                    "div",
                    {
                        className: "character-stat"
                    },
                    [
                        el("span", {
                            className: "character-stat-label",
                            text: stat
                        }),
                        value
                    ]
                )
            );
        }

        const combatStats = [
            ["attack", "ATK"],
            ["defense", "DEF"],
            ["crit", "CRIT"]
        ];

        for (const [stat, label] of combatStats) {
            const value = this.createValue(
                "character-stat-value",
                stat === "crit"
                    ? `${(data.stats.crit * 100).toFixed(1)}%`
                    : data.stats[stat]
            );

            combatValues[stat] = value;

            combat.append(
                el(
                    "div",
                    {
                        className: "character-stat"
                    },
                    [
                        el("span", {
                            className: "character-stat-label",
                            text: label
                        }),
                        value
                    ]
                )
            );
        }

        const stats = el(
            "div",
            {
                className: "character-stat-groups"
            },
            [
                el(
                    "section",
                    {
                        className: "character-stat-group"
                    },
                    [
                        el("h4", {
                            text: "Attributes"
                        }),
                        attributes
                    ]
                ),

                el(
                    "section",
                    {
                        className: "character-stat-group"
                    },
                    [
                        el("h4", {
                            text: "Combat"
                        }),
                        combat
                    ]
                )
            ]
        );

        this.values = {
            level,
            xpText,
            hpText,
            ...attributeValues,
            ...combatValues
        };

        this.bars = {
            xp: xpBar,
            hp: hpBar
        };

        this.setBar(xpBar, data.xp, data.xpToNext);
        this.setBar(hpBar, data.hp, data.maxHealth);

        const xpSection = el(
            "div",
            {
                className: "character-progress-section"
            },
            [
                el(
                    "div",
                    {
                        className: "character-progress-heading"
                    },
                    [
                        el("span", {
                            text: "Experience"
                        }),
                        xpText
                    ]
                ),
                xpBar.track
            ]
        );

        const hpSection = el(
            "div",
            {
                className: "character-progress-section"
            },
            [
                el(
                    "div",
                    {
                        className: "character-progress-heading"
                    },
                    [
                        el("span", {
                            text: "Health"
                        }),
                        hpText
                    ]
                ),
                hpBar.track
            ]
        );

        this.equipmentElement = this.renderEquipment();

        return el(
            "section",
            {
                className: "character-panel"
            },
            [
                el(
                    "header",
                    {
                        className: "character-header"
                    },
                    [
                        el("div", {
                            className: "character-title",
                            text: "Character"
                        }),

                        el(
                            "div",
                            {
                                className: "character-level"
                            },
                            [
                                el("span", {
                                    text: "LV"
                                }),
                                level
                            ]
                        )
                    ]
                ),

                el(
                    "div",
                    {
                        className: "character-progress"
                    },
                    [xpSection, hpSection]
                ),

                stats,

                el(
                    "section",
                    {
                        className: "character-equipment"
                    },
                    [
                        el("h4", {
                            text: "Equipment"
                        }),
                        this.equipmentElement
                    ]
                )
            ]
        );
    }

    // ==================================================
    // UPDATES
    // ==================================================

    update() {
        const data = this.data;

        // Equipment changes affect derived stats and slot contents.
        if (this.getEquipmentSignature() !== this.equipmentSignature) {
            const newElement = this.render();
            const oldElement = this.element;

            this.element = newElement;

            if (oldElement?.isConnected) {
                oldElement.replaceWith(newElement);
            }

            return;
        }

        this.values.level.textContent = data.level;

        this.values.xpText.textContent = `${data.xp} / ${data.xpToNext} XP`;

        this.values.hpText.textContent = `${data.hp} / ${data.maxHealth}`;

        this.setBar(this.bars.xp, data.xp, data.xpToNext);
        this.setBar(this.bars.hp, data.hp, data.maxHealth);

        for (const stat of ["strength", "agility", "vitality"]) {
            this.values[stat].textContent = data.stats[stat];
        }

        this.values.attack.textContent = data.stats.attack;
        this.values.defense.textContent = data.stats.defense;
        this.values.crit.textContent = `${(data.stats.crit * 100).toFixed(1)}%`;
    }
}
