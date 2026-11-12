import { m } from '../../paraglide/messages.js';
import { centrePath, courseSearchPath } from '../../i18n/paths';
import { formatLocalDate, categoryLabel, type Locale } from '../../i18n/ui';
import { formatSchedule } from '../../i18n/schedule';
import { formatCourseTitle } from './title';
import { isTopic } from './categories';
import { escapeHtml } from '../html';
import type { CourseListing } from '../catalog/types';

// One renderer for course cards, used by prerendered pages and by the browser search,
// so both always produce the same markup. Every interpolated value is escaped.

const iconPaths = {
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z',
  clock: 'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  external: 'M14 3h7v7M21 3 10 14M10 3H3v18h18v-7',
  arrow: 'M12 4v16m-6-6 6 6 6-6',
  info: 'M12 11v6M12 7v.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
} as const;
export type IconName = keyof typeof iconPaths;

export function iconHtml(name: IconName): string {
  return `<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${iconPaths[name]}"></path></svg>`;
}

function priceText(course: CourseListing, locale: Locale): string {
  if (course.price_cents === null)
    return course.organizer
      ? m.priceFromOrganizer({ organizer: course.organizer }, { locale })
      : m.unknownPrice({}, { locale });
  if (course.price_cents === 0) return m.freePrice({}, { locale });
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: course.currency ?? 'EUR',
  }).format(course.price_cents / 100);
}

/**
 * Markup of one course card. `filterParams` are the active search filters, kept on
 * the category link so it narrows the current search.
 */
export function courseCardHtml(
  course: CourseListing,
  locale: Locale,
  filterParams: URLSearchParams = new URLSearchParams(),
): string {
  const title = course.title_reviewed
    ? course.title
    : formatCourseTitle(course.title, locale);
  const categoryParams = new URLSearchParams(filterParams);
  categoryParams.delete('page');
  if (course.category) categoryParams.set('category', course.category);
  const dates = course.start_date
    ? formatLocalDate(course.start_date, locale) +
      (course.end_date && course.end_date !== course.start_date
        ? ` – ${formatLocalDate(course.end_date, locale)}`
        : '')
    : m.unknownDates({}, { locale });
  // Canonical cards carry a topic id; "altres" and raw categories keep the neutral card.
  const topic =
    course.category && isTopic(course.category) && course.category !== 'altres'
      ? ` data-topic="${course.category}"`
      : '';
  const parts = [
    `<article class="course"${topic} data-live-until="${escapeHtml(course.end_date ?? '9999-12-31')}">`,
    course.is_cancelled === 1
      ? `<p class="cancelled-label">${escapeHtml(m.cancelled({}, { locale }))}</p>`
      : '',
    course.is_sold_out === 1
      ? `<p class="sold-out-label">${escapeHtml(m.soldOut({}, { locale }))}</p>`
      : '',
    course.category
      ? `<a class="course-category" href="${escapeHtml(`${courseSearchPath(locale, course.city_id)}?${categoryParams}`)}">${escapeHtml(categoryLabel(course.category, locale))}</a>`
      : '',
    `<h3${title !== course.title ? ` title="${escapeHtml(course.title)}"` : ''}>${escapeHtml(title)}</h3>`,
    `<p class="institution">${iconHtml('pin')}<a href="${escapeHtml(centrePath(locale, course.city_id, course.institution_slug))}">${escapeHtml(course.institution)}</a></p>`,
    `<p class="course-date">${iconHtml('calendar')}<span>${escapeHtml(dates)}</span></p>`,
    course.schedule_text
      ? `<p class="schedule">${iconHtml('clock')}<span>${escapeHtml(formatSchedule(course.schedule_text, locale))}</span></p>`
      : '',
    '<div class="course-action">',
    !(course.is_cancelled === 1 && course.price_cents === 0)
      ? `<p class="price${course.price_cents === null ? ' price-unknown' : ''}">${escapeHtml(priceText(course, locale))}</p>`
      : '',
    `<a class="source-link" href="${escapeHtml(course.official_url)}">${escapeHtml(m.source({}, { locale }))}${iconHtml('external')}</a>`,
    '</div>',
    `<p class="verified">${escapeHtml(m.verified({}, { locale }))} <time datetime="${escapeHtml(course.last_successfully_verified_at)}">${escapeHtml(formatLocalDate(course.last_successfully_verified_at.slice(0, 10), locale))}</time></p>`,
    '</article>',
  ];
  return parts.join('');
}
