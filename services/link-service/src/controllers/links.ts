import type { Request, Response } from "express";
import { z } from "zod";
import { isReservedName } from "@short/routing";
import * as service from "../services/links";
import { codePattern, createSchema, updateSchema } from "../lib/validation";
import { HttpError } from "../lib/http";
const idSchema = z.string().uuid();
const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().max(200).default(""),
    status: z.enum(["all", "active", "disabled", "expired"]).default("all"),
  })
  .strict();
export async function create(req: Request, res: Response) {
  res.status(201).json({
    link: service.publicLink(
      await service.createLink(
        res.locals.user.id,
        createSchema.parse(req.body),
      ),
    ),
  });
}
export async function list(req: Request, res: Response) {
  const query = querySchema.parse(req.query);
  res.json(
    await service.listLinks(
      res.locals.user.id,
      query.page,
      query.pageSize,
      query.search,
      query.status,
      String(res.getHeader("X-Request-Id")),
    ),
  );
}
export async function detail(req: Request, res: Response) {
  res.json({
    link: service.publicLink(
      await service.ownedLink(
        idSchema.parse(req.params.id),
        res.locals.user.id,
      ),
    ),
  });
}
export async function update(req: Request, res: Response) {
  res.json({
    link: service.publicLink(
      await service.updateLink(
        idSchema.parse(req.params.id),
        res.locals.user.id,
        updateSchema.parse(req.body),
      ),
    ),
  });
}
export async function qr(req: Request, res: Response) {
  const format = z.enum(["png", "svg"]).default("png").parse(req.query.format);
  const link = await service.ownedLink(
    idSchema.parse(req.params.id),
    res.locals.user.id,
  );
  res.type(format === "svg" ? "image/svg+xml" : "image/png");
  if (req.query.download === "1")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${link.code}.${format}"`,
    );
  res.send(await service.generateQr(link, format));
}
export async function redirect(req: Request, res: Response) {
  const code = String(req.params.code);
  if (!codePattern.test(code) || (req.route.path === "/:code" && isReservedName(code)))
    throw new HttpError(404, "NOT_FOUND", "ไม่พบลิงก์");
  const destination = await service.redirectDestination(
    code,
    req.method === "HEAD",
    req.get("user-agent") || "",
    req.get("referer"),
    String(res.getHeader("X-Request-Id")),
  );
  res.redirect(302, destination);
}
export async function ownership(req: Request, res: Response) {
  const input = z
    .object({ userId: z.string().uuid() })
    .strict()
    .parse(req.body);
  await service.ownedLink(idSchema.parse(req.params.id), input.userId);
  res.json({ owned: true });
}
export async function summary(req: Request, res: Response) {
  const input = z
    .object({ userId: z.string().uuid() })
    .strict()
    .parse(req.body);
  res.json(await service.linkSummary(input.userId));
}
