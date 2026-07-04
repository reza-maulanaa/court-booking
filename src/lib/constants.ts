export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 23;
export const MAX_DAYS_AHEAD = 30;

export function todayWIB(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}
