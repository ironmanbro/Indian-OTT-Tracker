// Display formatting helpers.

export const fmtDuration = (mins) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
