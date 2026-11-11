import type { Page } from '@playwright/test';

/** Centre links across every directory page, starting from the page already open. */
export async function directoryLinks(
  page: Page,
): Promise<{ href: string; name: string; closed: boolean }[]> {
  const links: { href: string; name: string; closed: boolean }[] = [];
  for (let n = 0; n < 50; n++) {
    links.push(
      ...(await page.locator('.centre-directory h2 a').evaluateAll((anchors) =>
        anchors.map((a) => ({
          href: a.getAttribute('href')!,
          name: a.textContent!.trim(),
          closed: !!a.closest('article')?.querySelector('.closure-label'),
        })),
      )),
    );
    const next = page.locator('.pagination a[rel="next"]');
    if (!(await next.count())) return links;
    await next.click();
  }
  throw new Error('Directory pagination did not end');
}
