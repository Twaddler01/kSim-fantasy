// main.js

// ===================================
// IMPORTS
// ===================================

import ZoneScene from "../ui/panels/ZoneScene.js";
import TownScene from "../ui/panels/TownScene.js";
import { buildMaterialSprites } from "../data/materialSprites.js";
import { buildTileSprites, getTileCache } from "../data/tileSprites.js";
import { MaterialIcon } from "../assets/icons/materials/MaterialIcon.js";

// Debug
import attachDebugPanel from "../../debug/attach.js";
import DebugButton from "../../debug/DebugButtons.js";

// Overlay
import OverlayManager from "../ui/overlays/OverlayManager.js";
import WorldHUD from "../ui/hud/WorldHUD.js";

// Panels
import CraftingPanel from "../ui/panels/CraftingPanel.js";
import UpgradePanel from "../ui/panels/UpgradePanel.js";
import LogPanel from "../ui/panels/LogPanel.js";
import JournalPanel from "../ui/panels/journal/JournalPanel.js";
import Character from "../ui/panels/Character.js";

import BattleModal from "../ui/panels/BattleModal.js";
import BattleController from "../systems/BattleController.js";
import BattleControls from "../ui/hud/BattleControls.js";

import MainObjective from "../ui/panels/MainObjective.js";
import ObjectiveTracker from "../ui/panels/ObjectiveTracker.js";
import { tryAdvanceStage, getCurrentStage } from "../systems/StageSystem.js";

import WorldPanel from "../ui/panels/WorldPanel.js";
import LootModal from "../ui/panels/LootModal.js";
import CaveModal from "../ui/panels/CaveModal.js";

import Inventory from "../ui/panels/Inventory.js";
import ItemDetailSheet from "../ui/components/ItemDetailSheet.js";

// Components
import { el } from "../ui/components/Element.js";
import { Button } from "../ui/components/Button.js";

// Navigation
import GameUI from "../ui/GameUI.js";

import { initialGameData } from "../data/initialGameData.js";
import { resourceDefinitions } from "../data/resources.js";
import { upgradeDefinitions } from "../data/upgrades.js";
import { ZONE_DEFINITIONS } from "../data/zones.js";
import {
    addLog,
    buyUpgrade,
    upgradeCost,
    canAfford,
    costLabel,
    formatNumber
} from "../functions.js";

import {
    initializeInventory,
    syncInventoryDiscovery
} from "../systems/InventorySystem.js";

import ResourcePopups from "../ui/effects/ResourcePopups.js";
import SaveManager from "../managers/SaveManager.js";
import UnlockManager from "../managers/UnlockManager.js";
import EventProcessor from "../managers/EventProcessor.js";
import { progressionUnlocks } from "../data/progression.js";

import {
    navigateTo as coordinateNavigation,
    navigateToItem as navigateTabToItem,
    registerPage
} from "../ui/navigation/itemNavigation.js";

import { ensurePlayerInitialized } from "../systems/character.js";

import ProgressionService from "./services/ProgressionService.js";
import ZoneActions from "./actions/ZoneActions.js";
import ItemActions from "./actions/ItemActions.js";
import { createZoneIcon } from "../ui/zoneIcons.js";
import CaveSearch from "./actions/CaveSearch.js";

import UnreadManager from "../managers/UnreadManager.js";
import Announce from "../notifications/Announce.js";
import Toast from "../notifications/Toast.js";

export function startGame() {
    const saveManager = new SaveManager({
        key: "ksim-fantasy-v2",
        initialData: initialGameData
    });

    const app = document.getElementById("app");

    let game = saveManager.load();
    initializeInventory(game);
    ensurePlayerInitialized(game.player, game.equipment);

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

    let gameUI = null;
    let ui = {};

    const worldHUD = new WorldHUD({
        getPlayer: () => game.player,
        getEquipment: () => game.equipment,
    
        onActionChange: (actionId, selectedData) => {
            const zoneId = game.appState.navigation.activeZoneId;
            const scene = worldPanel?.zoneViews?.get(zoneId);
    
            scene?.setSelectedAction(
                actionId,
                selectedData?.entity
            );
        }
    });

    let materialSprites = {};
    buildMaterialSprites()
        .then(sprites => {
            materialSprites = sprites;
            ui.worldPanel?.refreshZoneSprites?.();
            refreshUI();
        })
        .catch(err => console.error("[sprites] failed:", err));

    buildTileSprites()
        .then(() => {
            ui.worldPanel?.refreshZoneBackgrounds?.();
            refreshUI();
        })
        .catch(err => console.error("[tiles] failed:", err));

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
            gameUI?.updateNavigation();
            ui.worldPanel?.refreshUnreadIndicators?.();
        },
        isTabActive: tabId => {
            const activeId = gameUI?.activeDestinationId;

            return (
                activeId === tabId || (tabId === "world" && activeId === "map")
            );
        }
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

    // Ensure the saved active zone exists and is unlocked.
    const activeZoneId = game.appState.navigation.activeZoneId;

    const activeZoneExists = ZONE_DEFINITIONS.some(
        zone => zone.id === activeZoneId
    );

    if (!activeZoneExists || !unlockManager.isUnlocked(activeZoneId)) {
        game.appState.navigation.activeZoneId = "whisperingMeadow";
        saveManager.save(game);
    }

    function logEvent(game, message, options = {}) {
        return addLog(game, message, {
            onUnread: notifyUnread,
            ...options
        });
    }

    const craftingPanel = new CraftingPanel({
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

    const progression = new ProgressionService({
        getGame: () => game,
        save,
        logEvent,
        showToast: message => showToast(message),
        notifyUnread,
        showAnnouncement,
        unlockManager,
        eventProcessor,
        zoneDefinitions: ZONE_DEFINITIONS,
        createZoneSymbol: createZoneIcon
    });

    const processProgression = progression.processProgression;

    // UI references used by the presentation adapter.
    // WorldPanel creates zones lazily, so these are initialized
    // before any zone interaction can occur.

    let worldPanel;
    let battleModal;
    let lootModal;
    let caveModal;
    let battleController = null;
    let battleControls = null;

    const zoneActions = new ZoneActions({
        getGame: () => game,
        save,
        refreshUI: options => refreshUI(options),
        showToast: message => showToast(message),
        showAnnouncement,
        logEvent,
        processProgression,
        resourcePopups,

        presentation: {
            deactivateZone: () => worldPanel?.deactivateZone?.(),
            startBattle: (enemyId, entity, scene) =>
                battleController?.start(enemyId, entity, scene) ?? false,
            showLoot: rewards => lootModal.show(rewards),
            showCave: dungeonId => caveModal.show(dungeonId),
            createMaterialSymbol: materialId =>
                MaterialIcon(materialId, { size: 44 })
        }
    });

    worldPanel = new WorldPanel({
        getGame: () => game,
        save,
        unlockManager,
        unreadManager,
        zoneDefinitions: ZONE_DEFINITIONS,
        refreshTab: () => {
            worldPanel?.update();
            gameUI?.updateActiveDestination();
        },
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
                onSelect: target => {
                    if (target) {
                        worldHUD.setTarget(target);
                    } else {
                        worldHUD.clearTarget();
                    }
                },
                onGather: zoneActions.handleGather,
                onEncounter: zoneActions.handleEncounter,
                onUpdate: (dt, scene) => {
                    battleController?.update(dt, scene);
                    updateBattleControls();
                    worldHUD.update();
                },
                onOpenCache: zoneActions.handleOpenCache,
                onEnterCave: zoneActions.handleEnterCave
            });
        },
        onZoneEnter: () => ui.overlayManager?.close()
    });

    ui.worldPanel = worldPanel;

    battleController = new BattleController({
        getGame: () => game,
        worldHUD,
        save,
        refreshUI,
        showToast,
    
        onFinish: battle => {
            zoneActions.announceDiscoveriesFrom(
                battle.rewards?.items
            );
        }
    });

    battleControls = new BattleControls({
        onAttack: () => {
            battleController?.beginAttack();
            updateBattleControls();
        },
    
        onFlee: () => {
            battleController?.flee();
            updateBattleControls();
        },
    
        onFocusEnemy: () => {
            battleController?.scene?.focusEntity(
                battleController?.enemyEntity
            );
        }
    });
    
    function updateBattleControls() {
        const battle = battleController?.battle;
        const enemy = battleController?.enemyEntity;
        const scene = battleController?.scene;
    
        const inRange = Boolean(
            enemy && scene?.isEnemyInAttackRange(enemy)
        );
    
        battleControls?.update(battle, {
            enemy,
            inRange
        });
    }

    // Initialize the world viewport from the saved location.
    worldPanel.showZone(game.appState.navigation.activeZoneId);

    battleModal = new BattleModal({
        getGame: () => game,
        save,
        refreshUI: options => refreshUI(options),
        showToast,
        onClose: () => {
            worldPanel.update();
            const items = ui.battleModal?.battle?.rewards?.items ?? [];
            zoneActions.announceDiscoveriesFrom(items);
        }
    });

    ui.battleModal = battleModal;

    lootModal = new LootModal({
        onClose: newlyDiscovered => {
            zoneActions.announceDiscoveriesFrom(newlyDiscovered);
        }
    });

    ui.lootModal = lootModal;

    const caveSearch = new CaveSearch({
        getGame: () => game,
        save,
        refreshUI: options => refreshUI(options)
    });

    caveModal = new CaveModal({
        getGame: () => game,
        searchCave: caveId => caveSearch.search(caveId),
        hasSearched: caveId => caveSearch.hasSearched(caveId),
        onClose: newlyDiscovered => {
            worldPanel.update();
            zoneActions.announceDiscoveriesFrom(newlyDiscovered);
        }
    });

    ui.caveModal = caveModal;

    const mainObjective = new MainObjective({
        getGame: () => game,
        onToggleTracker: enabled => {
            game.appState.trackerEnabled = enabled;
            save();
            refreshUI();
        }
    });

    const objectiveTracker = new ObjectiveTracker({
        getGame: () => game
    });

    // World map.
    registerPage("world", "map", {
        activate: () => ui.overlayManager?.open("map") ?? false
    });

    // Default WORLD viewport.
    registerPage("world", "selector", {
        activate: () => {
            ui.overlayManager?.close();

            const zoneId = game.appState.navigation.activeZoneId;

            if (zoneId) {
                return worldPanel.showZone(zoneId);
            }

            return worldPanel.showBlank();
        }
    });

    // Individual zones load into the same viewport.
    for (const zone of ZONE_DEFINITIONS) {
        registerPage("world", zone.id, {
            activate: () => {
                ui.overlayManager?.close();
                return worldPanel.showZone(zone.id);
            }
        });
    }

    function navigateTo(target = {}) {
        return coordinateNavigation(gameUI, target);
    }

    function navigateToItem(target) {
        return navigateTabToItem(gameUI, target);
    }

    const toast = new Toast();

    function showToast(message, options) {
        toast.show(message, options);
    }

    // Evaluate conditions already satisfied by the loaded save.
    processProgression({ notify: false });

    function updateSharedUI() {
        syncInventoryDiscovery(game);
        worldHUD.update();
        //ui.character?.update();
        //ui.inventory?.update();
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
                showToast(
                    `Objective complete. New objective: ${result.to.name}.`
                );
                notifyUnread("camp", `objective-${result.to.id}`);
            } else {
                showToast("Objective chain complete.");
            }
        }

        updateSharedUI();
        objectiveTracker?.update?.();
        worldPanel?.update();
        gameUI?.updateActiveDestination();
    }

    const itemActions = new ItemActions({
        getGame: () => game,
        save,
        refreshUI,
        showToast
    });

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
            onEquip: itemActions.equip,
            onUnequip: itemActions.unequip,
            onUse: itemActions.use
        });

        ui.character = new Character({
            getPlayer: () => game.player,
            getEquipment: () => game.equipment,
            openItemSheet: itemId => ui.itemSheet.show(itemId)
        });

        ui.inventory = new Inventory({
            getGame: () => game,
            formatNumber,
            openItemSheet: itemId => ui.itemSheet.show(itemId)
        });

        ui.overlayManager = new OverlayManager({
            panels: {
                character: {
                    title: "Character",
                    getElement: () => ui.character.element,
                    update: () => ui.character.update()
                },

                inventory: {
                    title: "Inventory",
                    getElement: () => ui.inventory.element,
                    update: () => ui.inventory.update()
                },

                craft: {
                    title: "Crafting",
                    getElement: () => craftingPanel.getElement(),
                    update: () => craftingPanel.update()
                },

                map: {
                    title: "World Map",
                    getElement: () => worldPanel.getMapElement(),
                    update: () => worldPanel.worldMap?.update()
                },
                equipment: {
                    title: "Equipment",
                    getElement: () => upgradePanel.render(),
                    update: () => upgradePanel.update()
                },

                log: {
                    title: "Journey Log",
                    getElement: () => logPanel.render(),
                    update: () => logPanel.update()
                },

                journal: {
                    title: "Journal",
                    getElement: () => journalPanel.getElement(),
                    update: () => journalPanel.update()
                },

                debug: {
                    title: "Debug",
                    getElement: () => debugPanel.getElement(),
                    update: () => debugPanel.update()
                }
            },
            onChange: id => gameUI?.handleOverlayChange(id)
        });

        gameUI = new GameUI({
            getGame: () => game,
            unreadManager,
            overlayManager: ui.overlayManager,

            panels: {
                debugPanel,
                mainObjective,
                worldPanel,
                craftingPanel,
                upgradePanel,
                logPanel,
                journalPanel,
                character: ui.character,
                inventory: ui.inventory
            }
        });

        const navigationElement = gameUI.createNavigation();

        ui.navigationBar = gameUI.navigationBar;

        // The world is now a permanent part of the layout.
        const worldWorkspace = el(
            "div",
            {
                className: "world-workspace"
            },
            [
                worldPanel.getElement(),
                worldHUD.getElement(),
                battleControls.getElement(),
                ui.overlayManager.getElement()
            ]
        );

        ui.worldWorkspace = worldWorkspace;

        const layout = el("div", { className: "game-layout" }, [
            topbar,
            objectiveTracker.getElement(),
            worldWorkspace,
            navigationElement
        ]);

        ui.layout = layout;
        app.replaceChildren(layout);

        updateSharedUI();
        mainObjective.update();
    }

    window.kSim = {
        get data() {
            return game;
        },
        save,
        render,
        announce: opts => showAnnouncement(opts),
        clearStorage: () => saveManager.clear(),
        reset: resetGame,
        zoneDebug: () => {
            const zoneId = game.appState.navigation.activeZoneId;
            if (!zoneId)
                return { activeZone: null, message: "No active zone." };
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
        },
        worldPanel: ui.worldPanel
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
        processProgression,
        resetGame
    });

    const _showMap = new DebugButton({
        id: "btn1",
        description: "show map",
        label: "show map",
        run: () => worldPanel.showMap()
    });

    const _showZone = new DebugButton({
        id: "btn2",
        description: "show zone",
        label: "show zone",
        run: () => {
            const activeZoneId = game.appState.navigation.activeZoneId;
            worldPanel.showZone(activeZoneId);
        }
    });

    const _selectWhisper = new DebugButton({
        id: "btn3",
        description: "show whisperingMeadow",
        label: "show whisperingMeadow",
        run: () => {
            const activeZoneId = "whisperingMeadow";
            worldPanel.showZone(activeZoneId);
        }
    });

    // FINAL STATE
    announcementsEnabled = true;
    render();
}
