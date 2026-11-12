/** Disallow rules of the `User-agent: *` group (named agents' rules do not apply to us). */
function genericDisallows(text: string): string[] {
  const rules: string[] = [];
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
      rules.push(value);
  }
  return rules;
}

/**
 * Throws if any generic Disallow rule matches the path (with query). Rules are
 * prefixes with `*` wildcards and an optional `$` end anchor. Allow lines are ignored,
 * which can only block more, never less.
 */
export function assertRobotsAllowPath(text: string, pathAndQuery: string) {
  for (const rule of genericDisallows(text)) {
    const anchored = rule.endsWith('$');
    const pattern = (anchored ? rule.slice(0, -1) : rule)
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    if (new RegExp(`^${pattern}${anchored ? '$' : ''}`).test(pathAndQuery))
      throw new Error(
        `robots.txt disallows ${pathAndQuery}; review source configuration before ingestion`,
      );
  }
}

/**
 * Throws unless the robots.txt text allows generic crawlers everywhere: the
 * `User-agent: *` group must have no non-empty Disallow. Rules for named agents (e.g.
 * Googlebot) do not apply to us. Anything more specific needs a reviewed change.
 */
export function assertRobotsAllowAll(text: string): void {
  if (genericDisallows(text).length)
    throw new Error(
      'robots.txt disallows generic crawlers; review source configuration before ingestion',
    );
}
