import { z } from 'zod/v4';

export const ApiSuccessSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
});

export type ApiSuccess = z.infer<typeof ApiSuccessSchema>;

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.number().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const PaginatedSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  }),
});

export type Paginated = z.infer<typeof PaginatedSchema>;
