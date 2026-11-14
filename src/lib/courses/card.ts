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

// Drawn by CSS masks (global.css) so each card does not repeat the SVG markup.
export type IconName =
  'pin' | 'search' | 'calendar' | 'clock' | 'external' | 'arrow' | 'info';

export function iconHtml(name: IconName): string {
  return `<span class="icon icon-${name}" aria-hidden="true"></span>`;
}

function priceText(course: CourseListing, locale: Locale): string {
  if (course.price_cents === null)
    return course.organizer
      ? m.priceFromOrganizer({ organizer: course.organizer }, { locale })
      : m.unknownPrice({}, { locale });
  if (course.price_cents === 0) return m.freePrice({}, { locale });
  return m.priceAmount({ amount: course.price_cents / 100 }, { locale });
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
  const verifiedOn = course.last_successfully_verified_at.slice(0, 10);
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
    // The visible text is a date, so the machine-readable value is one too.
    `<p class="verified">${escapeHtml(m.verified({}, { locale }))} <time datetime="${escapeHtml(verifiedOn)}">${escapeHtml(formatLocalDate(verifiedOn, locale))}</time></p>`,
    '</article>',
  ];
  return parts.join('');
}
