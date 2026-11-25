/**
 * Combat distance and range helpers.
 *
 * All distances are measured center-to-center
 * in world coordinates.
 */

/**
 * Return the distance between two positioned objects.
 */
export function getDistance(a, b) {
    if (
        !a ||
        !b ||
        !Number.isFinite(a.x) ||
        !Number.isFinite(a.y) ||
        !Number.isFinite(b.x) ||
        !Number.isFinite(b.y)
    ) {
        return Infinity;
    }

    return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Check whether two positioned objects are within
 * the supplied maximum distance.
 */
export function isWithinRange(a, b, range) {
    if (!Number.isFinite(range) || range < 0) {
        return false;
    }

    return getDistance(a, b) <= range;
}
