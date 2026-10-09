import type { Request, Response } from "express";
import { z } from "zod";
import {
  eventSchema,
  recordClick,
  clickCounts,
  statistics,
} from "../services/analytics";
import { dateRange } from "../lib/dates";
import { HttpError } from "../lib/http";
export async function visit(req: Request, res: Response) {
  res.status(201).json(await recordClick(eventSchema.parse(req.body)));
}
export async function counts(req: Request, res: Response) {
  const input = z
    .object({
      ownerId: z.string().uuid(),
      linkIds: z.array(z.string().uuid()).max(100),
    })
    .strict()
    .parse(req.body);
  res.json(await clickCounts(input.ownerId, input.linkIds));
}
export async function stats(req: Request, res: Response) {
  const query = z
    .object({ from: z.string().optional(), to: z.string().optional() })
    .strict()
    .parse(req.query);
  let range;
  try {
    range = dateRange(query.from, query.to);
  } catch {
    throw new HttpError(
      400,
      "INVALID_DATE_RANGE",
      "เลือกวันที่ที่ถูกต้องและช่วงไม่เกิน 366 วัน",
    );
  }
  const linkId = req.params.id
    ? z.string().uuid().parse(req.params.id)
    : undefined;
  res.json(
    await statistics(
      res.locals.user.id,
      range.start,
      range.end,
      linkId,
      String(res.getHeader("X-Request-Id")),
    ),
  );
}
