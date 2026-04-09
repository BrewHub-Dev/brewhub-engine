import { DateTime, IANAZone, Settings } from "luxon";

Settings.defaultZone = "utc";

export { DateTime };

export function nowUtc(): Date {
  return DateTime.utc().toJSDate();
}

export function nowInZone(timezone: string): Date {
  const dt = DateTime.now().setZone(timezone);
  if (!dt.isValid) {
    console.warn(`Invalid timezone: ${timezone}, falling back to UTC`);
    return DateTime.utc().toJSDate();
  }
  return dt.toJSDate();
}

export function todayInZone(timezone: string): string {
  const dt = DateTime.now().setZone(timezone);
  if (!dt.isValid) {
    return DateTime.utc().toISODate()!;
  }
  return dt.toISODate()!;
}

export function fromUtcInZone(date: Date, timezone: string): DateTime {
  return DateTime.fromJSDate(date, { zone: "utc" }).setZone(timezone);
}

export function formatInZone(
  date: Date,
  timezone: string,
  fmt = "yyyy-MM-dd HH:mm:ss"
): string {
  return fromUtcInZone(date, timezone).toFormat(fmt);
}

export function getCurrentDateTimeInZone(timezone: string): DateTime {
  const dt = DateTime.now().setZone(timezone);
  if (!dt.isValid) {
    console.warn(`Invalid timezone: ${timezone}, falling back to UTC`);
    return DateTime.now().setZone("utc");
  }
  return dt;
}

export function parseDateInZone(
  dateString: string,
  timezone: string,
  format = "yyyy-MM-dd"
): DateTime {
  const dt = DateTime.fromFormat(dateString, format, { zone: timezone });
  if (!dt.isValid) {
    return DateTime.fromISO(dateString, { zone: timezone });
  }
  return dt;
}

export function addDaysInZone(
  date: Date,
  days: number,
  timezone: string
): DateTime {
  return DateTime.fromJSDate(date, { zone: timezone }).plus({ days });
}

export function startOfDayInZone(timezone: string): DateTime {
  return getCurrentDateTimeInZone(timezone).startOf("day");
}

export function endOfDayInZone(timezone: string): DateTime {
  return getCurrentDateTimeInZone(timezone).endOf("day");
}

export function startOfWeekInZone(timezone: string): DateTime {
  return getCurrentDateTimeInZone(timezone).startOf("week");
}

export function isValidTimezone(timezone: string): boolean {
  try {
    return IANAZone.isValidZone(timezone);
  } catch {
    return false;
  }
}

export function getDefaultTimezone(): string {
  return "UTC";
}

export function toISOInZone(dateTime: DateTime, timezone: string): string {
  return dateTime.setZone(timezone).toISO() || dateTime.toISO() || "";
}

export function fromISOInZone(isoString: string, timezone: string): DateTime {
  return DateTime.fromISO(isoString, { zone: timezone });
}

export function diffInMinutes(date1: DateTime, date2: DateTime): number {
  return Math.floor(date1.diff(date2, "minutes").minutes);
}

export function diffInHours(date1: DateTime, date2: DateTime): number {
  return Math.floor(date1.diff(date2, "hours").hours);
}

export function diffInDays(date1: DateTime, date2: DateTime): number {
  return Math.floor(date1.diff(date2, "days").days);
}
