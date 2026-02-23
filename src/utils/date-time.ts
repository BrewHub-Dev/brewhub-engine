import { DateTime } from "luxon";

export { DateTime };

export function nowUtc(): Date {
  return DateTime.utc().toJSDate();
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
