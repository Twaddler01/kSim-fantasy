// src/domain/progressionProcessing.js
//
// Event-driven progression: unlock processing, batch handling, and the
// "zone unlocked" notification fanout.
//
// processProgression() is idempotent and reentrant-safe: it processes
// events in batches, since completing one trigger can satisfy another
// (chain: forgeMastery requires 3 iron ingots; if you smelt the 3rd
// during a batch, the event processor picks it up on the next loop).

import { createZoneIcon } from "../ui/zoneIcons.js";

export function createProgressionProcessor({
    getGame,
    save,
    logEvent,
    showToast,
    notifyUnread,
    showAnnouncement,
    unlockManager,
    eventProcessor,
    zoneDefinitions
}) {
    const game = () => getGame();

    function handleZoneUnlock(zoneId, { notify = true } = {}) {
        if (!unlockManager.unlock(zoneId)) return false;

        const zone = zoneDefinitions.find(item => item.id === zoneId);
        if (!zone) return false;

        if (notify) {
            notifyUnread("world", `zone-${zoneId}`);
        }

        logEvent(game(), `NEW ZONE DISCOVERED: ${zone.name} unlocked.`, {
            category: "activity",
            tab: "log"
        });

        if (notify) {
            showToast(`${zone.name} unlocked!`);

            showAnnouncement({
                title: "NEW ZONE DISCOVERED",
                message: `${zone.name}: ${zone.description}`,
                symbol: createZoneIcon(zone, { size: 44 })
            });
        }

        return true;
    }

    function processProgression({ notify = true } = {}) {
        let changed = false;
        let batch;

        // Process repeatedly because completing one event
        // can satisfy another event's trigger.
        do {
            batch = eventProcessor.process();

            for (const event of batch) {
                const { id, definition } = event;
                const content = definition.content;

                // Progression system becomes permanently available.
                if (id.startsWith("progression:")) {
                    const unlockId = id.slice("progression:".length);
                    if (!unlockManager.unlock(unlockId)) continue;

                    logEvent(game(), `NEW SYSTEM AVAILABLE: ${content.name}.`, {
                        category: "activity",
                        tab: "log"
                    });

                    if (notify) {
                        showToast(`${content.name} unlocked!`);
                    }

                    changed = true;
                    continue;
                }

                // Upgrade becomes permanently available.
                if (id.startsWith("upgrade:")) {
                    const upgradeId = id.slice("upgrade:".length);
                    if (!unlockManager.unlock(upgradeId)) continue;

                    const upgrade = content;

                    if (upgrade) {
                        if (notify) {
                            notifyUnread("equipment", upgradeId);
                        }

                        logEvent(
                            game(),
                            `NEW EQUIPMENT AVAILABLE: ${upgrade.name}.`,
                            {
                                category: "activity",
                                tab: "equipment"
                            }
                        );

                        if (notify) {
                            showToast(`${upgrade.name} unlocked!`);
                        }
                    }

                    changed = true;
                    continue;
                }

                // Gathering zone becomes permanently available.
                if (id.startsWith("zone:")) {
                    const zoneId = id.slice("zone:".length);
                    if (handleZoneUnlock(zoneId, { notify })) {
                        changed = true;
                    }
                }
            }
        } while (batch.length > 0);

        // The remembered zone must always remain unlocked.
        const navigation = game().appState.navigation;
        const activeZoneId = navigation.activeZoneId;

        if (activeZoneId && !unlockManager.isUnlocked(activeZoneId)) {
            navigation.activeZoneId = null;
            changed = true;
        }

        if (changed) {
            save();
        }

        return changed;
    }

    return { processProgression, handleZoneUnlock };
}
