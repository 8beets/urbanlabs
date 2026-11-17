import { load } from 'cheerio';
import { cleanText } from './values';

/** Visible text of an HTML fragment (tags dropped, entities decoded), whitespace collapsed. */
export const plainText = (html: string): string => cleanText(load(html).text());
