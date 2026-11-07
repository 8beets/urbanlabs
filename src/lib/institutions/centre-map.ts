import type { Map as LeafletMap } from 'leaflet';
import type { CentreMapPoint } from '../db/institutions';
export interface CentreMapLabels {
  mapContributors: string;
  loading: string;
  failed: string;
  tilesFailed: string;
  zoomIn: string;
  zoomOut: string;
}

async function mountMap(root: HTMLElement) {
  const canvas = root.querySelector<HTMLElement>('[data-map-canvas]');
  const status = root.querySelector<HTMLElement>('[data-map-status]');
  const help = root.querySelector<HTMLElement>('[data-map-help]');
  if (!canvas || !status || !help) return;
  const locale = root.dataset.locale === 'ca' ? 'ca' : 'es';
  const labels: CentreMapLabels = JSON.parse(root.dataset.labels ?? '{}');
  const centreBase = locale === 'es' ? '/es/centros' : '/ca/centres';
  status.hidden = false;
  status.textContent = labels.loading;
  let map: LeafletMap | undefined;
  try {
    const centres: CentreMapPoint[] = JSON.parse(root.dataset.centres ?? '[]');
    if (!centres.length) return;
    const L = await import('leaflet');
    await import('leaflet/dist/leaflet.css');
    canvas.hidden = false;
    map = L.map(canvas, {
      scrollWheelZoom: false,
      zoomControl: false,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
    });
    L.control
      .zoom({ zoomInTitle: labels.zoomIn, zoomOutTitle: labels.zoomOut })
      .addTo(map);
    const attribution = document.createElement('a');
    attribution.href = 'https://www.openstreetmap.org/copyright';
    attribution.textContent = labels.mapContributors;
    let tileLoaded = false;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      referrerPolicy: 'strict-origin-when-cross-origin',
      attribution: `&copy; ${attribution.outerHTML}`,
    })
      .on('tileload', () => {
        tileLoaded = true;
        status.hidden = true;
      })
      .on('tileerror', () => {
        if (!tileLoaded) {
          status.hidden = false;
          status.textContent = labels.tilesFailed;
        }
      })
      .addTo(map);
    const icon = L.divIcon({
      className: 'centre-map-marker',
      html: '<span aria-hidden="true"></span>',
      iconSize: [28, 36],
      iconAnchor: [14, 36],
      popupAnchor: [0, -34],
    });
    for (const centre of centres) {
      // Source names are untrusted text: never interpolate them into HTML popup strings.
      const link = document.createElement('a');
      link.href = `${centreBase}/${encodeURIComponent(centre.slug)}`;
      link.textContent = centre.name;
      const marker = L.marker([centre.latitude, centre.longitude], {
        icon,
        title: centre.name,
        alt: centre.name,
        keyboard: true,
        riseOnHover: true,
      }).addTo(map);
      marker.bindPopup(link, { closeButton: false });
      marker.on('popupopen', () => link.focus({ preventScroll: true }));
      marker.on('popupclose', () =>
        marker.getElement()?.focus({ preventScroll: true }),
      );
    }
    map.fitBounds(
      centres.map((c) => [c.latitude, c.longitude] as [number, number]),
      {
        padding: [30, 30],
        maxZoom: centres.length === 1 ? 17 : 15,
        animate: false,
      },
    );
    status.hidden = true;
    help.hidden = false;
    root.dataset.mapReady = 'true';
  } catch {
    map?.remove();
    canvas.hidden = true;
    status.textContent = labels.failed;
  }
}

export function initializeCentreMaps() {
  for (const root of document.querySelectorAll<HTMLElement>(
    '[data-centre-map]',
  )) {
    if (!('IntersectionObserver' in window)) {
      void mountMap(root);
      continue;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void mountMap(root);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(root);
  }
}
