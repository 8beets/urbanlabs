import { foldText } from '../catalog/title-match';

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

// Every option a select offers before a search box narrows it.
const allOptions = new WeakMap<HTMLSelectElement, FilterOption[]>();

/** The search box that narrows a select (`data-narrows` names the select's id). */
function searchBoxOf(select: HTMLSelectElement): HTMLInputElement | null {
  const input = select.form?.querySelector(
    `input[data-narrows="${select.id}"]`,
  );
  return input instanceof HTMLInputElement ? input : null;
}

/** Whether every typed word appears in the label, ignoring case and accents. */
export function matchesSearch(label: string, query: string): boolean {
  const text = foldText(label);
  return foldText(query)
    .split(/\s+/u)
    .every((word) => text.includes(word));
}

/**
 * Replaces a select's options, keeping the value when it is still offered. When a
 * search box narrows the select, only matching options (and the selected one) show.
 */
export function replaceOptions(
  select: HTMLSelectElement,
  options: FilterOption[],
  label: string,
  value: string,
) {
  allOptions.set(select, options);
  const query = searchBoxOf(select)?.value ?? '';
  select.replaceChildren(
    new Option(label, ''),
    ...options
      .filter(
        (option) =>
          option.value === value || matchesSearch(option.label, query),
      )
      .map((option) => new Option(option.label, option.value)),
  );
  select.value = options.some((option) => option.value === value) ? value : '';
}

/**
 * Shows a select's search box (hidden without JavaScript) and narrows the options to
 * those matching what is typed, announcing how many match. Enter picks the only match
 * instead of submitting the form.
 */
export function enhanceOptionSearch(input: HTMLInputElement) {
  const select = input.form?.querySelector(
    `select#${CSS.escape(input.dataset.narrows ?? '')}`,
  );
  const status = input.form?.querySelector(
    `[data-search-status="${input.id}"]`,
  );
  if (!(select instanceof HTMLSelectElement)) return;
  // The server-rendered options; "current selection" fallbacks are not real choices.
  allOptions.set(
    select,
    [...select.options]
      .filter((option) => option.value && !option.dataset.fallback)
      .map((option) => ({ value: option.value, label: option.text })),
  );
  const narrow = () => {
    const selected = select.selectedOptions[0];
    const options = allOptions.get(select) ?? [];
    replaceOptions(
      select,
      options,
      select.options[0]?.text ?? '',
      select.value,
    );
    // A selection outside the offered options stays, as setOptions keeps it.
    if (selected?.value && select.value !== selected.value) {
      select.add(selected, 1);
      select.value = selected.value;
    }
    if (status)
      status.textContent = input.value.trim()
        ? (input.dataset.countTemplate ?? '').replace(
            '{count}',
            String(select.options.length - 1),
          )
        : '';
  };
  input.addEventListener('input', narrow);
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (select.options.length === 2 && input.value.trim()) {
      select.value = select.options[1]!.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  input.hidden = false;
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
      !(
        target instanceof HTMLSelectElement ||
        target instanceof HTMLInputElement
      ) ||
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
