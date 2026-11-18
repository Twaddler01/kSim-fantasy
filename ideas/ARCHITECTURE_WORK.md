Worked for 29s

I'd approach this as a small architectural redesign, not another round of moving functions into different files.

And I agree with your concern about the recent `domain` integration. The goal shouldn't be to create a `domain` folder that still needs to know about the UI, saving, notifications, and application initialization. That only relocates the coupling.

I would actually change the direction of the architecture now, before adding more systems.

I reviewed the November 17 code snapshot, particularly `main.js`, `zoneHandlers.js`, `progressionProcessing.js`, and the initialization sequence. There are a few concrete things I'd change.

### 1\. First, establish the boundaries

I'd organize the application around four responsibilities.

1 · Presentation

UI layer

Panels, modals, canvas, buttons, navigation, visual notifications.

It displays information and communicates player intentions.

2 · Application

Application layer

Coordinates what happens when a player performs an action.

It calls game systems, handles the results, decides when to save, and tells the UI what to display.

3 · Domain

Game logic layer

Combat, gathering, inventory, equipment, progression, crafting, quests.

It knows the rules of the game. It does not know about HTML, modals, notifications, or browser storage.

4 · Infrastructure

Infrastructure layer

Save storage, asset loading, browser APIs, audio, and other external services.

The most important rule:

Dependencies should point inward toward game rules, not outward toward the UI.

For example, `BattleSystem` shouldn't import `BattleModal`. The modal shouldn't calculate combat damage. And the gathering rules shouldn't know how to display a toast.

### 2\. The biggest change: replace domain handlers with application actions

This is where I'd start.

Currently, `zoneHandlers.js` combines several responsibilities:

* It calls `recoverMaterial()`.

* It displays resource popups.

* It logs discoveries.

* It displays announcements.

* It processes progression.

* It saves the game.

* It refreshes the UI.

* It accesses UI modals through `getUI()`.

That's a lot for a domain handler. In particular, `getUI()` is effectively allowing domain code to reach back into the presentation layer.

I'd replace that arrangement with a dedicated application-level action coordinator.

For example:

```text
src/
├── app/
│   ├── GameActions.js
│   └── GameInitializer.js
│
├── domain/
│   ├── gathering/
│   ├── combat/
│   ├── progression/
│   └── inventory/
│
├── infrastructure/
│   ├── SaveRepository.js
│   └── AssetLoader.js
│
└── ui/
    ├── panels/
    └── components/
```

`GameActions.js` would become the bridge between the UI and the game rules—but importantly, it would be an intentional application layer, not a domain module with UI dependencies.

For example, a gathering action would conceptually look like this:

```js
async function gather(target, position) {
    const result = recoverMaterial(
        game,
        target.id,
        target.richness ?? 1
    );

    if (!result.ok) {
        ui.showToast(result.reason);
        return false;
    }

    if (result.newlyDiscovered) {
        handleDiscovery(result.item);
    }

    processProgression();

    saveGame();
    ui.showResourcePopup(result, position);
    ui.refresh();

    return true;
}
```

This is illustrative, not a final implementation. The important distinction is:

* `recoverMaterial()` belongs to the game rules.

* `processProgression()` belongs to game rules/application orchestration, depending on its responsibilities.

* `saveGame()` belongs to the application/infrastructure boundary.

* `ui.showResourcePopup()` belongs to presentation.

The application layer coordinates these operations.

And the UI never needs to know how gathering actually works.

### 3\. Progression needs the same treatment

This is another important boundary to fix.

Your `progressionProcessing.js` is currently responsible for:

* Processing unlock events.

* Updating unlock state.

* Logging discoveries.

* Triggering unread badges.

* Displaying toasts.

* Displaying announcements.

* Saving changes.

It even imports `createZoneIcon` from `ui/zoneIcons.js`. That means a progression module in your domain layer has a direct dependency on presentation.

I'd separate this into two parts.

A. Progression rules

```text
domain/progression/
├── ProgressionSystem.js
└── progressionRules.js
```

This layer determines:

* What has been unlocked?

* What conditions have been satisfied?

* What progression events occurred?

* What state needs to change?

It returns results, for example:

```js
{
    unlocked: [
        {
            type: "zone",
            id: "ironhollowMine"
        }
    ]
}
```

No toast. No icon. No announcement. No save call.

B. Application response

`GameActions.js` receives that result and decides what to do:

* Save the updated state.

* Add an activity log entry.

* Notify the unread manager.

* Ask the UI to show an announcement.

* Resolve the appropriate zone icon.

This gives us a clean separation between something happening in the game and how the application communicates that something happened.

It also means a future server could run the progression rules without needing to import your browser UI.

### 4\. Fix the initialization order deliberately

This is particularly relevant to your earlier problems.

Your current `main.js` has a mixture of:

* Module imports.

* Save loading.

* State initialization.

* Manager construction.

* Unlock registration.

* Notification construction.

* Domain processor construction.

* UI construction.

* Handler wiring.

* Asset loading.

The `getUI()` workaround exists partly because some objects need to reference UI components that don't exist yet.

We should eliminate that pattern rather than simply move it somewhere else.

I'd establish a deliberate startup sequence:

* Load game state

    Load saved data and initialize the default state.

* Create game systems

    Construct progression, unlock, inventory, and other game services.

* Create application services

    Construct `GameActions` and connect it to the game systems and persistence services.

* Create UI

    Construct panels and modals, supplying their action callbacks.

* Connect presentation

    Connect application events and UI display methods explicitly.

* Start the game

    Render the initial interface and load optional assets.

There should be no hidden assumption that a panel will exist by the time a handler gets called.

If an application action requires a UI service, that dependency should be explicitly supplied or connected during initialization.

For example, we could give `GameActions` a small presentation interface:

```js
const presentation = {
    showToast,
    showAnnouncement,
    showResourcePopup,
    refreshUI
};
```

It doesn't need to know about `BattleModal`, `LootModal`, or `WorldPanel` individually. Those are implementation details of the UI.

Similarly, a battle action can return a battle result, and the application can ask the presentation layer to display it.

### 5\. What happens to main.js?

I'd like to reduce it to a composition root.

That's a software architecture term worth learning: the composition root is the place where an application assembles its dependencies.

It doesn't implement game behavior. It doesn't calculate damage. It doesn't handle gathering. It doesn't decide how progression works.

It puts the pieces together.

Eventually, I want something conceptually like this:

```js
// main.js

import { initializeGame } from "./src/app/GameInitializer.js";

initializeGame();
```

And then:

```text
src/app/
├── GameInitializer.js
├── GameFactory.js
├── GameActions.js
└── createUI.js
```

Their responsibilities:

| File               | Responsibility                           |
| ------------------ | ---------------------------------------- |
| GameInitializer.js | Controls startup order                   |
| GameFactory.js     | Loads state and constructs game services |
| GameActions.js     | Coordinates player actions               |
| createUI.js        | Constructs and connects UI components    |

These are proposed boundaries, not a requirement to create four giant files. We should keep each module focused.

### 6\. What I would change first, in actual development order

I don't want to overwhelm you by suggesting 20 new files and a massive rewrite. I'd do this as a controlled migration, preserving existing behavior after every step.

Recommended migration plan

| Step | Change                                        | Result                              |
| ---- | --------------------------------------------- | ----------------------------------- |
| 1    | Introduce GameInitializer.js                  | Startup becomes explicit            |
| 2    | Introduce GameActions.js                      | Central application coordination    |
| 3    | Refactor gathering interaction                | First complete UI/domain separation |
| 4    | Refactor battle, cache, and cave actions      | Remove getUI() from zone handlers   |
| 5    | Separate progression rules from notifications | Domain no longer imports UI         |
| 6    | Refactor remaining main.js responsibilities   | Smaller composition root            |
| 7    | Add independent system tests                  | Safer future development            |

I'd use gathering as our first example because it exercises several parts of the application: inventory mutation, discovery, progression, saving, popups, and refreshing the interface.

Once we get that flow right, the other actions can follow the same pattern.

### 7\. A few architectural decisions I'd make now

Before we start moving code, I'd establish these conventions:

1\. Domain modules never import from `ui/`.

This should be a firm rule.

2\. Domain modules don't save.

They modify game state and return results. The application decides when persistence is needed.

3\. UI components don't directly implement game rules.

A merchant button requests a purchase; a trading system decides whether the purchase is valid.

4\. Avoid global UI references and `getUI()`.

Pass explicit dependencies or use an application-level presentation interface.

5\. Don't introduce an EventBus yet.

You may eventually benefit from one, but direct function calls are easier to understand and debug at this stage. We can introduce events when independent systems genuinely need to react to the same occurrence.

6\. Don't create classes just to have classes.

Use functions for stateless operations, classes where objects genuinely own state and lifecycle, and data objects for definitions.

### 8\. The target structure

This is the structure I'd work toward without disrupting your existing systems unnecessarily:

```text
src/
├── app/
│   ├── GameInitializer.js
│   ├── GameFactory.js
│   ├── GameActions.js
│   └── createUI.js
│
├── domain/
│   ├── gathering/
│   ├── combat/
│   ├── progression/
│   ├── inventory/
│   ├── equipment/
│   └── quests/
│
├── systems/
│   ├── BattleSystem.js
│   ├── MaterialRecovery.js
│   └── ...
│
├── managers/
│   ├── UnlockManager.js
│   └── EventProcessor.js
│
├── infrastructure/
│   ├── SaveRepository.js
│   └── AssetLoader.js
│
├── data/
│   ├── items/
│   ├── enemies/
│   ├── zones/
│   └── ...
│
├── ui/
│   ├── panels/
│   ├── components/
│   ├── navigation/
│   └── effects/
│
└── utils/
```

We don't need to move everything into these folders immediately. Some existing systems can remain where they are until we have a good reason to relocate them.

### 9\. Let's begin with the right first milestone

My recommendation is to start with Step 1: establish the application initialization structure and the GameActions interface.

I would do this in two passes:

* First, design the new startup and dependency flow without changing game behavior.

* Second, migrate gathering from `zoneHandlers.js` into the new separation and verify that it behaves exactly as before.

One important precaution: the source snapshot I reviewed is dated November 17. If you've made changes since that code dump, we should work from your latest source rather than assume every snippet is still current.

I would not delete `zoneHandlers.js` yet, and I would not rewrite `progressionProcessing.js` yet. We should migrate responsibilities deliberately, test them, and remove the old structure only when nothing depends on it.

The goal is not merely a smaller `main.js`. It's an application where you can open `BattleSystem.js`, understand its job, and work on it without needing to understand how your notification system or world map works.

That's the architecture I'd build toward.
