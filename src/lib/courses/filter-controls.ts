import type { FilterOption, FilterOptions } from './filter-options';

function isOption(value: unknown): value is FilterOption {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    typeof value.value === 'string' &&
    'label' in value &&
    typeof value.label === 'string'
  );
}
function isOptions(value: unknown): value is FilterOptions {
  return (
    typeof value === 'object' &&
    value !== null &&
    'centre' in value &&
    typeof value.centre === 'string' &&
    'centres' in value &&
    Array.isArray(value.centres) &&
    value.centres.every(isOption) &&
    'categories' in value &&
    Array.isArray(value.categories) &&
    value.categories.every(isOption)
  );
}
function replaceOptions(
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

export function enhanceFilters(form: HTMLFormElement) {
  const centre = form.querySelector('[name="centre"]');
  const category = form.querySelector('[name="category"]');
  const status = form.querySelector<HTMLElement>('[data-filter-status]');
  const submit = form.querySelector('button[type="submit"]');
  if (
    !(centre instanceof HTMLSelectElement) ||
    !(category instanceof HTMLSelectElement) ||
    !(submit instanceof HTMLButtonElement) ||
    !status
  )
    return;
  let pending: AbortController | undefined;
  form.addEventListener('change', async (event) => {
    const target = event.target;
    if (
      !(target instanceof HTMLSelectElement) ||
      !['region', 'city', 'centre', 'cancellation'].includes(target.name)
    )
      return;
    pending?.abort();
    const request = new AbortController();
    pending = request;
    const timeout = window.setTimeout(() => request.abort(), 10000);
    // Read values before temporarily disabling dependent controls.
    const values = new FormData(form);
    const params = new URLSearchParams({ locale: form.dataset.locale ?? 'es' });
    for (const key of ['country', 'region', 'city', 'centre', 'cancellation'])
      params.set(key, String(values.get(key) ?? ''));
    // Disabled controls are omitted from FormData during a subsequent upstream change.
    params.set('centre', centre.value);
    // Keep the active centre control focusable so keyboard users can change it again.
    centre.disabled = target.name !== 'centre';
    category.disabled = true;
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    status.hidden = false;
    status.textContent = form.dataset.loading ?? '';
    try {
      const response = await fetch(`/api/filters?${params}`, {
        signal: request.signal,
      });
      if (!response.ok) throw new Error('Filter options unavailable');
      const options: unknown = await response.json();
      if (!isOptions(options)) throw new Error('Invalid filter options');
      if (pending !== request) return;
      replaceOptions(
        centre,
        options.centres,
        form.dataset.allCentres ?? '',
        options.centre,
      );
      replaceOptions(
        category,
        options.categories,
        form.dataset.allCategories ?? '',
        category.value,
      );
      status.textContent = '';
      status.hidden = true;
    } catch {
      if (pending !== request) return;
      status.textContent = form.dataset.failed ?? '';
    } finally {
      window.clearTimeout(timeout);
      if (pending === request) {
        centre.disabled = false;
        category.disabled = false;
        submit.disabled = false;
        form.removeAttribute('aria-busy');
        pending = undefined;
      }
    }
  });
  // Covers keyboard submission while an options request is still pending.
  form.addEventListener('submit', (event) => {
    if (pending) event.preventDefault();
  });
}
