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

/** Whether every typed word appears in the label, ignoring case and accents. */
export function matchesSearch(label: string, query: string): boolean {
  const text = foldText(label);
  return foldText(query)
    .split(/\s+/u)
    .every((word) => text.includes(word));
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
 * Replaces a select (kept hidden as the submitted field, and as the no-JavaScript
 * fallback) with a text box whose matching options are listed below it as the user
 * types (ARIA combobox with a listbox popup). Clearing the text selects "all".
 */
export function enhanceCombobox(input: HTMLInputElement) {
  const form = input.form;
  const select = form?.querySelector(
    `select#${CSS.escape(input.dataset.for ?? '')}`,
  );
  const list = form?.querySelector(
    `#${CSS.escape(input.getAttribute('aria-controls') ?? '')}`,
  );
  const status = form?.querySelector(`[data-search-status="${input.id}"]`);
  if (!(select instanceof HTMLSelectElement) || !(list instanceof HTMLElement))
    return;
  let active = -1;

  const items = () => [
    ...list.querySelectorAll<HTMLElement>('[role="option"]'),
  ];
  const showSelected = () => {
    input.value = select.value ? (select.selectedOptions[0]?.text ?? '') : '';
  };
  /** Highlights the option at `index` (wrapping around); -1 highlights none. */
  const setActive = (index: number) => {
    const all = items();
    active = index < 0 || !all.length ? -1 : index % all.length;
    all.forEach((item, i) =>
      item.setAttribute('aria-selected', String(i === active)),
    );
    const current = all[active];
    if (current) {
      input.setAttribute('aria-activedescendant', current.id);
      current.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  };
  const close = () => {
    list.hidden = true;
    if (status) status.textContent = '';
    input.setAttribute('aria-expanded', 'false');
    setActive(-1);
  };
  const open = () => {
    const query = input.value;
    const matches = [...select.options].filter(
      (option) => option.value && matchesSearch(option.text, query),
    );
    list.replaceChildren(
      ...matches.map((option, index) => {
        const item = document.createElement('li');
        item.id = `${list.id}-${index}`;
        item.role = 'option';
        item.dataset.value = option.value;
        item.textContent = option.text;
        return item;
      }),
    );
    list.hidden = matches.length === 0;
    input.setAttribute('aria-expanded', String(matches.length > 0));
    setActive(-1);
    if (status)
      status.textContent = (input.dataset.countTemplate ?? '').replace(
        '{count}',
        String(matches.length),
      );
  };
  const choose = (value: string) => {
    close();
    if (select.value !== value) {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    showSelected();
  };

  input.addEventListener('input', open);
  input.addEventListener('click', () => {
    if (list.hidden) open();
  });
  input.addEventListener('keydown', (event) => {
    const all = items();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.hidden) open();
      setActive(
        event.key === 'ArrowDown'
          ? active + 1
          : (active <= 0 ? items().length : active) - 1,
      );
    } else if (event.key === 'Escape' && !list.hidden) {
      event.preventDefault();
      close();
      showSelected();
    } else if (event.key === 'Enter') {
      // Picks the highlighted (or only) match; with nothing to pick, Enter submits.
      const pick =
        all[active] ?? (all.length === 1 && !list.hidden ? all[0] : undefined);
      if (pick) {
        event.preventDefault();
        choose(pick.dataset.value ?? '');
      } else if (!input.value.trim()) choose('');
    }
  });
  // mousedown keeps focus in the box, so blur does not close the list first.
  list.addEventListener('mousedown', (event) => event.preventDefault());
  list.addEventListener('click', (event) => {
    const item =
      event.target instanceof Element &&
      event.target.closest('[role="option"]');
    if (item instanceof HTMLElement) choose(item.dataset.value ?? '');
  });
  // Free text never becomes a filter: leaving the box keeps the chosen centre.
  input.addEventListener('blur', () => {
    if (input.value.trim()) {
      close();
      showSelected();
    } else choose('');
  });
  // Other filters may replace the centre options; keep the text in step.
  new MutationObserver(() => {
    if (document.activeElement !== input) showSelected();
  }).observe(select, { childList: true });

  showSelected();
  const label = form?.querySelector(`label[for="${select.id}"]`);
  if (label instanceof HTMLLabelElement) label.htmlFor = input.id;
  select.hidden = true;
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
