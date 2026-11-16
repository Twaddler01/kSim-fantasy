// src/utils/itemMeta.js
//
// Pure presentation helpers for item metadata: tier colors, slot display
// names, stat labels, stat comparison. No game state, no DOM. Everything
// here is a pure function of the item — safe to call from anywhere.

import { getEquipmentSlot } from "../data/equipment.js";

export const TIER_COLORS = {
    1: "var(--tier-1, #e6f5ff)",
    2: "var(--tier-2, #1eff00)",
    3: "var(--tier-3, #0070dd)",
    4: "var(--tier-4, #a335ee)",
    5: "var(--tier-5, #ff8000)"
};

const TIER_LABELS = {
    1: "Common",
    2: "Uncommon",
    3: "Rare",
    4: "Epic",
    5: "Legendary"
};

const STAT_LABELS = {
    attack: "Attack",
    defense: "Defense",
    health: "Health",
    strength: "Strength",
    agility: "Agility",
    vitality: "Vitality",
    crit: "Critical Strike"
};

const STAT_ORDER = [
    "attack",
    "defense",
    "strength",
    "agility",
    "vitality",
    "health",
    "crit"
];

export function getTierColor(item) {
    const tier = item?.tier ?? 1;
    return TIER_COLORS[tier] ?? TIER_COLORS[1];
}

export function getTierLabel(tier) {
    return TIER_LABELS[tier] ?? TIER_LABELS[1];
}

export function getSlotName(slotId) {
    return getEquipmentSlot(slotId)?.name ?? slotId;
}

export function getItemTypeLine(item) {
    if (item?.equipment?.slot) {
        const slotName = getSlotName(item.equipment.slot);
        const wt = item.equipment.weaponType;
        if (wt) {
            const cap = wt.charAt(0).toUpperCase() + wt.slice(1);
            return `${slotName} · ${cap}`;
        }
        return slotName;
    }

    switch (item?.category) {
        case "raw":
            return "Raw Material";
        case "processed":
            return "Processed Material";
        case "crafted":
            return "Crafted";
        case "resource":
            return "Resource";
        default:
            return null;
    }
}

export function getItemStats(item) {
    const stats = item?.equipment?.stats;
    if (!stats) return [];

    return Object.entries(stats)
        .filter(([, value]) => typeof value === "number" && value !== 0)
        .map(([key, value]) => ({
            key,
            label: STAT_LABELS[key] ?? key,
            value
        }))
        .sort(compareStatOrder);
}

export function compareItemStats(item, compareTo) {
    if (!compareTo) return [];

    const a = new Map(getItemStats(item).map(s => [s.key, s.value]));
    const b = new Map(getItemStats(compareTo).map(s => [s.key, s.value]));

    const keys = new Set([...a.keys(), ...b.keys()]);
    const result = [];

    for (const key of keys) {
        const current = a.get(key) ?? 0;
        const other = b.get(key) ?? 0;
        result.push({
            key,
            label: STAT_LABELS[key] ?? key,
            current,
            other,
            delta: current - other
        });
    }

    return result.sort(compareStatOrder);
}

function compareStatOrder(a, b) {
    const ia = STAT_ORDER.indexOf(a.key);
    const ib = STAT_ORDER.indexOf(b.key);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
}
