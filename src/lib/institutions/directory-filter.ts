import type { Centre } from '../db/institutions';

const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();

/** Every typed word must appear in the centre name or address, ignoring accents and case. */
export function filterCentres(
  centres: Centre[],
  { q, city }: { q: string; city: string },
): Centre[] {
  const words = fold(q).split(/\s+/).filter(Boolean);
  return centres.filter((centre) => {
    if (city && centre.city !== city) return false;
    const haystack = fold(`${centre.name} ${centre.address}`);
    return words.every((word) => haystack.includes(word));
  });
}

export function centreCities(centres: Centre[]): string[] {
  return [...new Set(centres.map((centre) => centre.city))].sort((a, b) =>
    a.localeCompare(b),
  );
}
