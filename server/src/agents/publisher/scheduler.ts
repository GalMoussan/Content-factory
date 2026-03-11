/**
 * Scheduler — calculates optimal publish time for YouTube uploads.
 */

interface ScheduleConfig {
  readonly enabled?: boolean;
  readonly preferredHour?: number;
  readonly timezone?: string;
}

/**
 * Calculate the next optimal publish time.
 * Returns an ISO string for a future date, or undefined if scheduling is disabled.
 */
export function calculatePublishTime(config?: ScheduleConfig): string | undefined {
  if (config?.enabled === false) {
    return undefined;
  }

  const preferredHour = config?.preferredHour ?? 14;
  const timezone = config?.timezone ?? 'UTC';

  // Build a date formatter to read the current time in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const getPart = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '0';

  const currentHour = Number(getPart('hour'));

  // If we've already passed the preferred hour today, schedule for tomorrow
  const daysToAdd = currentHour >= preferredHour ? 1 : 0;

  const now = new Date();
  const target = new Date(now);
  target.setDate(target.getDate() + daysToAdd);

  // Set the time to the preferred hour in UTC-equivalent
  // Approximate: shift by the offset between local preferred hour and current hour
  target.setHours(preferredHour, 0, 0, 0);

  // Ensure it's always in the future
  if (target.getTime() <= Date.now()) {
    target.setDate(target.getDate() + 1);
  }

  return target.toISOString();
}
