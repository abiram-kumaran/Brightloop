/**
 * Date calculations for subscription recurring billing.
 * Dates meaning "a day" are pure YYYY-MM-DD representations without timezone drift.
 */

export type BillingPeriod = "daily" | "weekly" | "monthly" | "yearly";

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  // month: 1-12
  switch (month) {
    case 1: return 31;
    case 2: return isLeapYear(year) ? 29 : 28;
    case 3: return 31;
    case 4: return 30;
    case 5: return 31;
    case 6: return 30;
    case 7: return 31;
    case 8: return 31;
    case 9: return 30;
    case 10: return 31;
    case 11: return 30;
    case 12: return 31;
    default: throw new Error(`Invalid month: ${month}`);
  }
}

export function parseDate(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid date format (expected YYYY-MM-DD): ${dateStr}`);
  }
  return { year: parts[0], month: parts[1], day: parts[2] };
}

export function formatDate(year: number, month: number, day: number): string {
  const y = year.toString().padStart(4, "0");
  const m = month.toString().padStart(2, "0");
  const d = day.toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const { year, month, day } = parseDate(dateStr);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Calculates the next billing date based on original subscription anchors.
 * Anchor day (and month for yearly) is clamped to the month's maximum days,
 * but the original anchor is NEVER overwritten, preventing calendar drift.
 *
 * Example: anchor_day = 31, monthly:
 * - Jan 31 -> Feb 28 (or 29)
 * - Feb 28 -> Mar 31
 * - Mar 31 -> Apr 30
 * - Apr 30 -> May 31
 */
export function calculateNextBillingDate(params: {
  anchorDay: number; // 1-31
  anchorMonth?: number; // 1-12 (only needed for yearly)
  currentDateStr?: string | Date; // YYYY-MM-DD
  fromDate?: string | Date;
  period: BillingPeriod;
  interval?: number; // default 1
}): string {
  const { anchorDay, anchorMonth = 1, period, interval = 1 } = params;
  const rawDate: any = params.currentDateStr || params.fromDate;
  const dateStr = rawDate instanceof Date ? rawDate.toISOString().slice(0, 10) : String(rawDate);
  const current = parseDate(dateStr);
  switch (period) {
    case "daily": {
      return addDays(dateStr, interval);
    }
    case "weekly": {
      return addDays(dateStr, 7 * interval);
    }
    case "monthly": {
      // Add interval months
      let newMonth = current.month + interval;
      let newYear = current.year;
      while (newMonth > 12) {
        newMonth -= 12;
        newYear += 1;
      }
      while (newMonth < 1) {
        newMonth += 12;
        newYear -= 1;
      }

      // Clamp target day to max days in target month without modifying anchorDay
      const maxDays = daysInMonth(newYear, newMonth);
      const targetDay = Math.min(anchorDay, maxDays);
      return formatDate(newYear, newMonth, targetDay);
    }
    case "yearly": {
      const newYear = current.year + interval;
      const targetMonth = anchorMonth;
      const maxDays = daysInMonth(newYear, targetMonth);
      const targetDay = Math.min(anchorDay, maxDays);
      return formatDate(newYear, targetMonth, targetDay);
    }
    default:
      throw new Error(`Unsupported billing period: ${period}`);
  }
}

/**
 * Calculates a billing period [start, end] given a period start date and anchor.
 * End date is (nextBillingDate - 1 day).
 */
export function calculateBillingPeriod(params: {
  startDateStr: string;
  anchorDay: number;
  anchorMonth?: number;
  period: BillingPeriod;
  interval?: number;
}): { periodStart: string; periodEnd: string; nextInvoiceDate: string } {
  const nextInvoiceDate = calculateNextBillingDate({
    anchorDay: params.anchorDay,
    anchorMonth: params.anchorMonth,
    currentDateStr: params.startDateStr,
    period: params.period,
    interval: params.interval,
  });

  const periodEnd = addDays(nextInvoiceDate, -1);
  return {
    periodStart: params.startDateStr,
    periodEnd,
    nextInvoiceDate,
  };
}

export const nextInvoiceDate = calculateNextBillingDate;
