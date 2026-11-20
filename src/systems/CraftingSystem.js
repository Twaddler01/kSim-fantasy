// src/systems/CraftingSystem.js
import {
    getItemDefinition,
    isKnownItem
} from "../data/items.js";
import {
    addItems,
    getItemAmount,
    isInventoryReady,
    isItemDiscovered,
    removeItems
} from "./InventorySystem.js";
import { ok, fail } from "../results.js";

/**
 * Check whether a recipe's progression requirement is unlocked.
 */
export function isRecipeUnlocked(game, recipe) {
    if (!recipe?.unlockId) return true;

    return game?.unlocks?.[recipe.unlockId] === true;
}

/**
 * Check whether the inventory contains every recipe input.
 */
export function canCraftRecipe(game, recipe) {
    if (!isInventoryReady(game) || !recipe?.inputs) {
        return false;
    }

    if (!isRecipeUnlocked(game, recipe)) {
        return false;
    }

    return Object.entries(recipe.inputs).every(
        ([itemId, required]) =>
            Number.isFinite(required) &&
            required > 0 &&
            getItemAmount(game, itemId) >= required
    );
}

/**
 * Calculate how many complete crafts the current inventory supports.
 */
export function getAvailableCrafts(game, recipe) {
    if (!isInventoryReady(game) || !recipe?.inputs) return 0;

    if (!isRecipeUnlocked(game, recipe)) return 0;

    const limits = Object.entries(recipe.inputs).map(([itemId, required]) => {
        if (!Number.isFinite(required) || required <= 0) {
            return 0;
        }

        return Math.floor(getItemAmount(game, itemId) / required);
    });

    if (!limits.length) return 0;

    const crafts = Math.min(...limits);

    // Unique recipes can only be completed once.
    if (recipe.unique) {
        const completed = game.manufacturing?.completedRecipes ?? [];

        if (completed.includes(recipe.id)) return 0;

        return Math.min(crafts, 1);
    }

    return crafts;
}

/**
 * Return a detailed affordability result for the UI.
 */
export function getRecipeStatus(game, recipe) {
    const unlocked = isRecipeUnlocked(game, recipe);

    const requirements = Object.entries(recipe.inputs ?? {}).map(
        ([itemId, required]) => {
            const available = getItemAmount(game, itemId);

            return {
                id: itemId,
                available,
                required,
                sufficient: available >= required,
                discovered: isItemDiscovered(game, itemId)
            };
        }
    );

    const ingredientsDiscovered = requirements.every(item => item.discovered);

    const hasIngredients = requirements.every(item => item.sufficient);

    const availableCrafts = getAvailableCrafts(game, recipe);

    return {
        unlocked,
        lockReason: unlocked
            ? null
            : `Requires progression unlock: ${recipe.unlockId}`,

        ingredientsDiscovered,
        hasIngredients,
        canCraft: unlocked && hasIngredients,

        requirements,

        availableCrafts,

        availableOutputs: Object.fromEntries(
            Object.entries(recipe.outputs ?? {}).map(([itemId, amount]) => [
                itemId,
                availableCrafts * amount
            ])
        )
    };
}

/**
 * Consume all inputs and grant all outputs.
 */
export function craftRecipe(game, recipe, { onProgress = () => {} } = {}) {
    if (!isInventoryReady(game) || !recipe?.inputs || !recipe?.outputs) {
        return fail("invalid-recipe");
    }

    if (!isRecipeUnlocked(game, recipe)) {
        return fail("recipe-locked", { unlockId: recipe.unlockId });
    }

    if (!canCraftRecipe(game, recipe)) {
        return fail("insufficient-materials");
    }

    const outputs = Object.entries(recipe.outputs);

    if (
        outputs.length === 0 ||
        outputs.some(
            ([itemId, amount]) =>
                !isKnownItem(itemId) ||
                !Number.isFinite(amount) ||
                amount <= 0
        )
    ) {
        return fail("invalid-outputs");
    }

    if (recipe.unique) {
        const completed = game.manufacturing?.completedRecipes ?? [];

        if (completed.includes(recipe.id)) {
            return fail("recipe-completed", { recipeId: recipe.id });
        }
    }

    const consumed = removeItems(game, recipe.inputs);

    if (!consumed.ok) {
        return fail(consumed.reason, { ...consumed });
    }

    const granted = addItems(game, recipe.outputs);

    if (!granted.ok) {
        return fail(granted.reason, { ...granted });
    }

    // Evaluate progression after all outputs are granted.
    onProgress();

    // Record completed recipes.
    game.manufacturing ??= {};
    game.manufacturing.completedRecipes ??= [];

    if (!game.manufacturing.completedRecipes.includes(recipe.id)) {
        game.manufacturing.completedRecipes.push(recipe.id);
    }

    return ok({
        recipe,
        inputs: { ...recipe.inputs },
        outputs: { ...recipe.outputs }
    });
}

export function areRecipeIngredientsDiscovered(game, recipe) {
    return Object.keys(recipe.inputs ?? {}).every(itemId => {
        return (
            getItemDefinition(itemId) !== null &&
            isItemDiscovered(game, itemId)
        );
    });
}
