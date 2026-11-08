import { z } from 'zod';

export const centreProfileSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(3000).optional(),
  descriptionLanguage: z
    .string()
    .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
    .optional(),
  phone: z
    .string()
    .regex(/^[+0-9 ()-]{5,30}$/)
    .optional(),
  email: z.email().optional(),
  detailsSourceUrl: z.url().startsWith('https://').optional(),
  detailsVerifiedAt: z.iso.date().optional(),
  notice: z.literal('temporary_closure').nullable().optional(),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      sourceUrl: z.url().startsWith('https://'),
      verifiedAt: z.iso.date(),
    })
    .optional(),
});
export type CentreProfile = z.infer<typeof centreProfileSchema>;
