import { upgradeDefinitions } from "./data/upgrades.js";
import { addInventoryItem, removeInventoryItem } from "./data/inventory.js";

export const LOG_RETENTION = {
    important: 100,
    activity: 50
};

export function formatNumber(value) {
    return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: value < 10 ? 1 : 0
    }).format(value || 0);
}

export function trimLog(game, limits = LOG_RETENTION) {
    game.log ??= [];
    for (const category of ["important", "activity"]) {
        const limit = Math.max(
            0,
            Math.floor(limits[category] ?? LOG_RETENTION[category])
        );
        const matching = game.log.filter(entry =>
            category === "important"
                ? entry.category === "important"
                : entry.category !== "important"
        );
        if (matching.length <= limit) continue;
        const removedIds = new Set(matching.slice(limit).map(e => e.id));
        game.log = game.log.filter(entry => !removedIds.has(entry.id));
    }
}

export function addLog(
    game,
    message,
    {
        category = "activity",
        tab = "log",
        onUnread = () => {},
        contentId = null,
        notificationTargets = null,
        link = null,
        onceKey = null
    } = {}
) {
    if (typeof message !== "string" || !message.trim()) {
        console.warn("Ignored empty log entry:", { message, category, tab });
        return null;
    }
    game.log ??= [];
    game.logSequence ??= Math.max(0, ...game.log.map(entry => entry.id ?? 0));
    game.logOnce ??= {};
    const alreadyLogged = onceKey != null && game.logOnce[onceKey];
    const effectiveCategory = alreadyLogged ? "activity" : category;
    if (onceKey != null) game.logOnce[onceKey] = true;
    const id = ++game.logSequence;
    game.log.unshift({
        id,
        message,
        category: effectiveCategory,
        tab,
        timestamp: Date.now(),
        ...(link ? { link } : {})
    });
    trimLog(game);
    if (notificationTargets) {
        for (const target of notificationTargets) {
            if (target.tab === "log") continue;
            onUnread(target.tab, target.itemId ?? id);
        }
    } else if (
        ["observations", "equipment"].includes(tab) &&
        contentId != null
    ) {
        onUnread(tab, contentId);
    }
    if (effectiveCategory === "important") {
        const explicitlyTargetsLog =
            notificationTargets?.some(t => t.tab === "log") ?? false;
        if (!explicitlyTargetsLog) {
            onUnread("log", id);
        } else {
            onUnread(
                "log",
                notificationTargets.find(t => t.tab === "log")?.itemId ?? id
            );
        }
    }
    return id;
}

export function canAfford(game, cost) {
    return Object.entries(cost).every(
        ([resource, amount]) => (game.inventory[resource] ?? 0) >= amount
    );
}

export function payCost(game, cost) {
    if (!canAfford(game, cost)) return false;
    for (const [resource, amount] of Object.entries(cost)) {
        removeInventoryItem(game, resource, amount);
    }
    return true;
}

export function upgradeCost(definition, level) {
    const cost = {};
    for (const [resource, amount] of Object.entries(definition.baseCost)) {
        cost[resource] = Math.ceil(amount * Math.pow(1.65, level));
    }
    return cost;
}

export function buyUpgrade(game, id) {
    const definition = upgradeDefinitions.find(item => item.id === id);
    if (!definition) return false;
    const level = game.upgrades[id] ?? 0;
    if (level >= definition.maxLevel) return false;
    if (!payCost(game, upgradeCost(definition, level))) return false;
    game.upgrades[id] = level + 1;
    addLog(
        game,
        `EQUIPMENT UPDATED: ${definition.name} is now level ${level + 1}.`
    );
    return true;
}

export function costLabel(cost, resourceDefinitions = []) {
    const names = Object.fromEntries(
        resourceDefinitions.map(item => [item.id, item.name])
    );
    return Object.entries(cost)
        .map(
            ([resource, amount]) =>
                `${formatNumber(amount)} ${names[resource] ?? resource}`
        )
        .join(" · ");
}
