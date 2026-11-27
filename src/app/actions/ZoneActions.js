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
        this.handleOpenLoot = this.handleOpenLoot.bind(this);
        this.announceDiscoveriesFrom = this.announceDiscoveriesFrom.bind(this);
    }

    handleGather(zone, event, target) {
        const entity = target.entity;

        if (!entity) return false;

        let container = entity.lootContainer;

        if (!container) {
            const result = gatherMaterial(
                this.getGame(),
                target.id,
                target.richness ?? 1
            );

            if (!result.ok) {
                this.showToast(getResultMessage(result.reason));
                return false;
            }

            container = this.lootSystem.createContainer({
                title: "Gathered Materials",
                icon: "⛏️",
                sourceType: "gathering",
                items: [
                    {
                        itemId: result.itemId,
                        quantity: result.quantity
                    }
                ]
            });

            if (this.lootSystem.isEmpty(container)) {
                this.showToast("Nothing could be recovered.");
                return false;
            }

            entity.lootContainer = container;
        }

        this.presentation.showLoot(container);

        return {
            keepActive: true
        };
    }

    handleEncounter(zone, screenPos, { enemyId, entity, scene }) {
        return this.presentation.startBattle(enemyId, entity, scene);
    }

    handleOpenCache(zone, screenPos, { lootTableId, entity } = {}) {
        if (!entity) return false;

        let container = entity.lootContainer;

        if (!container) {
            const table = getLootTable(lootTableId);

            if (!table) {
                this.showToast("This cache appears empty.");
                return false;
            }

            const rolledItems = rollFromLootTable(this.getGame(), table);

            container = this.lootSystem.createContainer({
                title: "Cache Opened",
                icon: "📦",
                sourceType: "cache",
                items: rolledItems
            });

            if (this.lootSystem.isEmpty(container)) {
                this.showToast("This cache appears empty.");
                return false;
            }

            entity.lootContainer = container;
        }

        this.presentation.showLoot(container);

        return {
            keepActive: true
        };
    }

    handleEnterCave(zone, screenPos, { dungeonId }) {
        this.presentation.deactivateZone();
        this.presentation.showCave(dungeonId);

        return false;
    }

    handleOpenLoot(zone, screenPos, { container, entity } = {}) {
        if (!container || this.lootSystem.isEmpty(container)) {
            this.showToast("Nothing to collect.");
            return false;
        }
    
        this.presentation.showLoot(container);
    
        // Same contract as handleGather / handleOpenCache:
        // entity stays active, expiry timer resets each time.
        return { keepActive: true };
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
