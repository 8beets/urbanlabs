import { cleanText } from './values';

// Match explicit labels, never registration policies or a centre's closure notice.
const marker =
  '(?:anul[·.]?la(?:ts?|d(?:a|es))|anulad[oa]s?|cancel[·.]?la(?:ts?|d(?:a|es))|cancelad[oa]s?)';
const cancelledWord = new RegExp(`\\b${marker}\\b`, 'iu');
const cancellationNotice = new RegExp(
  `^(?:activitat|actividad|taller|curs|curso)\\s+${marker}\\b`,
  'iu',
);

export function hasCancellationNotice(
  title: string,
  notices: string[],
): boolean {
  return (
    cancelledWord.test(cleanText(title)) ||
    notices.some((notice) => cancellationNotice.test(cleanText(notice)))
  );
}
