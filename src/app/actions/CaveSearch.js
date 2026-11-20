// src/app/actions/CaveSearch.js
//
// Coordinates the cave-search workflow.
// Search availability is session-local and resets on page reload.

import { getCave } from "../../data/caves.js";
import { getLootTable } from "../../data/lootTables.js";
import { rollFromLootTable } from "../../systems/loot.js";
import { ok, fail } from "../../results.js";

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
            return fail("unknown-cave");
        }

        if (this.hasSearched(caveId)) {
            return fail("already-searched");
        }

        const table = getLootTable(cave.lootTableId);

        if (!table) {
            return fail("missing-loot-table");
        }

        const items = rollFromLootTable(this.getGame(), table);

        // Only mark as searched after a successful loot roll.
        this.searchedCaves.add(caveId);

        this.save();
        this.refreshUI({ database: true });

        return ok({
            items,
            newlyDiscovered: items.filter(
                item => item.newlyDiscovered && !item.failed
            )
        });
    }
}
