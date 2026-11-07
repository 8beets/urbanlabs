import type { APIRoute } from 'astro';
import { centreDirectoryPath } from '../../i18n/paths';

export const GET: APIRoute = ({ redirect, url }) =>
  redirect(`${centreDirectoryPath('es')}${url.search}`, 308);
