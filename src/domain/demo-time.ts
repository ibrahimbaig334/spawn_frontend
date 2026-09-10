const DEMO_EPOCH_MS = Date.UTC(2025, 0, 1, 12, 0, 0);
const SEQUENCE_INTERVAL_MS = 6 * 60 * 60 * 1_000;

export function demoTimestamp(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error("Demo sequence must be a non-negative safe integer.");
  }
  return new Date(
    DEMO_EPOCH_MS + sequence * SEQUENCE_INTERVAL_MS,
  ).toISOString();
}

export function sequenceAtDaysBefore(sequence: number, days: number): number {
  if (!Number.isSafeInteger(days) || days < 0) return sequence;
  return Math.max(0, sequence - days * 4);
}

export function formatDemoUtc(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown UTC time";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}
