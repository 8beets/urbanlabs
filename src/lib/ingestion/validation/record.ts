import { z } from 'zod';

export const courseRecordSchema = z.object({
  // Stable platform identifier: numeric for Miram, a documented composite for others.
  externalId: z.string().regex(/^[A-Za-z0-9._~:-]{1,120}$/),
  title: z.string().min(1).max(500),
  officialUrl: z.url().refine((value) => new URL(value).protocol === 'https:'),
  category: z.string().max(200).nullable(),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  scheduleText: z.string().max(1000).nullable(),
  priceCents: z.number().int().nonnegative().nullable(),
  currency: z.literal('EUR').nullable(),
  availability: z.null(),
  isCancelled: z.boolean(),
  isSoldOut: z.boolean(),
  organizer: z.string().min(1).max(200).nullable().optional(),
  courseLanguage: z.null(),
});
