import { z } from "zod";
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + "T00:00:00Z");
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  });
export function bangkokDay(date: Date) {
  return new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 10);
}
export function dateRange(from?: string, to?: string) {
  const endDay = to ? dateSchema.parse(to) : bangkokDay(new Date());
  const end = new Date(endDay + "T00:00:00+07:00");
  end.setUTCDate(end.getUTCDate() + 1);
  const start = from
    ? new Date(dateSchema.parse(from) + "T00:00:00+07:00")
    : new Date(end.getTime() - 30 * 86400000);
  if (start >= end || end.getTime() - start.getTime() > 366 * 86400000)
    throw new Error("INVALID_DATE_RANGE");
  return { start, end };
}
