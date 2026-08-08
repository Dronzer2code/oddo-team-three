/**
 * Report date range.
 *
 * `from` is inclusive at 00:00 and `to` is inclusive of the whole day, which is
 * expressed as an exclusive bound at the start of the following day. That is
 * what makes a filter of 01–31 March actually contain trips completed at
 * 31 March 18:40.
 */
export interface ReportRange {
  from: string;
  to: string;
  toExclusive: string;
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

const DEFAULT_WINDOW_DAYS = 90;

export function resolveRange(from?: string, to?: string): ReportRange {
  const now = new Date();

  const parsedTo = to ? new Date(to) : now;
  const toDay = startOfDay(Number.isNaN(parsedTo.getTime()) ? now : parsedTo);

  const fallbackFrom = new Date(toDay.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const parsedFrom = from ? new Date(from) : fallbackFrom;
  const fromDay = startOfDay(Number.isNaN(parsedFrom.getTime()) ? fallbackFrom : parsedFrom);

  const toExclusive = new Date(toDay.getTime() + 24 * 60 * 60 * 1000);

  return {
    from: fromDay.toISOString(),
    to: toDay.toISOString(),
    toExclusive: toExclusive.toISOString(),
  };
}
