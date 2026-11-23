const pageRegistry = new Map();

function destinationRef({ tab, pageId, itemId } = {}) {
    return [tab, pageId, itemId]
        .filter(value => value != null && value !== "")
        .map(String)
        .join("/");
}

function warnNavigationFailure(target, reason) {
    console.warn(
        `[Navigation] Failed: ${destinationRef(target) || "(empty destination)"}`,
        { reason }
    );
}

function pageKey(tab, pageId) {
    return `${tab}\0${pageId}`;
}

function waitForRender() {
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });
    });
}

export function itemDomId(tab, itemId) {
    return `ksim-item-${tab}-${encodeURIComponent(String(itemId))}`;
}

export function registerPage(tab, pageId, handlers = {}) {
    if (!tab || !pageId) {
        throw new TypeError("registerPage requires tab and pageId.");
    }

    const key = pageKey(tab, pageId);

    pageRegistry.set(key, {
        activate: handlers.activate,
        navigateToItem: handlers.navigateToItem
    });

    return () => {
        if (
            pageRegistry.get(key)?.activate === handlers.activate &&
            pageRegistry.get(key)?.navigateToItem === handlers.navigateToItem
        ) {
            pageRegistry.delete(key);
        }
    };
}

export function unregisterPage(tab, pageId) {
    return pageRegistry.delete(pageKey(tab, pageId));
}

/**
 * Navigate to a destination, optional registered page,
 * and optional item within that page.
 *
 * gameUI is the destination coordinator.
 */
export async function navigateTo(gameUI, target = {}) {
    const { tab, pageId, itemId } = target;

    if (!gameUI || !tab) {
        warnNavigationFailure(target, "invalid-destination");
        return false;
    }

    let page = null;

    if (pageId != null) {
        page = pageRegistry.get(pageKey(tab, pageId));

        if (!page) {
            warnNavigationFailure(target, "page-not-found");
            return false;
        }
    }

    const navigated = gameUI.navigateToRoute(tab, pageId);

    if (navigated === false) {
        warnNavigationFailure(target, "destination-not-found");
        return false;
    }

    if (page?.activate) {
        let activated;

        try {
            activated = await page.activate();
        } catch (error) {
            console.warn(`[Navigation] Failed: ${destinationRef(target)}`, {
                reason: "page-activation-failed",
                error
            });

            return false;
        }

        if (activated === false) {
            return false;
        }
    }

    if (itemId == null) {
        return true;
    }

    await waitForRender();

    let itemNavigated = false;

    if (page?.navigateToItem) {
        itemNavigated = await page.navigateToItem(itemId);
    } else {
        const element = document.getElementById(itemDomId(tab, itemId));

        if (element) {
            const isLastItem =
                element.parentElement?.lastElementChild === element;

            element.scrollIntoView({
                behavior: "smooth",
                block: isLastItem ? "end" : "center"
            });

            itemNavigated = true;
        }
    }

    if (!itemNavigated) {
        warnNavigationFailure(target, "item-not-found");
        return false;
    }

    return true;
}

export function navigateToItem(gameUI, target = {}) {
    if (target.itemId == null) {
        warnNavigationFailure(target, "item-id-required");
        return Promise.resolve(false);
    }

    return navigateTo(gameUI, target);
}
