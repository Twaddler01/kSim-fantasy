
// src/domain/progressionProcessing.js
//
// Event-driven progression: unlock processing, batch handling, and
// zone-unlocked notification fanout.
//
// Processes events repeatedly because one completed trigger may
// satisfy another trigger in the same progression cycle.

export default class ProgressionProcessor {
    constructor({
        getGame,
        save,
        logEvent,
        showToast,
        notifyUnread,
        showAnnouncement,
        unlockManager,
        eventProcessor,
        zoneDefinitions,
        createZoneSymbol
    }) {
        this.getGame = getGame;
        this.save = save;
        this.logEvent = logEvent;
        this.showToast = showToast;
        this.notifyUnread = notifyUnread;
        this.showAnnouncement = showAnnouncement;
        this.unlockManager = unlockManager;
        this.eventProcessor = eventProcessor;
        this.zoneDefinitions = zoneDefinitions;
        this.createZoneSymbol = createZoneSymbol;

        // These methods are passed around as callbacks.
        this.processProgression =
            this.processProgression.bind(this);

        this.handleZoneUnlock =
            this.handleZoneUnlock.bind(this);
    }

    handleZoneUnlock(zoneId, { notify = true } = {}) {
        if (!this.unlockManager.unlock(zoneId)) return false;

        const zone = this.zoneDefinitions.find(
            item => item.id === zoneId
        );

        if (!zone) return false;

        if (notify) {
            this.notifyUnread("world", `zone-${zoneId}`);
        }

        this.logEvent(
            this.getGame(),
            `NEW ZONE DISCOVERED: ${zone.name} unlocked.`,
            {
                category: "activity",
                tab: "log"
            }
        );

        if (notify) {
            this.showToast(`${zone.name} unlocked!`);

            this.showAnnouncement({
                title: "NEW ZONE DISCOVERED",
                message: `${zone.name}: ${zone.description}`,
                symbol: this.createZoneSymbol(zone, { size: 44 })
            });
        }

        return true;
    }

    processProgression({ notify = true } = {}) {
        let changed = false;
        let batch;

        // Process repeatedly because completing one event
        // can satisfy another event's trigger.
        do {
            batch = this.eventProcessor.process();

            for (const event of batch) {
                const { id, definition } = event;
                const content = definition.content;

                // Progression system becomes permanently available.
                if (id.startsWith("progression:")) {
                    const unlockId = id.slice("progression:".length);

                    if (!this.unlockManager.unlock(unlockId)) {
                        continue;
                    }

                    this.logEvent(
                        this.getGame(),
                        `NEW SYSTEM AVAILABLE: ${content.name}.`,
                        {
                            category: "activity",
                            tab: "log"
                        }
                    );

                    if (notify) {
                        this.showToast(`${content.name} unlocked!`);
                    }

                    changed = true;
                    continue;
                }

                // Upgrade becomes permanently available.
                if (id.startsWith("upgrade:")) {
                    const upgradeId = id.slice("upgrade:".length);

                    if (!this.unlockManager.unlock(upgradeId)) {
                        continue;
                    }

                    const upgrade = content;

                    if (upgrade) {
                        if (notify) {
                            this.notifyUnread("equipment", upgradeId);
                        }

                        this.logEvent(
                            this.getGame(),
                            `NEW EQUIPMENT AVAILABLE: ${upgrade.name}.`,
                            {
                                category: "activity",
                                tab: "equipment"
                            }
                        );

                        if (notify) {
                            this.showToast(`${upgrade.name} unlocked!`);
                        }
                    }

                    changed = true;
                    continue;
                }

                // Gathering zone becomes permanently available.
                if (id.startsWith("zone:")) {
                    const zoneId = id.slice("zone:".length);

                    if (this.handleZoneUnlock(zoneId, { notify })) {
                        changed = true;
                    }
                }
            }
        } while (batch.length > 0);

        // The remembered zone must always remain unlocked.
        const navigation = this.getGame().appState.navigation;
        const activeZoneId = navigation.activeZoneId;

        if (
            activeZoneId &&
            !this.unlockManager.isUnlocked(activeZoneId)
        ) {
            navigation.activeZoneId = null;
            changed = true;
        }

        if (changed) {
            this.save();
        }

        return changed;
    }
}
