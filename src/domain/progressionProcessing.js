// src/domain/progressionProcessing.js
//
// Event-driven progression: unlock processing, batch handling, and the
// "field unlocked" notification fanout.
//
// processProgression() is idempotent and reentrant-safe: it processes
// events in batches, since completing one trigger can satisfy another
// (chain: forgeMastery requires 3 iron ingots; if you smelt the 3rd
// during a batch, the event processor picks it up on the next loop).

import { createFieldIcon } from "../ui/fieldIcons.js";

export function createProgressionProcessor({
    getGame,
    save,
    logEvent,
    showToast,
    notifyUnread,
    showAnnouncement,
    unlockManager,
    eventProcessor,
    fieldDefinitions
}) {
    const game = () => getGame();

    function handleFieldUnlock(fieldId, { notify = true } = {}) {
        if (!unlockManager.unlock(fieldId)) return false;

        const field = fieldDefinitions.find(item => item.id === fieldId);
        if (!field) return false;

        if (notify) {
            notifyUnread("fieldWork", `field-${fieldId}`);
        }

        logEvent(game(), `NEW FIELD AVAILABLE: ${field.name} unlocked.`, {
            category: "activity",
            tab: "log"
        });

        if (notify) {
            showToast(`${field.name} unlocked!`);

            showAnnouncement({
                title: "NEW FIELD AVAILABLE",
                message: `${field.name}: ${field.description}`,
                symbol: createFieldIcon(field, { size: 44 })
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

                // Gathering field becomes permanently available.
                if (id.startsWith("field:")) {
                    const fieldId = id.slice("field:".length);
                    if (handleFieldUnlock(fieldId, { notify })) {
                        changed = true;
                    }
                }
            }
        } while (batch.length > 0);

        // The remembered field must always remain unlocked.
        const navigation = game().appState.navigation;
        const activeFieldId = navigation.activeFieldId;

        if (activeFieldId && !unlockManager.isUnlocked(activeFieldId)) {
            navigation.activeFieldId = null;
            changed = true;
        }

        if (changed) {
            save();
        }

        return changed;
    }

    return { processProgression, handleFieldUnlock };
}
