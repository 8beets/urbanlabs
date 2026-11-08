// A trigger body contains semicolons, so it only ends at its closing END;.
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inTrigger = false;
  for (const line of sql.split('\n')) {
    if (line.trimStart().startsWith('--')) continue;
    current += `${line}\n`;
    if (/^\s*CREATE\s+TRIGGER\b/i.test(current)) inTrigger = true;
    const end = inTrigger
      ? /^END;\s*$/.test(line)
      : line.trimEnd().endsWith(';');
    if (end) {
      statements.push(current.trim().replace(/;$/, ''));
      current = '';
      inTrigger = false;
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements.filter(Boolean);
}
