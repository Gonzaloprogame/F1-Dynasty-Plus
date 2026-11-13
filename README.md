# Paddock Plus — Gestor de Escudería

▶️ **Jugar:** https://gonzaloprogame.github.io/F1-Dynasty-Plus/

Juego de gestión de una escudería de monoplazas para el navegador, en español. Elige un equipo, ficha pilotos, invierte en I+D, negocia patrocinios, decide la estrategia de cada carrera y construye tu dinastía temporada a temporada.

**Cómo jugar:** abre `index.html` en cualquier navegador; no hace falta instalar nada. Para ver los circuitos reales, sírvelo desde un servidor (GitHub Pages o `python3 -m http.server`): abierto como archivo local, el navegador no deja leer los datos y se usan trazados generados.

**Jugar online:** hay una versión publicada en https://claude.ai/artifact/4F8nA6bSP6E8c14Np7rhP2 (privada hasta que se comparta desde su menú *Share*).

**GitHub Pages:** el flujo `.github/workflows/pages.yml` publica el juego automáticamente en cada push. Para activarlo una vez: *Settings → Pages → Build and deployment → Source: GitHub Actions*. El juego queda en `https://gonzaloprogame.github.io/F1-Dynasty-Plus/`. En un repositorio privado, Pages requiere un plan de pago de GitHub; en uno público es gratis. La partida se guarda automáticamente en el navegador y se puede exportar o importar como JSON.

## Características
- **Retransmisión 3D estilo televisión:** clasificación, marcador, minimapa y panel del piloto superpuestos a la imagen. Circuitos reales reconstruidos con su línea central, anchos y trazada óptima (13 del calendario; el resto con trazado generado). Calle de boxes con garajes en el color de cada equipo, donde los coches se detienen el tiempo real de su parada; parrilla con semáforo que se enciende luz a luz; carteles de frenada; trazada con goma; ruedas que giran en las curvas; coches que se reparten en carriles al ir juntos; coche de seguridad; lluvia con salpicaduras. Cámaras de persecución, TV, helicóptero, cámara T y libre, y reproducción en tiempo real o a 4×, 16× y 60×.
- **Carrera en directo:** circuito 2D con los coches en movimiento, torre de tiempos, radio y comentarios. Se puede ver a 1×, 2×, 4× u 8×, pausar o saltar al final.
- **Decisiones en carrera:** ritmo (atacar, normal o conservar), llamar a boxes con el compuesto que elijas, órdenes de equipo o dejar la estrategia a la IA.
- **Neumáticos y clima:** blando, medio, duro, intermedio y lluvia, con desgaste y caída de rendimiento. Hay lluvia que empieza o para en mitad de la carrera, previsión con incertidumbre y obligación de usar dos compuestos de seco.
- **Fin de semana completo:** prácticas con minijuego de reglaje, clasificación Q1/Q2/Q3, sprints en algunas rondas y planificador de estrategia con el tiempo estimado de cada opción.
- **Incidentes:** coche de seguridad y coche de seguridad virtual, averías, accidentes, pinchazos y paradas lentas.
- **Gestión:** personal técnico (director técnico, ingeniero de carrera y jefe de mecánicos), moral de los pilotos, límite de gasto por temporada, I+D, fábrica, patrocinadores y objetivo del consejo.
- **Crea tu propio equipo** con nombre, abreviatura y color.
- **Dinastía:** envejecimiento y evolución de los pilotos, retiradas, novatos, mercado de fichajes, cambio de reglamento cada 4 años y palmarés.
- Calendario, clasificaciones y gráfico interactivo de la evolución del campeonato.

## Plantillas de la comunidad (formato F1 Dynasty)
En la pantalla de nueva partida puedes cargar una plantilla en el formato JSON que exporta el editor de F1 Dynasty, desde un archivo o desde una URL. Por ejemplo:

```
https://raw.githubusercontent.com/RuleImpossible3362/F1DynastyRosters/refs/heads/main/F1%20DYNASTY%202026%20ROSTER.json
```

Se importan los equipos (con sus estadísticas de coche y motor adaptadas al motor de Paddock Plus), los pilotos titulares (de la plantilla base o de cualquier temporada 2020–2026 incluida en el archivo), los reservas, los agentes libres, las promesas, el calendario y los patrocinadores. Las plantillas **no se incluyen en este repositorio**: pertenecen a sus autores y se descargan en el navegador del jugador.

## Estructura
- `index.html`: página principal.
- `css/style.css`: estilos (tema claro u oscuro según el sistema; adaptado a móvil).
- `js/data.js`: equipos, pilotos y circuitos (todos ficticios).
- `js/engine.js`: partida, fin de semana, economía, personal, mercado y guardado.
- `js/race.js`: clasificación, sprint y carrera vuelta a vuelta (neumáticos, clima, incidentes).
- `js/track.js`: trazados 2D generados de forma procedural.
- `js/realtracks.js`: carga de circuitos reales, perfil de velocidad y minimapa.
- `js/view3d.js`: retransmisión 3D con three.js (se carga solo al activar la vista 3D).
- `data/racetrack-database/`: datos de circuitos de la TUM racetrack-database, sin modificar, con su licencia (`LICENSE`, LGPL-3.0) y `NOTICE.md`.
- `js/roster.js`: importador de plantillas externas (formato F1 Dynasty).
- `js/ui.js`: interfaz.

## Créditos
- **Inspiración:** [F1 Dynasty](https://f1dynasty.com/), un gestor de escuderías para el navegador, y los juegos de gestión del género como F1® Manager 2024 (retransmisión en directo, estrategia, reglajes y personal). Gracias a sus creadores por las ideas.
- Ninguno de esos juegos publica su código bajo una licencia abierta, así que **este proyecto no contiene código, textos, arte ni datos de ellos**. Es una implementación original del mismo género, escrita desde cero; los trazados se generan de forma procedural.
- **3D:** inspirado en [HybridSim](https://hybridsim.app/); no usa su código, modelos ni texturas. Motor gráfico: [three.js](https://threejs.org/) (MIT), cargado desde jsDelivr.
- **Circuitos reales:** [TUM racetrack-database](https://github.com/TUMFTM/racetrack-database) (Universidad Técnica de Múnich, LGPL-3.0), con líneas centrales de © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL). Se incluye sin modificar en `data/racetrack-database/`.
- **Plantillas:** compatibilidad con las plantillas de la comunidad de F1 Dynasty, como [RuleImpossible3362/F1DynastyRosters](https://github.com/RuleImpossible3362/F1DynastyRosters). Los datos de esas plantillas son de sus autores.
- No está afiliado a Formula One Group, la FIA, Frontier Developments ni ninguna escudería. "Formula 1", "F1" y "F1 Manager" son marcas de sus respectivos propietarios. Los equipos, pilotos y patrocinadores de la plantilla por defecto son ficticios; los nombres reales que aparezcan en plantillas importadas proceden de esos archivos externos.
