# Paddock Plus — Gestor de Escudería

Juego de gestión de una escudería de monoplazas para el navegador, en español. Elige un equipo, ficha pilotos, invierte en I+D, negocia patrocinios, decide la estrategia de cada carrera y construye tu dinastía temporada a temporada.

**Cómo jugar:** abre `index.html` en cualquier navegador; no hace falta instalar nada. También puedes publicarlo tal cual en GitHub Pages. La partida se guarda automáticamente en el navegador y se puede exportar o importar como JSON.

## Características
- 10 equipos y más de 25 pilotos ficticios con ritmo, habilidad en duelos, consistencia, potencial y edad.
- Simulación vuelta a vuelta: clasificación, desgaste de neumáticos, paradas, adelantamientos según el trazado, coche de seguridad, lluvia, averías y accidentes.
- Repetición de la carrera con torre de tiempos y comentarios en directo.
- Estrategia por piloto: 1 o 2 paradas y ritmo conservador, equilibrado o agresivo.
- I+D en cuatro áreas (aerodinámica, motor, chasis y fiabilidad) con rendimientos decrecientes, más fábrica y equipo de boxes.
- Patrocinadores con objetivos, economía por carrera y objetivo del consejo.
- Pretemporada: envejecimiento y evolución de los pilotos, retiradas, novatos, mercado de fichajes y renovaciones, y cambio de reglamento cada 4 años.
- Palmarés histórico y estadísticas de carrera.

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
- `js/engine.js`: simulación, economía, mercado y guardado.
- `js/roster.js`: importador de plantillas externas (formato F1 Dynasty).
- `js/ui.js`: interfaz.

## Créditos
- **Inspiración:** [F1 Dynasty](https://f1dynasty.com/), un gestor de escuderías para el navegador. Gracias a su creador por la idea.
- F1 Dynasty no publica su código bajo una licencia abierta, así que **este proyecto no contiene código, textos, arte ni datos de F1 Dynasty**. Es una implementación original del mismo género, escrita desde cero.
- **Plantillas:** compatibilidad con las plantillas de la comunidad de F1 Dynasty, como [RuleImpossible3362/F1DynastyRosters](https://github.com/RuleImpossible3362/F1DynastyRosters). Los datos de esas plantillas son de sus autores.
- No está afiliado a Formula One Group, la FIA ni ninguna escudería. "Formula 1" y "F1" son marcas de sus respectivos propietarios. Los equipos, pilotos y patrocinadores de la plantilla por defecto son ficticios; los nombres reales que aparezcan en plantillas importadas proceden de esos archivos externos.
