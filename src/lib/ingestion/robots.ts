/**
 * Throws unless the robots.txt text allows generic crawlers everywhere: the
 * `User-agent: *` group must have no non-empty Disallow. Rules for named agents (e.g.
 * Googlebot) do not apply to us. Anything more specific needs a reviewed change.
 */
export function assertRobotsAllowAll(text: string): void {
  let applies = false;
  let inAgentLines = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const match = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const [, field, value] = match as unknown as [string, string, string];
    if (field.toLowerCase() === 'user-agent') {
      // Consecutive User-agent lines form one group; a new group resets the match.
      applies = (inAgentLines ? applies : false) || value === '*';
      inAgentLines = true;
      continue;
    }
    inAgentLines = false;
    if (applies && field.toLowerCase() === 'disallow' && value !== '')
      throw new Error(
        'robots.txt disallows generic crawlers; review source configuration before ingestion',
      );
  }
}
