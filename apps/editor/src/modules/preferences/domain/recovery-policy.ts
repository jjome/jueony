/** The existing Studio options own these values; there is no second settings record. */
export interface RecoverySettings {
  recoveryEnabled: boolean;
  recoveryIntervalMinutes: number;
  idleSaveEnabled: boolean;
  idleDelaySeconds: number;
}

export const DEFAULT_RECOVERY_SETTINGS: Readonly<RecoverySettings> = Object.freeze({
  recoveryEnabled: true, recoveryIntervalMinutes: 10,
  idleSaveEnabled: true, idleDelaySeconds: 10,
});

function number(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, Math.round(numeric))) : fallback;
}

/** Preserve Studio's defaults and bounds, including its legacy numeric strings. */
export function normalizeRecoverySettings(value: unknown): RecoverySettings {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    recoveryEnabled: typeof input.recoveryEnabled === 'boolean' ? input.recoveryEnabled : true,
    recoveryIntervalMinutes: number(input.recoveryIntervalMinutes, 10, 1, 120),
    idleSaveEnabled: typeof input.idleSaveEnabled === 'boolean' ? input.idleSaveEnabled : true,
    idleDelaySeconds: number(input.idleDelaySeconds, 10, 5, 600),
  };
}

export function recoveryIsEnabled(settings: RecoverySettings): boolean {
  return settings.recoveryEnabled || settings.idleSaveEnabled;
}

/** A periodic deadline is independent of typing; the idle deadline follows the last edit. */
export function recoveryDeadline(settings: RecoverySettings, firstPendingAt: number, lastEditAt: number): number | undefined {
  const interval = settings.recoveryEnabled ? firstPendingAt + settings.recoveryIntervalMinutes * 60_000 : Infinity;
  const idle = settings.idleSaveEnabled ? lastEditAt + settings.idleDelaySeconds * 1_000 : Infinity;
  const deadline = Math.min(interval, idle);
  return Number.isFinite(deadline) ? deadline : undefined;
}
