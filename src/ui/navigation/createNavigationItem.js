// src/ui/navigation/createNavigationItem.js

/* handles one button and its optional 
unread indicator. */

import { el } from "../components/Element.js";

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
        button.append(
            typeof icon === "string"
                ? el("span", {
                      className: "navigation-item-icon",
                      text: icon,
                      "aria-hidden": "true"
                  })
                : icon
        );
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
            button.append(
                el("span", {
                    className:
                        destination.unreadDisplay === "count"
                            ? "navigation-unread-count"
                            : "navigation-unread-dot",
                    text:
                        destination.unreadDisplay === "count"
                            ? String(count)
                            : "",
                    "aria-label": `${count} unread`
                })
            );
        }
    }

    return button;
}
