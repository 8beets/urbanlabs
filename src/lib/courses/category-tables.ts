import { z } from 'zod';
import { AUDIENCES, TOPICS, comparisonKey } from './categories';

const categories = z.array(z.string().trim().min(1).max(200));

/**
 * Reviewed source categories (data/categories.json), matched by `comparisonKey`:
 * - `topics`: categories whose courses all belong to one topic.
 * - `mixed`: categories that mix topics or name an audience, format or programme;
 *   their courses are classified by title. Audience categories are listed here too.
 * - `audiences`: categories that name who the courses are for.
 * - `refinements`: categories that name a topic but also hold courses of the listed
 *   topics (Zaragoza's "Música" includes dance); a title rule for one of those topics
 *   wins, otherwise the category's topic stands.
 */
export const reviewedCategoriesSchema = z
  .strictObject({
    topics: z.record(z.enum(TOPICS).exclude(['altres']), categories),
    mixed: categories,
    audiences: z.record(z.enum(AUDIENCES), categories),
    refinements: z.record(z.string(), z.array(z.enum(TOPICS))),
  })
  .superRefine((tables, ctx) => {
    // A category listed twice would silently take whichever entry comes last.
    const keys = [...Object.values(tables.topics).flat(), ...tables.mixed].map(
      comparisonKey,
    );
    for (const [index, key] of keys.entries())
      if (keys.indexOf(key) !== index)
        ctx.addIssue({
          code: 'custom',
          message: `Category listed twice: ${key}`,
        });
  });

export type ReviewedCategories = z.infer<typeof reviewedCategoriesSchema>;
