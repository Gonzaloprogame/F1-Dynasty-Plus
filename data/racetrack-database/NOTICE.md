# Datos de circuitos reales

Los archivos de `tracks/` (línea central y anchos) y `racelines/` (trazada óptima) son una copia **sin modificar** de la
**TUM racetrack-database** de la Universidad Técnica de Múnich (Institute of Automotive Technology):

- Origen: https://github.com/TUMFTM/racetrack-database (commit `e59595d1f3573b30d1ded6a08984935b957688e0`)
- Licencia: GNU LGPL v3.0, incluida en `LICENSE`. El README original está en `README.md`.
- Las líneas centrales originales proceden de © OpenStreetMap contributors (ODbL 1.0, https://www.openstreetmap.org/copyright).

Paddock Plus solo lee estos archivos en tiempo de ejecución para dibujar los circuitos en 2D y 3D; no los altera.
Puedes sustituirlos por otra versión de la misma base de datos.
