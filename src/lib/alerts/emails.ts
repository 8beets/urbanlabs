import { m } from '../../paraglide/messages.js';
import { categoryLabel, formatLocalDate, type Locale } from '../../i18n/ui';
import { cityLabel } from '../../i18n/geography';
import type { EmailMessage } from './email-sender';
import type { AlertTarget, NewCourse } from './subscription';

export interface CityName {
  id: string;
  name: string;
}

// Built from messages, not astro:i18n, so the GitHub Actions job can render links too.
export function alertPath(
  locale: Locale,
  page: 'signup' | 'confirm' | 'unsubscribe' = 'signup',
): string {
  const base = `/${locale}/${m.pathAlerts({}, { locale })}`;
  if (page === 'confirm')
    return `${base}/${m.pathAlertConfirm({}, { locale })}`;
  if (page === 'unsubscribe')
    return `${base}/${m.pathAlertUnsubscribe({}, { locale })}`;
  return base;
}

export function describeTarget(
  target: AlertTarget,
  locale: Locale,
  cities: readonly CityName[],
): string {
  const city = target.cityId
    ? cityLabel(
        cities.find((row) => row.id === target.cityId) ?? {
          id: target.cityId,
          name: target.cityId,
        },
        locale,
      )
    : '';
  const category = target.category
    ? categoryLabel(target.category, locale)
    : '';
  if (category && city)
    return m.alertsTargetBoth({ category, city }, { locale });
  if (category) return m.alertsTargetCategory({ category }, { locale });
  return m.alertsTargetCity({ city }, { locale });
}

export function searchUrl(
  siteUrl: string,
  target: AlertTarget,
  locale: Locale,
): string {
  const params = new URLSearchParams();
  if (target.category) params.set('category', target.category);
  if (target.countryCode) params.set('country', target.countryCode);
  if (target.cityId) params.set('city', target.cityId);
  return `${siteUrl}/${locale}/${m.pathSearch({}, { locale })}?${params}`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function layout(locale: Locale, body: string): string {
  return `<!doctype html><html lang="${locale}"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1f2933;max-width:600px;margin:0 auto;padding:16px">${body}</body></html>`;
}

export function confirmationEmail(input: {
  to: string;
  locale: Locale;
  target: string;
  confirmUrl: string;
}): EmailMessage {
  const { locale } = input;
  const body = m.alertsEmailConfirmBody({ target: input.target }, { locale });
  const action = m.alertsEmailConfirmAction({}, { locale });
  const ignore = m.alertsEmailConfirmIgnore({}, { locale });
  return {
    to: input.to,
    subject: m.alertsEmailConfirmSubject({}, { locale }),
    text: `${body}\n\n${action}: ${input.confirmUrl}\n\n${ignore}\n`,
    html: layout(
      locale,
      `<p>${escapeHtml(body)}</p><p><a href="${escapeHtml(input.confirmUrl)}">${escapeHtml(action)}</a></p><p>${escapeHtml(ignore)}</p>`,
    ),
  };
}

/** Course titles stay in their source language; only the frame is localized. */
export function digestEmail(input: {
  to: string;
  locale: Locale;
  target: string;
  courses: readonly NewCourse[];
  searchUrl: string;
  unsubscribeUrl: string;
}): EmailMessage {
  const { locale } = input;
  const intro = m.alertsEmailDigestIntro({ target: input.target }, { locale });
  const more = m.alertsEmailDigestMore({}, { locale });
  const official = m.alertsEmailOfficial({}, { locale });
  const footer = m.alertsEmailFooter({}, { locale });
  const unsubscribe = m.alertsEmailUnsubscribe({}, { locale });
  const starts = (course: NewCourse) =>
    course.startDate
      ? m.alertsEmailStarts(
          { date: formatLocalDate(course.startDate, locale) },
          { locale },
        )
      : null;
  const textCourses = input.courses.map((course) =>
    [
      `- ${course.title}`,
      `  ${course.institution}`,
      starts(course) && `  ${starts(course)}`,
      `  ${official}: ${course.officialUrl}`,
    ]
      .filter(Boolean)
      .join('\n'),
  );
  const htmlCourses = input.courses
    .map(
      (course) =>
        `<li style="margin-bottom:12px"><strong>${escapeHtml(course.title)}</strong><br>${escapeHtml(course.institution)}${
          starts(course) ? `<br>${escapeHtml(starts(course)!)}` : ''
        }<br><a href="${escapeHtml(course.officialUrl)}">${escapeHtml(official)}</a></li>`,
    )
    .join('');
  return {
    to: input.to,
    subject: m.alertsEmailDigestSubject({ target: input.target }, { locale }),
    unsubscribeUrl: input.unsubscribeUrl,
    text: `${intro}\n\n${textCourses.join('\n\n')}\n\n${more}: ${input.searchUrl}\n\n--\n${footer}\n${unsubscribe}: ${input.unsubscribeUrl}\n`,
    html: layout(
      locale,
      `<p>${escapeHtml(intro)}</p><ul style="padding-left:20px">${htmlCourses}</ul><p><a href="${escapeHtml(input.searchUrl)}">${escapeHtml(more)}</a></p><hr><p style="font-size:14px">${escapeHtml(footer)} <a href="${escapeHtml(input.unsubscribeUrl)}">${escapeHtml(unsubscribe)}</a></p>`,
    ),
  };
}
