// src/app/actions/ZoneActions.js
//
// Coordinates application workflows triggered by zone interactions.
// Game operations remain in their respective systems.
// UI access is provided through the presentation interface.

import { gatherMaterial } from "../../systems/MaterialGathering.js";
import { getLootTable } from "../../data/lootTables.js";
import { rollFromLootTable } from "../../systems/loot.js";
import { materials } from "../../data/materials.js";
import { getResultMessage } from "../../notifications/resultMessages.js";

export default class ZoneActions {
    constructor({
        getGame,
        save,
        refreshUI,
        showToast,
        showAnnouncement,
        logEvent,
        processProgression,
        resourcePopups,
        presentation,
        lootSystem
    }) {
        this.getGame = getGame;
        this.save = save;
        this.refreshUI = refreshUI;
        this.showToast = showToast;
        this.showAnnouncement = showAnnouncement;
        this.logEvent = logEvent;
        this.processProgression = processProgression;
        this.resourcePopups = resourcePopups;
        this.presentation = presentation;
        this.lootSystem = lootSystem;

        if (!this.lootSystem) {
            throw new Error("ZoneActions requires a LootSystem instance.");
        }

        // Preserve method context when passed as callbacks.
        this.handleGather = this.handleGather.bind(this);
        this.handleEncounter = this.handleEncounter.bind(this);
        this.handleOpenCache = this.handleOpenCache.bind(this);
        this.handleEnterCave = this.handleEnterCave.bind(this);
        this.announceDiscoveriesFrom = this.announceDiscoveriesFrom.bind(this);
    }

    handleGather(zone, event, target) {
        const game = this.getGame();
        const result = gatherMaterial(game, target.id, target.richness ?? 1);

        if (!result.ok) {
            this.showToast(getResultMessage(result.reason));
            return false;
        }

        this.resourcePopups.show(
            [
                {
                    amount: result.amount,
                    icon: result.item.icon,
                    materialId: result.item.id
                }
            ],
            event
        );

        if (result.newlyDiscovered) {
            this.announceMaterialDiscovery(result.item);
        }

        this.processProgression();
        this.save();
        this.refreshUI({ database: true });

        return true;
    }

    handleEncounter(zone, screenPos, { enemyId, entity, scene }) {
        return this.presentation.startBattle(enemyId, entity, scene);
    }

    handleOpenCache(zone, screenPos, { lootTableId } = {}) {
        const table = getLootTable(lootTableId);

        if (!table) {
            this.showToast("This cache appears empty.");
            return false;
        }

        const rolledItems = rollFromLootTable(this.getGame(), table);

        const container = this.lootSystem.createContainer({
            title: "Cache Opened",
            icon: "📦",
            sourceType: "cache",
            items: rolledItems
        });

        if (this.lootSystem.isEmpty(container)) {
            this.showToast("This cache appears empty.");
            return false;
        }

        this.save();
        this.refreshUI({ database: true });

        this.presentation.showLoot(container);

        return true;
    }

    handleEnterCave(zone, screenPos, { dungeonId }) {
        this.presentation.deactivateZone();
        this.presentation.showCave(dungeonId);

        return false;
    }

    announceDiscoveriesFrom(items) {
        for (const item of items ?? []) {
            if (!item.newlyDiscovered || item.failed) continue;

            const material = materials.find(m => m.id === item.itemId);

            if (!material) continue;

            this.announceMaterialDiscovery(material);
        }
    }

    announceMaterialDiscovery(material) {
        this.logEvent(
            this.getGame(),
            `NEW MATERIAL DISCOVERED: ${material.name}.`,
            {
                category: "important",
                tab: "log"
            }
        );

        this.showAnnouncement({
            title: "NEW MATERIAL DISCOVERED",
            message: `${material.name}: ${
                material.description ?? "A new material enters your journal."
            }`,
            symbol: this.presentation.createMaterialSymbol(material.id)
        });
    }
}
