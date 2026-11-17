export default class SaveManager {
    constructor({ key, initialData }) {
        this.key = key;
        this.initialData = initialData;
    }

    freshGame() {
        const game = JSON.parse(JSON.stringify(this.initialData));
        const timestamp = Date.now();

        game.log = (game.log ?? []).map(entry => ({
            ...entry,
            timestamp
        }));

        return game;
    }

    load() {
        try {
            const saved = localStorage.getItem(this.key);

            if (!saved) {
                return this.freshGame();
            }

            const parsed = JSON.parse(saved);
            if (parsed.version !== this.initialData.version) {
                console.warn(
                    `Save version mismatch: saved v${parsed.version}, expected v${this.initialData.version}.`
                );
            }
            const fresh = this.freshGame();
            const savedData = parsed;

            return {
                ...fresh,
                ...savedData,

                inventory: {
                    ...fresh.inventory,
                    ...(parsed.inventory ?? {})
                },

                upgrades: {
                    ...fresh.upgrades,
                    ...(parsed.upgrades ?? {})
                },

                events: {
                    ...(fresh.events ?? {}),
                    ...(parsed.events ?? {})
                },

                unlocks: {
                    ...(fresh.unlocks ?? {}),
                    ...(parsed.unlocks ?? {})
                },

                log: Array.isArray(parsed.log) ? parsed.log : fresh.log,

                logOnce: {
                    ...(fresh.logOnce ?? {}),
                    ...(parsed.logOnce ?? {})
                },

                tabReadIds: {
                    ...(fresh.tabReadIds ?? {}),
                    ...(parsed.tabReadIds ?? {})
                },

                unread: {
                    ...(fresh.unread ?? {}),
                    ...(parsed.unread ?? {}),
                    items: {
                        ...(fresh.unread?.items ?? {}),
                        ...(parsed.unread?.items ?? {})
                    },
                    pending: {
                        ...(fresh.unread?.pending ?? {}),
                        ...(parsed.unread?.pending ?? {})
                    },
                    badgeExcluded: {
                        ...(fresh.unread?.badgeExcluded ?? {}),
                        ...(parsed.unread?.badgeExcluded ?? {})
                    }
                },

                appState: {
                    ...(fresh.appState ?? {}),
                    ...(parsed.appState ?? {}),
                    navigation: {
                        ...(fresh.appState?.navigation ?? {}),
                        ...(parsed.appState?.navigation ?? {})
                    }
                }
            };
        } catch (error) {
            console.warn("Could not load Wild Realms save:", error);
            return this.freshGame();
        }
    }

    save(game) {
        try {
            localStorage.setItem(this.key, JSON.stringify(game));
            return true;
        } catch (error) {
            console.warn("Could not save Wild Realms:", error);
            return false;
        }
    }

    clear() {
        localStorage.removeItem(this.key);
    }
}
