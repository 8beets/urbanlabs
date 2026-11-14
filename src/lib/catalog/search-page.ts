import { m } from '../../paraglide/messages.js';
import { baseLocale, isLocale } from '../../paraglide/runtime.js';
import { courseSearchPath } from '../../i18n/paths';
import { categoryLabel, type Locale } from '../../i18n/ui';
import { startMonthLabel } from '../courses/start-month';
import { emptyGeography } from '../locations/geography';
import {
  enhanceFilters,
  replaceOptions,
  type FilterOption,
} from '../courses/filter-controls';
import {
  defaultFilters,
  discover,
  emptyDiscovery,
  filterOptions,
  type DiscoveryPageData,
} from './discovery';
import { discoveryResultsHtml } from './discovery-view';
import { catalogToday } from './query';
import {
  SEARCH_INDEX_VERSION,
  archiveIndexPath,
  liveIndexPath,
  decodeIndexes,
  type SearchIndex,
} from './search-index';

// The browser half of the static search: it reads the filters from the URL, runs the
// shared discovery service over the city's downloaded index and renders the same markup
// the build prerenders. Submitting the GET form reloads the page with the new query.
// The city comes from the page path, never from the query (docs/adr/0010-city-sections.md).

async function fetchIndex(path: string): Promise<SearchIndex> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok)
    throw new Error(`Search index unavailable: ${response.status}`);
  const index: unknown = await response.json();
  if (
    typeof index !== 'object' ||
    index === null ||
    !('version' in index) ||
    index.version !== SEARCH_INDEX_VERSION ||
    !('editions' in index) ||
    !Array.isArray(index.editions)
  )
    throw new Error('Unexpected search index format');
  return index as SearchIndex;
}

function select(form: HTMLFormElement, name: string) {
  const element = form.elements.namedItem(name);
  return element instanceof HTMLSelectElement ? element : null;
}

function setOptions(
  select: HTMLSelectElement | null,
  options: FilterOption[],
  allLabel: string,
  value: string,
  fallbackLabel: string,
) {
  if (!select) return;
  replaceOptions(select, options, allLabel, value);
  // A selection unavailable here stays visible and removable, as on the server.
  if (value && !options.some((option) => option.value === value)) {
    select.add(new Option(fallbackLabel, value, true, true), 1);
    select.value = value;
  }
}

function applyToForm(
  form: HTMLFormElement,
  locale: Locale,
  data: DiscoveryPageData,
  params: URLSearchParams,
) {
  const { filters } = data;
  const current = m.currentSelection({}, { locale });
  const set = (name: string, value: string) => {
    const element = form.elements.namedItem(name);
    if (element instanceof HTMLInputElement && element.type === 'checkbox')
      element.checked = element.value === value;
    else if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement
    )
      element.value = value;
  };
  set('q', filters.q);
  set('cancellation', filters.cancellation ?? '');
  set('places', filters.places ?? '');
  set('audience', filters.audience ?? '');
  setOptions(
    select(form, 'centre'),
    data.centres.map((row) => ({ value: row.id, label: row.name })),
    m.allCentres({}, { locale }),
    filters.centre,
    current,
  );
  setOptions(
    select(form, 'category'),
    data.categories.map((value) => ({
      value,
      label: categoryLabel(value, locale),
    })),
    m.allCategories({}, { locale }),
    filters.category,
    filters.category
      ? `${categoryLabel(filters.category, locale)} (${current})`
      : current,
  );
  setOptions(
    select(form, 'start'),
    data.startMonths.map((month) => ({
      value: month,
      label: startMonthLabel(month, locale),
    })),
    m.anyStartMonth({}, { locale }),
    filters.startMonth ?? '',
    filters.startMonth
      ? `${startMonthLabel(filters.startMonth, locale)} (${current})`
      : current,
  );
  // Other parameters (such as `archive`) survive a new submission.
  const fields = new Set((form.dataset.formFields ?? '').split(' '));
  for (const [key, value] of params)
    if (!fields.has(key)) {
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = key;
      hidden.value = value;
      form.insertBefore(hidden, form.firstChild);
    }
  if (data.error === 'invalid') {
    const panel = form.closest('details');
    if (panel) {
      panel.dataset.invalid = 'true';
      panel.open = true;
    }
    const query = form.elements.namedItem('q');
    if (query instanceof HTMLInputElement)
      query.setAttribute('aria-describedby', 'filter-error');
  }
}

function updatePage(
  locale: Locale,
  city: string,
  params: URLSearchParams,
  archive: boolean,
) {
  if (archive) {
    document.title = m.archivePageTitle({}, { locale });
    const title = document.querySelector('[data-search-title]');
    const intro = document.querySelector('[data-search-intro]');
    if (title) title.textContent = m.archiveTitle({}, { locale });
    if (intro) intro.textContent = m.archiveIntro({}, { locale });
  }
  // Switching language keeps the current search.
  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    '.language-nav a[lang]',
  )) {
    const target = link.lang;
    if (!isLocale(target)) continue;
    link.href = `${courseSearchPath(target, city)}${params.size ? `?${params}` : ''}`;
  }
}

export async function startSearchPage(root: HTMLElement): Promise<void> {
  const locale: Locale = isLocale(root.dataset.locale)
    ? root.dataset.locale
    : baseLocale;
  const alerts = root.dataset.alerts === 'true';
  const results = root.querySelector<HTMLElement>('[data-discovery-results]');
  const form = root.querySelector<HTMLFormElement>('[data-dynamic-filters]');
  const city = root.dataset.city ?? '';
  if (!results || !city) return;
  const params = new URLSearchParams(location.search);
  const withCity = (query: URLSearchParams) => {
    const scoped = new URLSearchParams(query);
    scoped.delete('country');
    scoped.delete('region');
    scoped.set('city', city);
    return scoped;
  };
  const archive = params.get('archive') === '1';
  const done = () => {
    document.documentElement.removeAttribute('data-search-pending');
    document.documentElement.removeAttribute('data-search-failed');
  };
  results.setAttribute('aria-busy', 'true');
  try {
    const indexes = await Promise.all(
      [liveIndexPath(city), ...(archive ? [archiveIndexPath(city)] : [])].map(
        fetchIndex,
      ),
    );
    const catalog = decodeIndexes(indexes);
    const today = catalogToday(catalog);
    const data = discover(catalog, withCity(params), today);
    results.innerHTML = discoveryResultsHtml({
      locale,
      data,
      params,
      sources: catalog.sources,
      alerts,
    });
    updatePage(locale, city, params, data.filters.archive === true);
    if (form) {
      applyToForm(form, locale, data, params);
      enhanceFilters(form, (choiceParams) => {
        const choices = filterOptions(catalog, withCity(choiceParams), today);
        return {
          centre: choices.centre,
          centres: choices.centres.map((row) => ({
            value: row.id,
            label: row.name,
          })),
          categories: choices.categories.map((value) => ({
            value,
            label: categoryLabel(value, locale),
          })),
        };
      });
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'search_index_unavailable',
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    results.innerHTML = discoveryResultsHtml({
      locale,
      data: emptyDiscovery({ ...defaultFilters, city }, emptyGeography, null),
      params,
      sources: [],
      alerts: false,
      unavailable: true,
    });
  } finally {
    results.removeAttribute('aria-busy');
    done();
  }
}
