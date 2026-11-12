export interface FilterOption {
  value: string;
  label: string;
}
export interface FilterChoices {
  /** The selected centre, or '' when it is unavailable at the chosen location. */
  centre: string;
  centres: FilterOption[];
  categories: FilterOption[];
}

export function replaceOptions(
  select: HTMLSelectElement,
  options: FilterOption[],
  label: string,
  value: string,
) {
  select.replaceChildren(
    new Option(label, ''),
    ...options.map((option) => new Option(option.label, option.value)),
  );
  select.value = options.some((option) => option.value === value) ? value : '';
}

/**
 * Keeps the category choices consistent with the chosen centre while the user edits
 * the form. Results change only when the form is submitted.
 */
export function enhanceFilters(
  form: HTMLFormElement,
  choicesFor: (params: URLSearchParams) => FilterChoices,
) {
  const centre = form.querySelector('[name="centre"]');
  const category = form.querySelector('[name="category"]');
  if (
    !(centre instanceof HTMLSelectElement) ||
    !(category instanceof HTMLSelectElement)
  )
    return;
  form.addEventListener('change', (event) => {
    const target = event.target;
    if (
      !(target instanceof HTMLSelectElement) ||
      !['centre', 'cancellation'].includes(target.name)
    )
      return;
    const values = new FormData(form);
    const params = new URLSearchParams();
    for (const key of ['centre', 'cancellation', 'archive'])
      params.set(key, String(values.get(key) ?? ''));
    let choices: FilterChoices;
    try {
      choices = choicesFor(params);
    } catch {
      // Invalid combinations keep the current choices; submitting reports the error.
      return;
    }
    replaceOptions(
      centre,
      choices.centres,
      form.dataset.allCentres ?? '',
      choices.centre,
    );
    replaceOptions(
      category,
      choices.categories,
      form.dataset.allCategories ?? '',
      category.value,
    );
  });
}
