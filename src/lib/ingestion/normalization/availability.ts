import { cleanText } from './values';

// Miram prints this exact notice in the card footer when an activity has no places left
// (verified in saved fixtures). Waitlist instructions follow it, so match only the start.
const soldOut = /^places exhaurides\b/iu;

export function hasSoldOutNotice(notices: string[]): boolean {
  return notices.some((notice) => soldOut.test(cleanText(notice)));
}
