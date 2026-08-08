import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { PAGINATION, type PaginationMeta } from '@carpool/shared';

/** Consistent success envelope — every endpoint uses it. */
export function ok<T>(res: Response, data: T, message?: string, status = 200): void {
  res.status(status).json({ success: true, data, ...(message ? { message } : {}) });
}

export function created<T>(res: Response, data: T, message?: string): void {
  ok(res, data, message, 201);
}

/** Wraps async handlers so rejections reach the error middleware. */
export function handler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export interface PageParams {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
}

export function resolvePage(input: { page?: number; pageSize?: number } = {}): PageParams {
  const page = Math.max(1, Math.trunc(input.page ?? PAGINATION.DEFAULT_PAGE));
  const pageSize = Math.min(
    PAGINATION.MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(input.pageSize ?? PAGINATION.DEFAULT_PAGE_SIZE)),
  );
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

export function paginationMeta(params: PageParams, total: number): PaginationMeta {
  return {
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / params.pageSize),
  };
}
