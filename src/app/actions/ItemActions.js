// src/app/actions/ItemActions.js
//
// Coordinates player item actions between the UI and game systems.
// Owns application-level feedback, saving, and UI refreshes.
// Does not contain equipment or consumable game rules.

import { equipItem, unequipItem } from "../../systems/equipment.js";

import { consumeItem } from "../../systems/ConsumableSystem.js";

export default class ItemActions {
    constructor({ getGame, save, refreshUI, showToast }) {
        this.getGame = getGame;
        this.save = save;
        this.refreshUI = refreshUI;
        this.showToast = showToast;

        // These methods are passed directly to ItemDetailSheet.
        this.equip = this.equip.bind(this);
        this.unequip = this.unequip.bind(this);
        this.use = this.use.bind(this);
    }

    equip(itemId) {
        const result = equipItem(this.getGame(), itemId);

        if (!result.ok) {
            console.warn("[ItemActions] Equip failed:", result.reason);
            return false;
        }

        this.save();
        this.refreshUI({ database: true });

        return true;
    }

    unequip(slotId) {
        const result = unequipItem(this.getGame(), slotId);

        if (!result.ok) {
            console.warn("[ItemActions] Unequip failed:", result.reason);
            return false;
        }

        this.save();
        this.refreshUI({ database: true });

        return true;
    }

    use(itemId) {
        const result = consumeItem(this.getGame(), itemId);

        if (!result.success) {
            const messages = {
                "not-consumable": "That item cannot be used.",
                "not-owned": "You don't have that item.",
                "battle-limit": "You've already used that item in this battle.",
                "invalid-effect": "This item's effect is invalid.",
                "health-full": "Your health is already full.",
                "consume-failed": "Couldn't use that item.",
                "unsupported-effect": "That item's effect isn't supported yet."
            };

            this.showToast(
                messages[result.reason] ?? "Couldn't use that item."
            );

            return false;
        }

        this.save();

        if (result.effect === "restoreHealth") {
            this.showToast(`Restored ${result.restored} HP.`);
        }

        this.refreshUI({ database: true });

        return true;
    }
}
