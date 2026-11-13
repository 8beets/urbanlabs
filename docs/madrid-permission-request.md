# Draft: access request to the Ayuntamiento de Madrid

Not sent. To be reviewed and sent by a maintainer, for example through the contact form of the open-data portal (datos.madrid.es) or the Dirección General de Transparencia.

**Para:** Ayuntamiento de Madrid, portal de datos abiertos (datos.madrid.es)
**Asunto:** Acceso automatizado al conjunto de datos «Cursos y talleres en los centros culturales de los distritos» (50064)

Buenos días:

Somos los responsables de UrbanLabs (https://urbanlabs.fyi, código abierto en https://github.com/8beets/urbanlabs), un directorio gratuito y sin ánimo de lucro para descubrir cursos y talleres presenciales de centros municipales y entidades locales. No es una plataforma de inscripción ni de venta.

Queremos mostrar los cursos y talleres de los centros culturales de distrito a partir del conjunto de datos [Cursos y talleres en los centros culturales de los distritos](https://datos.madrid.es/dataset/50064-0-talleres-culturales-cursos), publicado con licencia CC BY 4.0, citando la fuente («Ayuntamiento de Madrid – datos.madrid.es») y enlazando a la página de cada centro en madrid.es.

Para mantener la información al día necesitaríamos descargar la instantánea CSV más reciente una vez al día como máximo, respetando el `Crawl-delay` de 10 segundos (unas tres peticiones al día: la ficha CKAN del conjunto de datos y el CSV). Desde el 13 de noviembre de 2026, el `robots.txt` de datos.madrid.es bloquea para clientes automatizados la API (`/api/`) y las descargas de recursos (`/dataset/*/resource/*`), así que hemos pausado la integración.

¿Podríais autorizar este uso, o indicarnos una URL estable del último CSV que admita descargas automatizadas? Si preferís otra vía o unas condiciones concretas, las atenderemos.

Muchas gracias.
