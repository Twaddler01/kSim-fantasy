// main.js

import FieldScene from "./src/ui/panels/FieldScene.js";
import { buildMaterialSprites } from "./src/data/materialSprites.js";

let materialSprites = {};
buildMaterialSprites()
    .then(sprites => {
        materialSprites = sprites;
        ui.fieldWorkPanel?.refreshFieldSprites?.();
        refreshUI();
    })
    .catch(err => console.error("[sprites] failed:", err));

import { buildTileSprites, getTileCache } from "./src/data/tileSprites.js";

buildTileSprites()
    .then(() => {
        ui.fieldWorkPanel?.refreshFieldBackgrounds?.();
        refreshUI();
    })
    .catch(err => console.error("[tiles] failed:", err));

// ===================================
// IMPORTS
// ===================================

// Debug
import attachDebugPanel from "./debug/attach.js";

// Icons
import { MaterialIcon } from "./src/assets/icons/materials/MaterialIcon.js";

// Panels
import SynthesisPanel from "./src/ui/panels/SynthesisPanel.js";
import UpgradePanel from "./src/ui/panels/UpgradePanel.js";
import LogPanel from "./src/ui/panels/LogPanel.js";
import JournalPanel from "./src/ui/panels/journal/JournalPanel.js";

import MainObjective from "./src/ui/panels/MainObjective.js";
import ObjectiveTracker from "./src/ui/panels/ObjectiveTracker.js";
import { tryAdvanceStage, getCurrentStage } from "./src/data/stages.js";

import FieldWorkPanel from "./src/ui/panels/FieldWorkPanel.js";
import { createFieldIcon } from "./src/ui/fieldIcons.js";

import Inventory from "./src/ui/panels/Inventory.js";
import ItemDetailSheet from "./src/ui/components/ItemDetailSheet.js";
import { equipItem, unequipItem } from "./src/systems/equipment.js";

// Components
import { el } from "./src/ui/components/Element.js";
import { Button } from "./src/ui/components/Button.js";
// Nvigation
import { Tabs } from "./src/ui/navigation/Tabs/Tabs.js";

////

import { initialGameData } from "./src/data/initialGameData.js";
import { resourceDefinitions } from "./src/data/resources.js";
import { upgradeDefinitions } from "./src/data/upgrades.js";
import { FIELD_DEFINITIONS } from "./src/data/fields.js";
import {
    addLog,
    buyUpgrade,
    upgradeCost,
    canAfford,
    costLabel,
    formatNumber
} from "./src/functions.js";

import { materials } from "./src/data/materials.js";
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

import { recoverMaterial } from "./src/systems/MaterialRecovery.js";
import {
    ensurePlayerInitialized,
    getDerivedStats
} from "./src/systems/character.js";

import UnreadManager from "./src/managers/UnreadManager.js";
import Announce from "./src/notifications/Announce.js";
import Toast from "./src/notifications/Toast.js";

const saveManager = new SaveManager({
    key: "ksim-fantasy-v1",
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
game.appState.navigation.activeFieldId ??= null;
game.appState.trackerEnabled ??= false;
game.progression ??= { currentStage: 1 };

const eventProcessor = new EventProcessor(game);

// Permanent gathering-field unlock definitions.
for (const field of FIELD_DEFINITIONS) {
    unlockManager.registerUnlock({
        id: field.id,
        initialUnlocked: false
    });

    if (field.unlockTrigger) {
        eventProcessor.registerEvent({
            id: `field:${field.id}`,
            trigger: field.unlockTrigger,
            content: field
        });
    }
}

// Permanent upgrade unlock definitions.
for (const upgrade of upgradeDefinitions) {
    unlockManager.registerUnlock({
        id: upgrade.id,
        initialUnlocked: ["fieldTools", "swordDrills"].includes(upgrade.id)
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

    // Persist the fresh game before changing the active session.
    if (!saveManager.save(fresh)) {
        alert("Could not reset the game because the new save failed.");
        return;
    }

    game = fresh;

    // Rebuild all UI and in-memory state from the saved fresh game.
    window.location.reload();
}

const unreadManager = new UnreadManager({
    getGame: () => game,
    save,
    onChange: () => {
        ui.tabs?.update({ refreshContent: false });
        ui.fieldWorkPanel?.updateFieldSelectionBadge?.();
        ui.fieldWorkPanel?.refreshBadges?.();
    },
    isTabActive: tabId => activeTab === tabId
});

function notifyUnread(tabId, itemId, options = {}) {
    unreadManager.notify(tabId, itemId, options);
}

// Starting conditions
if (unlockManager.unlock("whisperingMeadow")) {
    notifyUnread("fieldWork", "field-whisperingMeadow");
}
// Ironhollow Mine unlocks via its inventoryAmount trigger (5 oak logs).

function logEvent(game, message, options = {}) {
    return addLog(game, message, {
        onUnread: notifyUnread,
        ...options
    });
}

function handleFieldUnlock(fieldId, { notify = true } = {}) {
    if (!unlockManager.unlock(fieldId)) return false;

    const field = FIELD_DEFINITIONS.find(item => item.id === fieldId);

    if (!field) return false;

    if (notify) {
        notifyUnread("fieldWork", `field-${fieldId}`);
    }

    logEvent(game, `NEW FIELD AVAILABLE: ${field.name} unlocked.`, {
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

const synthesisPanel = new SynthesisPanel({
    getGame: () => game,
    save,
    refreshUI: options => refreshUI(options),
    showToast: message => showToast(message),
    processProgression
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

function handleFieldGather(field, event, target) {
    const result = recoverMaterial(game, target.id, target.richness ?? 1);

    if (!result.ok) {
        showToast(result.reason);
        return false;
    }

    resourcePopups.show(
        [
            {
                amount: result.amount ?? 1,
                icon: result.item.icon,
                materialId: result.item.id
            }
        ],
        event
    );

    if (result.newlyDiscovered) {
        logEvent(game, `NEW MATERIAL DISCOVERED: ${result.item.name}.`, {
            category: "important",
            tab: "log"
        });

        showAnnouncement({
            title: "NEW MATERIAL DISCOVERED",
            message: `${result.item.name}: ${
                result.item.description ?? "A new material enters your journal."
            }`,
            symbol: MaterialIcon(result.item.id, { size: 44 })
        });
    }

    processProgression();
    save();
    refreshUI({ database: true });
    return true;
}

const fieldWorkPanel = new FieldWorkPanel({
    getGame: () => game,
    save,
    unlockManager,
    unreadManager,
    fieldDefinitions: FIELD_DEFINITIONS,
    navigateTo: target => navigateTo(target),
    showToast: message => showToast(message),
    refreshTab: () => ui.tabs?.update({ refreshContent: true }),
    resourcePopups,

    createField: field =>
        new FieldScene({
            field,
            getSprites: () => materialSprites,
            getTiles: () => getTileCache(),
            onGather: handleFieldGather
        })
});

ui.fieldWorkPanel = fieldWorkPanel;

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
registerPage("fieldWork", "selector", {
    activate: () => fieldWorkPanel.showSelector()
});
for (const field of FIELD_DEFINITIONS) {
    registerPage("fieldWork", field.id, {
        activate: () => fieldWorkPanel.showField(field.id)
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

function renderFieldWorkTab() {
    return fieldWorkPanel.getElement();
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
            id: "fieldWork",
            label: "FIELD WORK",
            render: renderFieldWorkTab
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
            unread: ["camp", "fieldWork", "equipment", "log"].includes(tab.id)
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

                logEvent(game, `NEW SYSTEM AVAILABLE: ${content.name}.`, {
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

                if (!unlockManager.unlock(upgradeId)) {
                    continue;
                }

                const upgrade = content;

                if (upgrade) {
                    if (notify) {
                        notifyUnread("equipment", upgradeId);
                    }

                    logEvent(
                        game,
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
    const navigation = game.appState.navigation;
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

// Evaluate conditions already satisfied by the loaded save.
// Suppress transient notifications during initial startup.
processProgression({ notify: false });

function updateActiveTabUI() {
    // Stop the canvas loop when we're not on the fieldWork tab.
    if (activeTab !== "fieldWork") {
        fieldWorkPanel.deactivateField?.();
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
        case "fieldWork":
            updateFieldWorkTab();
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

function updateFieldWorkTab() {
    fieldWorkPanel.update();
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
            // Fire the CAMP tab badge so the player knows to check in.
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
                "⚠ FIELD NOTE: Anything you carry out of the valley " +
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
    get data() {
        return game;
    },
    save,
    render,
    clearStorage: () => saveManager.clear(),
    reset: resetGame
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
