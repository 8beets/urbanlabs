import type { APIRoute } from 'astro';
import { centreDirectoryPath } from '../../i18n/paths';

export const GET: APIRoute = ({ redirect, url, params }) =>
  redirect(
    `${centreDirectoryPath('es')}/${encodeURIComponent(params.slug ?? '')}${url.search}`,
    308,
  );
