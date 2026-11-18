// src/app/actions/ZoneActions.js
//
// Coordinates application workflows triggered by zone interactions.
// Game operations remain in their respective systems.
// UI access is provided through the presentation interface.

import { recoverMaterial } from "../../systems/MaterialRecovery.js";
import { startBattle } from "../../systems/BattleSystem.js";
import { getLootTable } from "../../data/lootTables.js";
import { rollFromLootTable } from "../../systems/loot.js";
import { materials } from "../../data/materials.js";
import { MaterialIcon } from "../../assets/icons/materials/MaterialIcon.js";

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
        presentation
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

        // Preserve method context when passed as callbacks.
        this.handleGather = this.handleGather.bind(this);
        this.handleEncounter = this.handleEncounter.bind(this);
        this.handleOpenCache = this.handleOpenCache.bind(this);
        this.handleEnterCave = this.handleEnterCave.bind(this);
        this.announceDiscoveriesFrom = this.announceDiscoveriesFrom.bind(this);
    }

    handleGather(zone, event, target) {
        const game = this.getGame();
        const result = recoverMaterial(game, target.id, target.richness ?? 1);

        if (!result.ok) {
            this.showToast(result.reason);
            return false;
        }

        this.resourcePopups.show(
            [
                {
                    amount: result.amount ?? 1,
                    icon: result.item.icon,
                    materialId: result.item.id
                }
            ],
            event
        );

        if (result.newlyDiscovered) {
            this.logEvent(
                game,
                `NEW MATERIAL DISCOVERED: ${result.item.name}.`,
                {
                    category: "important",
                    tab: "log"
                }
            );

            this.showAnnouncement({
                title: "NEW MATERIAL DISCOVERED",
                message: `${result.item.name}: ${
                    result.item.description ??
                    "A new material enters your journal."
                }`,
                symbol: MaterialIcon(result.item.id, { size: 44 })
            });
        }

        this.processProgression();
        this.save();
        this.refreshUI({ database: true });

        return true;
    }

    handleEncounter(zone, screenPos, { enemyId }) {
        const battle = startBattle(this.getGame(), enemyId);

        if (!battle) {
            this.showToast("Cannot start battle.");
            return false;
        }

        this.presentation.deactivateZone();
        this.presentation.showBattle(battle);

        return true;
    }

    handleOpenCache(zone, screenPos, { lootTableId }) {
        const table = getLootTable(lootTableId);

        if (!table) {
            this.showToast("This cache appears empty.");
            return false;
        }

        const items = rollFromLootTable(this.getGame(), table);
        const rewards = {
            gold: 0,
            xp: 0,
            levelUps: [],
            items
        };

        this.save();
        this.refreshUI({ database: true });

        this.presentation.showLoot({
            title: "Cache Opened",
            icon: "📦",
            rewards
        });

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
                    material.description ??
                    "A new material enters your journal."
                }`,
                symbol: MaterialIcon(material.id, { size: 44 })
            });
        }
    }
}
