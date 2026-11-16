// src/domain/fieldHandlers.js
//
// Field interaction handlers. Cohesive: every "player tapped something
// in the field" path funnels through this module. Handles gather, battle
// initiation, cache opening, cave entry, and deferred first-time
// discovery announcements.
//
// The factory captures references at construction time. `ui` is an object
// reference — its panels are populated later, but handlers only read them
// lazily at call time, so ordering is safe.

import { recoverMaterial } from "../systems/MaterialRecovery.js";
import { startBattle } from "../systems/BattleSystem.js";
import { getLootTable } from "../data/lootTables.js";
import { rollFromLootTable } from "../systems/loot.js";
import { materials } from "../data/materials.js";
import { MaterialIcon } from "../assets/icons/materials/MaterialIcon.js";

export function createFieldHandlers({
    getGame,
    getUI,
    save,
    refreshUI,
    showToast,
    showAnnouncement,
    logEvent,
    processProgression,
    resourcePopups
}) {
    const game = () => getGame();
    const ui = () => getUI();

    function handleGather(field, event, target) {
        const result = recoverMaterial(game(), target.id, target.richness ?? 1);

        if (!result.ok) {
            showToast(result.reason);
            return false;
        }

        resourcePopups.show(
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
            logEvent(game(), `NEW MATERIAL DISCOVERED: ${result.item.name}.`, {
                category: "important",
                tab: "log"
            });

            showAnnouncement({
                title: "NEW MATERIAL DISCOVERED",
                message: `${result.item.name}: ${
                    result.item.description ??
                    "A new material enters your journal."
                }`,
                symbol: MaterialIcon(result.item.id, { size: 44 })
            });
        }

        processProgression();
        save();
        refreshUI({ database: true });
        return true;
    }

    function handleEncounter(field, screenPos, { enemyId }) {
        const battle = startBattle(game(), enemyId);
        if (!battle) {
            showToast("Cannot start battle.");
            return false;
        }

        ui().fieldWorkPanel?.deactivateField?.();
        ui().battleModal.show(battle);
        return true;
    }

    function handleOpenCache(field, screenPos, { lootTableId }) {
        const table = getLootTable(lootTableId);
        if (!table) {
            showToast("This cache appears empty.");
            return false;
        }

        const items = rollFromLootTable(game(), table);
        const rewards = { gold: 0, xp: 0, levelUps: [], items };

        save();
        refreshUI({ database: true });

        ui().lootModal.show({
            title: "Cache Opened",
            icon: "📦",
            rewards
        });

        return true;
    }

    function handleEnterCave(field, screenPos, { dungeonId }) {
        ui().fieldWorkPanel?.deactivateField?.();
        ui().caveModal.show(dungeonId);
        return false;
    }

    function announceDiscoveriesFrom(items) {
        for (const item of items ?? []) {
            if (!item.newlyDiscovered || item.failed) continue;
            const material = materials.find(m => m.id === item.itemId);
            if (!material) continue;

            logEvent(game(), `NEW MATERIAL DISCOVERED: ${material.name}.`, {
                category: "important",
                tab: "log"
            });

            showAnnouncement({
                title: "NEW MATERIAL DISCOVERED",
                message: `${material.name}: ${
                    material.description ??
                    "A new material enters your journal."
                }`,
                symbol: MaterialIcon(material.id, { size: 44 })
            });
        }
    }

    return {
        handleGather,
        handleEncounter,
        handleOpenCache,
        handleEnterCave,
        announceDiscoveriesFrom
    };
}
