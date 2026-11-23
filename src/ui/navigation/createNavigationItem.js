// src/ui/navigation/createNavigationItem.js

/* handles one button and its optional 
unread indicator. */

import { el } from "../components/Element.js";
import Badge from "../components/Badge.js";

export function createNavigationItem(
    destination,
    { active = false, unreadManager, onSelect } = {}
) {
    const button = el("button", {
        type: "button",
        className: ["navigation-item", active ? "is-active" : ""]
            .filter(Boolean)
            .join(" "),
        "aria-pressed": String(active),
        "aria-label": destination.label,
        onClick: () => onSelect?.(destination.id)
    });

    const icon =
        typeof destination.icon === "function"
            ? destination.icon()
            : destination.icon;

    if (icon) {
        const iconElement =
            typeof icon === "string"
                ? el("span", {
                      className: "navigation-item-icon",
                      text: icon,
                      "aria-hidden": "true"
                  })
                : icon;

        button.append(iconElement);
    }

    button.append(
        el("span", {
            className: "navigation-item-label",
            text: destination.label
        })
    );

    if (destination.unread) {
        const count =
            unreadManager?.getUnreadCount(
                destination.unreadKey ?? destination.id
            ) ?? 0;

        if (count > 0) {
            if (destination.unreadDisplay === "count") {
                button.append(
                    Badge({
                        text: count,
                        className: "navigation-unread",
                        ariaLabel: `${count} unread`
                    })
                );
            } else {
                button.append(
                    el("span", {
                        className: "navigation-unread-dot",
                        "aria-label": `${count} unread`
                    })
                );
            }
        }
    }

    return button;
}
