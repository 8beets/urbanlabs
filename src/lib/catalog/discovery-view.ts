import { m } from '../../paraglide/messages.js';
import { cityLabel, regionLabel } from '../../i18n/geography';
import { courseSearchPath } from '../../i18n/paths';
import { categoryLabel, pageErrorMessage, type Locale } from '../../i18n/ui';
import { alertPath } from '../alerts/emails';
import { startMonthLabel } from '../courses/start-month';
import { courseCardHtml } from '../courses/card';
import { escapeHtml } from '../html';
import type { DiscoveryPageData } from './discovery';
import type { OfficialSource } from './search-index';

// Markup of the search results area. The search page prerenders it for the empty
// query and the browser renders it again for every search, from the same code.

export interface DiscoveryView {
  locale: Locale;
  data: DiscoveryPageData;
  /** The (canonical) query of the current URL. */
  params: URLSearchParams;
  sources: OfficialSource[];
  alerts: boolean;
  /** The search index could not be loaded. */
  unavailable?: boolean;
}

export interface AppliedFilter {
  key: string;
  label: string;
}

export function appliedFilters({
  locale,
  data,
}: DiscoveryView): AppliedFilter[] {
  const { filters, centres, geography } = data;
  const applied: AppliedFilter[] = [];
  if (filters.region) {
    const region = geography.regions.find((row) => row.id === filters.region);
    applied.push({
      key: 'region',
      label: `${m.region({}, { locale })}: ${region ? regionLabel(region, locale) : filters.region}`,
    });
  }
  if (filters.city) {
    const city = geography.cities.find((row) => row.id === filters.city);
    applied.push({
      key: 'city',
      label: `${m.city({}, { locale })}: ${city ? cityLabel(city, locale) : filters.city}`,
    });
  }
  if (filters.q)
    applied.push({
      key: 'q',
      label: `${m.search({}, { locale })}: ${filters.q}`,
    });
  if (filters.cancellation)
    applied.push({
      key: 'cancellation',
      label:
        filters.cancellation === 'only'
          ? m.onlyCancelled({}, { locale })
          : m.hideCancelled({}, { locale }),
    });
  if (filters.places)
    applied.push({ key: 'places', label: m.hideSoldOut({}, { locale }) });
  if (filters.centre)
    applied.push({
      key: 'centre',
      label: `${m.centre({}, { locale })}: ${centres.find((centre) => centre.id === filters.centre)?.name ?? m.currentSelection({}, { locale })}`,
    });
  if (filters.category)
    applied.push({
      key: 'category',
      label: `${m.category({}, { locale })}: ${categoryLabel(filters.category, locale)}`,
    });
  if (filters.startMonth)
    applied.push({
      key: 'start',
      label: `${m.startMonth({}, { locale })}: ${startMonthLabel(filters.startMonth, locale)}`,
    });
  if (filters.maxPriceCents !== null)
    applied.push({
      key: 'maxPrice',
      label: `${m.price({}, { locale })}: ${new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(filters.maxPriceCents / 100)}`,
    });
  return applied;
}

function officialSourcesFor({ data, sources }: DiscoveryView) {
  const { filters, geography } = data;
  return sources.filter((source) => {
    const city = geography.cities.find((row) => row.id === source.cityId);
    return (
      (!filters.centre || source.institutionId === filters.centre) &&
      (!filters.country || source.country === filters.country) &&
      (!filters.region || city?.region_id === filters.region) &&
      (!filters.city || city?.id === filters.city)
    );
  });
}

export function discoveryResultsHtml(view: DiscoveryView): string {
  const { locale, data, params, alerts } = view;
  const { courses, filters, hasNext } = data;
  const error = view.unavailable ? 'unavailable' : data.error;
  const base = courseSearchPath(locale);
  const archive = filters.archive === true;
  const root = archive ? `${base}?archive=1` : base;
  const applied = error === 'invalid' ? [] : appliedFilters(view);
  const href = (next: URLSearchParams) =>
    next.size ? `${base}?${next}` : base;
  const filterUrl = (key: string) => {
    const next = new URLSearchParams(params);
    next.delete('page');
    next.delete(key);
    return href(next);
  };
  const pageUrl = (page: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    return href(next);
  };
  // Alerts follow only category and city; other filters are not part of a subscription.
  const alertParams = new URLSearchParams();
  if (filters.category) alertParams.set('category', filters.category);
  if (filters.city) alertParams.set('city', filters.city);
  const alertUrl = `${alertPath(locale)}${alertParams.size ? `?${alertParams}` : ''}`;
  const sources = officialSourcesFor(view);
  const t = (text: string) => escapeHtml(text);
  return [
    error
      ? `<p role="alert" id="filter-error" class="error">${t(pageErrorMessage(error, locale))}</p>`
      : '',
    '<section aria-labelledby="results" class="results">',
    '<div class="results-heading"><div>',
    `<h2 id="results">${t(m.results({}, { locale }))}</h2>`,
    `<p class="results-intro">${t(m.resultsIntro({}, { locale }))}</p>`,
    '</div>',
    applied.length > 0 || filters.page > 1 || error === 'invalid'
      ? `<a href="${t(root)}">${t(m.clear({}, { locale }))}</a>`
      : '',
    '</div>',
    alerts && !archive && !error
      ? `<p class="alert-link"><a href="${t(alertUrl)}">${t(m.alertsFromSearch({}, { locale }))}</a></p>`
      : '',
    applied.length
      ? `<div class="applied-filters" aria-label="${t(m.appliedFilters({}, { locale }))}" role="group"><p>${t(m.appliedFilters({}, { locale }))}</p><ul>${applied
          .map(
            (filter) =>
              `<li><a href="${t(filterUrl(filter.key))}" aria-label="${t(`${m.removeFilter({}, { locale })}: ${filter.label}`)}">${t(filter.label)}<span aria-hidden="true"> ×</span></a></li>`,
          )
          .join('')}</ul></div>`
      : '',
    !error && courses.length === 0
      ? `<div class="empty"><h3>${t(m.empty({}, { locale }))}</h3><p>${t(
          sources.length
            ? m.emptyHelp({}, { locale })
            : m.emptyLocation({}, { locale }),
        )}</p>${sources
          .map(
            (source) =>
              `<p><a href="${t(source.listingUrl)}">${t(m.programming({}, { locale }))}: ${t(source.institutionName)} ↗</a></p>`,
          )
          .join('')}</div>`
      : '',
    `<div class="grid">${courses.map((course) => courseCardHtml(course, locale, params)).join('')}</div>`,
    `<nav class="pagination" aria-label="${t(m.pagination({}, { locale }))}">`,
    filters.page > 1
      ? `<a href="${t(pageUrl(filters.page - 1))}" rel="prev">← ${t(m.previous({}, { locale }))}</a>`
      : '',
    hasNext && filters.page < 1000
      ? `<a href="${t(pageUrl(filters.page + 1))}" rel="next">${t(m.next({}, { locale }))} →</a>`
      : '',
    '</nav>',
    '</section>',
  ].join('');
}
