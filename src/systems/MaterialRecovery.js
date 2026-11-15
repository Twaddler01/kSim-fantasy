import { gatherMaterial } from "./MaterialGathering.js";

export function recoverMaterial(game, materialId = "ironOre", amount = 1) {
    return gatherMaterial(game, materialId ?? "ironOre", amount);
}
