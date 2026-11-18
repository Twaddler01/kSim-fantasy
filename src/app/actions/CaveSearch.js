// src/app/actions/CaveSearch.js
//
// Coordinates the cave-search workflow.
// Search availability is session-local and resets on page reload.

import { getCave } from "../../data/caves.js";
import { getLootTable } from "../../data/lootTables.js";
import { rollFromLootTable } from "../../systems/loot.js";

export default class CaveSearch {
    constructor({ getGame, save, refreshUI }) {
        this.getGame = getGame;
        this.save = save;
        this.refreshUI = refreshUI;

        // Session-local: deliberately not persisted.
        this.searchedCaves = new Set();
    }

    hasSearched(caveId) {
        return this.searchedCaves.has(caveId);
    }

    search(caveId) {
        const cave = getCave(caveId);

        if (!cave) {
            return { ok: false, reason: "unknown-cave" };
        }

        if (this.hasSearched(caveId)) {
            return { ok: false, reason: "already-searched" };
        }

        const table = getLootTable(cave.lootTableId);

        if (!table) {
            return { ok: false, reason: "missing-loot-table" };
        }

        const items = rollFromLootTable(this.getGame(), table);

        // Only mark as searched after a successful loot roll.
        this.searchedCaves.add(caveId);

        this.save();
        this.refreshUI({ database: true });

        return {
            ok: true,
            items,
            newlyDiscovered: items.filter(
                item => item.newlyDiscovered && !item.failed
            )
        };
    }
}
