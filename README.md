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

## Estructura
- `index.html`: página principal.
- `css/style.css`: estilos (tema claro u oscuro según el sistema; adaptado a móvil).
- `js/data.js`: equipos, pilotos y circuitos (todos ficticios).
- `js/engine.js`: simulación, economía, mercado y guardado.
- `js/ui.js`: interfaz.

## Créditos
- **Inspiración:** [F1 Dynasty](https://f1dynasty.com/), un gestor de escuderías para el navegador. Gracias a su creador por la idea.
- F1 Dynasty no publica su código bajo una licencia abierta, así que **este proyecto no contiene código, textos, arte ni datos de F1 Dynasty**. Es una implementación original del mismo género, escrita desde cero.
- No está afiliado a Formula One Group, la FIA ni ninguna escudería. "Formula 1" y "F1" son marcas de sus respectivos propietarios. Los equipos, pilotos y patrocinadores de este juego son ficticios.
