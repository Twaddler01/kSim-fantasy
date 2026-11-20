// src/results.js
//
// Canonical result shape for failure-capable commands:
//   { ok: boolean, reason: string | null, ...payload }
//
// reason is always a stable kebab-case code. Player-facing copy lives in
// notifications/resultMessages.js.

export function ok(data = {}) {
    return {
        ...data,
        ok: true,
        reason: null
    };
}

export function fail(reason, data = {}) {
    return {
        ...data,
        ok: false,
        reason
    };
}
