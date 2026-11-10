import type { Page } from '@playwright/test';

/** Centre links across every directory page, starting from the page already open. */
export async function directoryLinks(
  page: Page,
): Promise<{ href: string; name: string }[]> {
  const links: { href: string; name: string }[] = [];
  for (let n = 0; n < 50; n++) {
    links.push(
      ...(await page.locator('.centre-directory h2 a').evaluateAll((anchors) =>
        anchors.map((a) => ({
          href: a.getAttribute('href')!,
          name: a.textContent!.trim(),
        })),
      )),
    );
    const next = page.locator('.pagination a[rel="next"]');
    if (!(await next.count())) return links;
    await next.click();
  }
  throw new Error('Directory pagination did not end');
}
