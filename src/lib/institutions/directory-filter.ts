import { foldText } from '../catalog/title-match';

/** Every typed word must appear in the centre name or address, ignoring accents and case. */
export function centreMatches(
  text: string,
  city: string,
  filter: { q: string; city: string },
): boolean {
  if (filter.city && city !== filter.city) return false;
  const haystack = foldText(text);
  return foldText(filter.q)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/**
 * The directory lists every centre in the static HTML; with JavaScript, the form
 * narrows that list as the user types. Without JavaScript the form stays hidden and
 * the complete list remains available.
 */
export function enhanceCentreFilter(form: HTMLFormElement): void {
  const list = document.getElementById('centre-list');
  const empty = document.querySelector<HTMLElement>('[data-centre-empty]');
  const query = form.elements.namedItem('q');
  const city = form.elements.namedItem('city');
  if (
    !list ||
    !empty ||
    !(query instanceof HTMLInputElement) ||
    !(city instanceof HTMLSelectElement)
  )
    return;
  const cards = [...list.querySelectorAll<HTMLElement>('[data-centre-name]')];
  const update = () => {
    let shown = 0;
    for (const card of cards) {
      card.hidden = !centreMatches(
        card.dataset.centreName ?? '',
        card.dataset.centreCity ?? '',
        { q: query.value.trim(), city: city.value },
      );
      if (!card.hidden) shown++;
    }
    empty.hidden = shown > 0;
  };
  form.addEventListener('input', update);
  form.addEventListener('submit', (event) => event.preventDefault());
  form.hidden = false;
  update();
}
