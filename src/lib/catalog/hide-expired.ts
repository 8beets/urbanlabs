import { earliestLocalDate } from '../time/dates';

/**
 * Prerendered cards are as fresh as the last build. Editions that ended since then
 * are hidden in the browser until the next daily rebuild removes them for good.
 */
export function hideExpiredCards(root: ParentNode, timeZones: string[]): void {
  const today = earliestLocalDate(timeZones);
  for (const card of root.querySelectorAll<HTMLElement>('[data-live-until]'))
    if ((card.dataset.liveUntil ?? '') < today) card.hidden = true;
}
