# Visual assets

## Typography

Headings and the wordmark use Bricolage Grotesque by Mathieu Triay, distributed under the SIL Open Font License 1.1. The Latin variable WOFF2 subset is served from `public/fonts/bricolage-grotesque-latin.woff2`; the full license is in `public/fonts/OFL.txt`. Retrieved from [Google Fonts](https://fonts.google.com/specimen/Bricolage+Grotesque) on 2026-11-07. Body text uses system fonts. No external font requests are made when browsing, and `font-display: swap` keeps text visible while the heading font loads.

## Stock photographs

Retrieved on 2026-11-06 (`dance.jpg` on 2026-11-14, replacing a woodworking photo whose subject is not a site category) from the free collection on Pexels. Each photo is captioned with the site category it illustrates. The [Pexels license](https://www.pexels.com/license/) permits free website use and modification without required attribution. These photographs retain their separate Pexels license; they are not relicensed as project code. Do not use them as trademarks or imply an endorsement.

| Local asset under `public/images/categories/` | Photographer   | Original page                                                                                             |
| --------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| `music.jpg`                                   | Gabriella Ally | [Electric guitar](https://www.pexels.com/photo/man-playing-electric-guitar-14020427/)                     |
| `pottery.jpg`                                 | wal_ 172619    | [Hands crafting clay](https://www.pexels.com/photo/pottery-making-hands-crafting-clay-on-wheel-37635984/) |
| `electronics.jpg`                             | Kaboompics     | [Electronics workbench](https://www.pexels.com/photo/tools-on-a-desktop-7286026/)                         |
| `dance.jpg`                                   | Michael Zittel | [People inside room (dance class)](https://www.pexels.com/photo/people-inside-room-12312/)                |

The downloaded versions are 800 × 600 JPEGs, approximately 255 KB combined, using Pexels' image-resizing endpoint. Images are served locally; browsing does not contact a stock-photo service. The layout reserves their dimensions, uses empty alt text alongside descriptive captions, and lazily loads secondary images. The interface explicitly identifies them as illustrative; they do not depict verified courses, centres, instructors, or availability. They are independent of ingestion data.

## UrbanLabs logo

Created with the built-in imagegen tool on 2026-11-06. The open book and welcoming doorway represent learning nearby. The wordmark remains real HTML text.

- Original: `docs/brand/learnaprop-logo-original.png` (transparent, 1280 × 1280).
- Web asset and favicon: `public/images/brand/learnaprop-logo.png` (transparent, 192 × 192; resized for delivery).

Original generation prompt, recorded before the project was renamed to UrbanLabs:

> Use case: logo-brand. Asset type: transparent logo symbol for LearnAprop, a friendly nonprofit directory of local in-person learning in Barcelona. Primary request: create one distinctive, simple flat logo symbol combining the idea of an open book with a welcoming neighbourhood doorway. Rounded confident shapes, warm community character, forest green #205846 with a small muted ochre #d4a24c accent. Compact square composition, bold readable silhouette at small header size. Transparent background, no lettering, no words, no mockup, no shadows or gradients. One single logo mark, clean edges, modest padding.

## GitHub footer icon

`public/icons/github.svg` is GitHub's `mark-github-16` from [Primer Octicons](https://github.com/primer/octicons/blob/main/icons/mark-github-16.svg). It is served locally alongside a visible, localized repository link. The MIT copyright and permission notice are preserved in `public/icons/OCTICONS-LICENSE.txt`.

## Leaflet maps

The directory and centre pages bundle [Leaflet](https://leafletjs.com/) under its
BSD 2-Clause license. The full notice is included at
[`public/licenses/leaflet.txt`](../public/licenses/leaflet.txt). OpenStreetMap tiles
retain visible [OpenStreetMap attribution](https://www.openstreetmap.org/copyright)
and follow the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
