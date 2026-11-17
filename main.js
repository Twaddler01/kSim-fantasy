// main.js

// ===================================
// IMPORTS
// ===================================

import ZoneScene from "./src/ui/panels/ZoneScene.js";
import TownScene from "./src/ui/panels/TownScene.js";

import { buildMaterialSprites } from "./src/data/materialSprites.js";
let materialSprites = {};
buildMaterialSprites()
    .then(sprites => {
        materialSprites = sprites;
        ui.worldPanel?.refreshZoneSprites?.();
        refreshUI();
    })
    .catch(err => console.error("[sprites] failed:", err));

import { buildTileSprites, getTileCache } from "./src/data/tileSprites.js";
buildTileSprites()
    .then(() => {
        ui.worldPanel?.refreshZoneBackgrounds?.();
        refreshUI();
    })
    .catch(err => console.error("[tiles] failed:", err));

// Debug
import attachDebugPanel from "./debug/attach.js";

// Panels
import SynthesisPanel from "./src/ui/panels/SynthesisPanel.js";
import UpgradePanel from "./src/ui/panels/UpgradePanel.js";
import LogPanel from "./src/ui/panels/LogPanel.js";
import JournalPanel from "./src/ui/panels/journal/JournalPanel.js";
import BattleModal from "./src/ui/panels/BattleModal.js";

import MainObjective from "./src/ui/panels/MainObjective.js";
import ObjectiveTracker from "./src/ui/panels/ObjectiveTracker.js";
import { tryAdvanceStage, getCurrentStage } from "./src/data/stages.js";

import WorldPanel from "./src/ui/panels/WorldPanel.js";
import LootModal from "./src/ui/panels/LootModal.js";
import CaveModal from "./src/ui/panels/CaveModal.js";

import Inventory from "./src/ui/panels/Inventory.js";
import ItemDetailSheet from "./src/ui/components/ItemDetailSheet.js";
import { equipItem, unequipItem } from "./src/systems/equipment.js";
import { consumeItem } from "./src/systems/ConsumableSystem.js";

// Components
import { el } from "./src/ui/components/Element.js";
import { Button } from "./src/ui/components/Button.js";
// Navigation
import { Tabs } from "./src/ui/navigation/Tabs/Tabs.js";

////

import { initialGameData } from "./src/data/initialGameData.js";
import { resourceDefinitions } from "./src/data/resources.js";
import { upgradeDefinitions } from "./src/data/upgrades.js";
import { ZONE_DEFINITIONS } from "./src/data/zones.js";
import {
    addLog,
    buyUpgrade,
    upgradeCost,
    canAfford,
    costLabel,
    formatNumber
} from "./src/functions.js";

import {
    initializeInventory,
    syncInventoryDiscovery
} from "./src/data/inventory.js";

import ResourcePopups from "./src/ui/effects/ResourcePopups.js";
import SaveManager from "./src/managers/SaveManager.js";
import UnlockManager from "./src/managers/UnlockManager.js";
import EventProcessor from "./src/managers/EventProcessor.js";
import { progressionUnlocks } from "./src/data/progression.js";

import {
    navigateTo as coordinateNavigation,
    navigateToItem as navigateTabToItem,
    registerPage
} from "./src/ui/navigation/itemNavigation.js";

import { ensurePlayerInitialized } from "./src/systems/character.js";

import { createZoneHandlers } from "./src/domain/zoneHandlers.js";
import { createProgressionProcessor } from "./src/domain/progressionProcessing.js";

import UnreadManager from "./src/managers/UnreadManager.js";
import Announce from "./src/notifications/Announce.js";
import Toast from "./src/notifications/Toast.js";

const saveManager = new SaveManager({
    key: "ksim-fantasy-v2",
    initialData: initialGameData
});

const app = document.getElementById("app");

let game = saveManager.load();
initializeInventory(game);
ensurePlayerInitialized(game);

const unlockManager = new UnlockManager(game);

// Application and domain-system state.
game.appState ??= {};
game.appState.navigation ??= {};
game.appState.navigation.activeZoneId ??= null;
game.appState.trackerEnabled ??= false;
game.progression ??= { currentStage: 1 };

const eventProcessor = new EventProcessor(game);

// Permanent zone unlock definitions.
for (const zone of ZONE_DEFINITIONS) {
    unlockManager.registerUnlock({
        id: zone.id,
        initialUnlocked: false
    });

    if (zone.unlockTrigger) {
        eventProcessor.registerEvent({
            id: `zone:${zone.id}`,
            trigger: zone.unlockTrigger,
            content: zone
        });
    }
}

// Permanent upgrade unlock definitions.
for (const upgrade of upgradeDefinitions) {
    unlockManager.registerUnlock({
        id: upgrade.id,
        initialUnlocked: ["zoneTools", "swordDrills"].includes(upgrade.id)
    });

    if (upgrade.trigger) {
        eventProcessor.registerEvent({
            id: `upgrade:${upgrade.id}`,
            trigger: upgrade.trigger,
            content: upgrade
        });
    }
}

// Permanent progression unlock definitions.
for (const unlock of progressionUnlocks) {
    unlockManager.registerUnlock({
        id: unlock.id,
        initialUnlocked: unlock.initialUnlocked
    });

    eventProcessor.registerEvent({
        id: `progression:${unlock.id}`,
        trigger: unlock.trigger,
        content: unlock
    });
}

let activeTab = "camp";
let ui = {};

const announce = new Announce();
let announcementsEnabled = false;

function showAnnouncement(announcement) {
    if (!announcementsEnabled) return;

    announce.show(announcement);
}

const resourcePopups = new ResourcePopups({
    formatNumber,
    maxVisible: 5
});

function save() {
    saveManager.save(game);
}

function resetGame() {
    const fresh = saveManager.freshGame();

    if (!saveManager.save(fresh)) {
        alert("Could not reset the game because the new save failed.");
        return;
    }

    game = fresh;
    window.location.reload();
}

const unreadManager = new UnreadManager({
    getGame: () => game,
    save,
    onChange: () => {
        ui.tabs?.update({ refreshContent: false });
        ui.worldPanel?.updateZoneSelectionBadge?.();
        ui.worldPanel?.refreshBadges?.();
    },
    isTabActive: tabId => activeTab === tabId
});

function notifyUnread(tabId, itemId, options = {}) {
    unreadManager.notify(tabId, itemId, options);
}

// Starting conditions
if (unlockManager.unlock("whisperingMeadow")) {
    notifyUnread("world", "zone-whisperingMeadow");
}
if (unlockManager.unlock("ashenbrook")) {
    notifyUnread("world", "zone-ashenbrook");
}
// Ironhollow Mine unlocks via its inventoryAmount trigger (5 oak logs).

function logEvent(game, message, options = {}) {
    return addLog(game, message, {
        onUnread: notifyUnread,
        ...options
    });
}

const synthesisPanel = new SynthesisPanel({
    getGame: () => game,
    save,
    refreshUI: options => refreshUI(options),
    showToast: message => showToast(message),
    processProgression: (...args) => processProgression(...args)
});

const logPanel = new LogPanel({
    getGame: () => game,
    unreadManager,
    onChange: () => refreshUI({ database: true }),
    onNavigate: target => navigateToItem(target)
});

const journalPanel = new JournalPanel({
    getGame: () => game
});

const progression = createProgressionProcessor({
    getGame: () => game,
    save,
    logEvent,
    showToast: message => showToast(message),
    notifyUnread,
    showAnnouncement,
    unlockManager,
    eventProcessor,
    zoneDefinitions: ZONE_DEFINITIONS
});

const processProgression = progression.processProgression;

const zoneHandlers = createZoneHandlers({
    getGame: () => game,
    getUI: () => ui,
    save,
    refreshUI: options => refreshUI(options),
    showToast: message => showToast(message),
    showAnnouncement,
    logEvent,
    processProgression,
    resourcePopups
});

const worldPanel = new WorldPanel({
    getGame: () => game,
    save,
    unlockManager,
    unreadManager,
    zoneDefinitions: ZONE_DEFINITIONS,
    navigateTo: target => navigateTo(target),
    showToast: message => showToast(message),
    refreshTab: () => ui.tabs?.update({ refreshContent: true }),
    resourcePopups,

    createZone: zone => {
        if (zone.type === "town") {
            return new TownScene({
                zone,
                showToast: message => showToast(message)
            });
        }
    
        return new ZoneScene({
            zone,
            getSprites: () => materialSprites,
            getTiles: () => getTileCache(),
            onGather: zoneHandlers.handleGather,
            onEncounter: zoneHandlers.handleEncounter,
            onOpenCache: zoneHandlers.handleOpenCache,
            onEnterCave: zoneHandlers.handleEnterCave
        });
    }
});

ui.worldPanel = worldPanel;

ui.battleModal = new BattleModal({
    getGame: () => game,
    save,
    refreshUI: options => refreshUI(options),
    showToast,
    onClose: () => {
        worldPanel.update();
        const items = ui.battleModal?.battle?.rewards?.items ?? [];
        zoneHandlers.announceDiscoveriesFrom(items);
    }
});

ui.lootModal = new LootModal({
    onClose: newlyDiscovered => {
        zoneHandlers.announceDiscoveriesFrom(newlyDiscovered);
    }
});

ui.caveModal = new CaveModal({
    getGame: () => game,
    save,
    refreshUI: options => refreshUI(options),
    onClose: newlyDiscovered => {
        worldPanel.update();
        zoneHandlers.announceDiscoveriesFrom(newlyDiscovered);
    }
});

const mainObjective = new MainObjective({
    getGame: () => game,
    onToggleTracker: enabled => {
        game.appState.trackerEnabled = enabled;
        save();
        refreshUI();
    }
});

const objectiveTracker = new ObjectiveTracker({
    getGame: () => game,
    navigateToCamp: () => navigateTo({ tab: "camp" })
});

// Navigation — still registered in main because it's global,
// but delegating to the panel:
registerPage("world", "selector", {
    activate: () => worldPanel.showSelector()
});
for (const zone of ZONE_DEFINITIONS) {
    registerPage("world", zone.id, {
        activate: () => worldPanel.showZone(zone.id)
    });
}

function updateInventory() {
    ui.inventory?.update();
}

function navigateTo(target = {}) {
    return coordinateNavigation(ui.tabs, target);
}

function navigateToItem(target) {
    return navigateTabToItem(ui.tabs, target);
}

function renderDatabasePanel(title, count, content) {
    return el("section", { className: "database-view" }, [
        el("div", { className: "section-heading" }, [
            el("div", {}, [
                el("div", { className: "eyebrow", text: "DATABASE" }),
                el("h2", { text: title })
            ]),
            el("span", {
                className: "count-pill",
                text: count
            })
        ]),
        content
    ]);
}

function updateActiveDatabaseCount(count) {
    const countPill = ui.tabs?.panel?.querySelector(
        ".database-view .count-pill"
    );

    if (countPill) {
        countPill.textContent = count;
    }
}

// ========================================
// TAB CONTENT RENDERERS
// ========================================

function renderCampTab() {
    return ui.campContent;
}

function renderWorldTab() {
    return worldPanel.getElement();
}

function renderSynthesisTab() {
    return synthesisPanel.getElement();
}

function renderEquipmentTab() {
    return renderDatabasePanel(
        "Equipment",
        `${Object.values(game.upgrades).reduce((a, b) => a + b, 0)} levels`,
        upgradePanel.render()
    );
}

function renderLogTab() {
    return renderDatabasePanel(
        "Journey",
        `${game.log.length} entries`,
        logPanel.render()
    );
}

function renderJournalTab() {
    return journalPanel.getElement();
}

function renderDebugTab() {
    return debugPanel.getElement();
}

// ========================================
// TAB REGISTRATION
// ========================================

function renderTabContent() {
    const tabDefinitions = [
        {
            id: "debug",
            label: "DEBUG",
            render: renderDebugTab
        },
        {
            id: "camp",
            label: "CAMP",
            render: renderCampTab
        },
        {
            id: "world",
            label: "WORLD",
            render: renderWorldTab
        },
        {
            id: "synthesis",
            label: "SYNTHESIS",
            render: renderSynthesisTab
        },
        {
            id: "equipment",
            label: "EQUIPMENT",
            render: renderEquipmentTab
        },
        {
            id: "log",
            label: "LOG",
            render: renderLogTab
        },
        {
            id: "journal",
            label: "JOURNAL",
            render: renderJournalTab
        }
    ];

    const tabs = new Tabs({
        activeId: activeTab,
        label: "Sections",
        unreadManager,
        tabs: tabDefinitions.map(tab => ({
            ...tab,
            unread: ["camp", "world", "equipment", "log"].includes(tab.id)
        })),
        onChange: id => {
            activeTab = id;
            updateActiveTabUI();
        }
    });

    ui.tabs = tabs;

    return tabs.element;
}

const toast = new Toast();

function showToast(message, options) {
    toast.show(message, options);
}

// Evaluate conditions already satisfied by the loaded save.
processProgression({ notify: false });

function updateActiveTabUI() {
    // Stop the canvas loop when we're not on the world tab.
    if (activeTab !== "world") {
        worldPanel.deactivateZone?.();
    }

    if (activeTab === "camp") {
        const stage = getCurrentStage(game);
        if (stage) {
            unreadManager.markRead("camp", `objective-${stage.id}`);
        }
    }

    switch (activeTab) {
        case "debug":
            debugPanel.update();
            break;
        case "camp":
            updateCampTab();
            break;
        case "world":
            updateWorldTab();
            break;
        case "synthesis":
            synthesisPanel.update();
            break;
        case "equipment":
            updateEquipmentTab();
            break;
        case "log":
            updateLogTab();
            break;
        case "journal":
            updateJournalTab();
            break;
    }
}

function updateCampTab() {
    mainObjective?.update?.();
}

function updateWorldTab() {
    worldPanel.update();
}

function updateEquipmentTab() {
    upgradePanel.update();

    updateActiveDatabaseCount(
        `${Object.values(game.upgrades).reduce((a, b) => a + b, 0)} levels`
    );
}

function updateLogTab() {
    logPanel.update();

    updateActiveDatabaseCount(`${game.log.length} entries`);
}

function updateJournalTab() {
    journalPanel.update();
}

function updateSharedUI() {
    syncInventoryDiscovery(game);
    updateInventory();
}

function refreshUI({ database = false } = {}) {
    if (!ui.layout) {
        render();
        return;
    }

    const result = tryAdvanceStage(game);
    if (result.advanced) {
        save();
        if (result.to) {
            showToast(`Objective complete. New objective: ${result.to.name}.`);
            notifyUnread("camp", `objective-${result.to.id}`);
        } else {
            showToast("Objective chain complete.");
        }
    }

    updateSharedUI();
    objectiveTracker?.update?.();

    if (database) {
        ui.tabs.update({ refreshContent: false });
    }

    updateActiveTabUI();
}

const upgradePanel = new UpgradePanel({
    getGame: () => game,
    upgradeDefinitions,
    resourceDefinitions,
    upgradeCost,
    canAfford,

    buyUpgrade: (game, id) => {
        const purchased = buyUpgrade(game, id);

        if (purchased) {
            processProgression();
        }

        return purchased;
    },

    isUnlocked: id => unlockManager.isUnlocked(id),

    costLabel,
    save,
    showToast: message => showToast(message),
    refreshUI: options => refreshUI(options),
    unreadManager
});

function render() {
    if (!app) return;

    if (ui.layout) {
        updateSharedUI();
        return;
    }

    const intro = el("section", { className: "camp-intro sim-card" }, [
        el("div", {
            className: "eyebrow",
            text: "WILD REALMS // CAMP"
        }),
        el("h1", { text: "The Valley Road" }),
        el("p", {
            text:
                "The valley opens ahead of you — grass, old pines, a " +
                "hillside cut that might be iron. Gather what you can. " +
                "The journal is blank; everything you find belongs in it."
        }),
        el("div", {
            className: "camp-warning",
            text:
                "⚠ IMPORTANT: Anything you carry out of the valley " +
                "has to come from somewhere."
        })
    ]);

    const resetPanel = el(
        "section",
        {
            className: "reset-actions"
        },
        [
            Button(
                "RESET GAME",
                () => {
                    if (
                        confirm(
                            "Reset Wild Realms progress? This clears your current save."
                        )
                    ) {
                        resetGame();
                    }
                },
                {
                    variant: "secondary-button"
                }
            )
        ]
    );

    ui.campContent = el("div", { className: "camp-tab-content" }, [
        mainObjective.getElement(),
        intro,
        resetPanel
    ]);

    const topbar = el("header", { className: "topbar" }, [
        el("div", { className: "brand" }, [
            el("div", { className: "brand-mark", text: "⚔" }),
            el("div", {}, [
                el("div", {
                    className: "brand-name",
                    text: "kSim — Fantasy RPG"
                }),
                el("div", {
                    className: "brand-subtitle",
                    text: "WILD REALMS"
                })
            ])
        ]),
        el("span", {
            className: "stage-pill",
            text: "v1.0"
        })
    ]);

    ui.itemSheet = new ItemDetailSheet({
        getGame: () => game,
        onEquip: itemId => {
            const result = equipItem(game, itemId);
            if (!result.ok) {
                console.warn("[Equip] Failed:", result.reason);
                return false;
            }
            save();
            refreshUI({ database: true });
            return true;
        },
        onUnequip: slotId => {
            const result = unequipItem(game, slotId);
            if (!result.ok) {
                console.warn("[Unequip] Failed:", result.reason);
                return false;
            }
            save();
            refreshUI({ database: true });
            return true;
        },

        onUse: itemId => {
            const result = consumeItem(game, itemId);
    
            if (!result.success) {
                const messages = {
                    "health-full": "Your health is already full.",
                    "not-owned": "You don't have this item.",
                    "not-consumable": "This item cannot be consumed."
                };
    
                showToast(messages[result.reason] ?? "Unable to use item.");
                return false;
            }
    
            save();
    
            showToast(
                `Restored ${result.restored} HP. (${result.current}/${result.maximum})`
            );
    
            refreshUI({ database: true });
    
            return true;
        }
    });

    ui.inventory = new Inventory({
        getGame: () => game,
        formatNumber,
        save,
        refreshUI: options => refreshUI(options),
        openItemSheet: itemId => ui.itemSheet.show(itemId)
    });

    const layout = el("div", { className: "game-layout" }, [
        topbar,
        objectiveTracker.getElement(),
        ui.inventory.element,
        renderTabContent()
    ]);

    ui.layout = layout;
    app.replaceChildren(layout);

    updateSharedUI();
    updateCampTab();
}

window.kSim = {
    get data() { return game; },
    save,
    render,
    announce: opts => showAnnouncement(opts),
    clearStorage: () => saveManager.clear(),
    reset: resetGame,
    zoneDebug: () => {
        const zoneId = game.appState.navigation.activeZoneId;
        if (!zoneId) return { activeZone: null, message: "No active zone." };
        const scene = ui.worldPanel?.zoneViews?.get(zoneId);
        if (!scene?.canvas?.entities) {
            return { activeZone: zoneId, message: "Zone not entered yet." };
        }
        const counts = {};
        for (const e of scene.canvas.entities) {
            counts[e.type] = (counts[e.type] ?? 0) + 1;
        }
        return {
            activeZone: zoneId,
            counts,
            total: scene.canvas.entities.length,
            entities: scene.canvas.entities.map(e => ({
                type: e.type,
                icon: e.icon ?? null,
                active: e.active,
                x: Math.round(e.x),
                y: Math.round(e.y)
            }))
        };
    }
};

// --------------------------------------------------
// DEBUG TAB
// --------------------------------------------------

const debugPanel = attachDebugPanel({
    getGame: () => game,
    save,
    refreshUI,
    showToast,
    showAnnouncement,
    logEvent,
    processProgression
});

// FINAL STATE
announcementsEnabled = true;
render();