// TEMPORARY (do not merge): checks whether GitHub Actions runners can reach
// Barcelona's open-data portal, which answers 403 to the cloud development
// environment. Reads robots.txt, then only if it allows the path, the first 2 KB of
// the agenda CSV. See issue #144.
import { USER_AGENT } from '../lib/ingestion/http';
import { assertRobotsAllowPath } from '../lib/ingestion/robots';

const ORIGIN = 'https://opendata-ajuntament.barcelona.cat';
const DOWNLOAD =
  '/data/dataset/a25e60cd-3083-4252-9fce-81f733871cb1/resource/877ccf66-9106-4ae2-be51-95a9f6469e4c/download';
const headers = { 'User-Agent': USER_AGENT };

const robots = await fetch(`${ORIGIN}/robots.txt`, { headers });
const robotsText = await robots.text();
console.log(`robots.txt: HTTP ${robots.status}`);
console.log(robotsText.slice(0, 3000));
if (!robots.ok) process.exit(0);
assertRobotsAllowPath(robotsText, DOWNLOAD);
console.log(`robots.txt allows ${DOWNLOAD}`);

await new Promise((resolve) => setTimeout(resolve, 5000));
const file = await fetch(`${ORIGIN}${DOWNLOAD}`, {
  headers: { ...headers, Range: 'bytes=0-2047' },
});
console.log(`download: HTTP ${file.status}`);
for (const name of [
  'content-type',
  'content-length',
  'content-range',
  'content-disposition',
  'last-modified',
])
  console.log(`  ${name}: ${file.headers.get(name)}`);
const bytes = new Uint8Array(await file.arrayBuffer()).slice(0, 2048);
const utf16 = bytes[0] === 0xff && bytes[1] === 0xfe;
console.log(
  new TextDecoder(utf16 ? 'utf-16le' : 'utf-8').decode(bytes).slice(0, 600),
);
