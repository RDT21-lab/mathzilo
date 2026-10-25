# Fase 11: piloto con la familia (2 semanas + 1 sesión de ajustes)

## Antes de empezar (día 0)
- [ ] Servidor en marcha con HTTPS (ver `guia-instalacion.md`) o, si no, uso en un solo dispositivo.
- [ ] App instalada en la tablet y en el móvil, tablet vinculada, «Proteger los datos» pulsado.
- [ ] Nivel de cada hijo elegido a mano (1: 6-7 años … 6: 11-12 años). Tono de las explicaciones: 6-8 o 9-12 años.
- [ ] Premios publicados con su coste. Equivalencia de la estrella anotada (solo la ve el adulto).
- [ ] Explicado al niño en 2 minutos: elegir perfil, Empezar, «No lo entiendo» si una explicación no se entiende.

## Durante las 2 semanas
- El niño hace un test al día, sin ayuda. El adulto no corrige ni explica: solo observa.
- El adulto apunta lo que vea en **Modo padre → Panel → Resumen del piloto → Notas del piloto**: pantallas donde el niño se atasca, textos que no entiende, si los premios motivan, si quiere más o menos preguntas.
- Si algo falla, no hay que hacer nada especial: los errores técnicos quedan registrados sin datos personales.

## Sesión de ajustes (día 14)
1. Exporta los datos (Ajustes → Datos y privacidad → Exportar). El archivo incluye las notas del piloto y los errores.
2. Abre **Panel → Resumen del piloto** y revisa:

| Indicador | Qué mirar | Cómo ajustar |
|---|---|---|
| Días con test (de 14) | Menos de 8 = cuesta crear el hábito | Tests más cortos (longitud máxima 10) o premios intermedios más baratos |
| Estrellas al mes a este ritmo | El panel compara con el premio más caro | Ajustes → Estrellas (bonus) o el coste de los premios |
| Tests aprobados | Por debajo del 50 % = nivel alto; casi todos perfectos = nivel bajo | Acepta o descarta la sugerencia de nivel del panel |
| Tests con prisa | Responde sin leer | Hablarlo con el niño. La regla ya quita el bonus |
| Explicaciones marcadas «No lo entiendo» | Habilidad + tipo de error con más marcas | Reescribir esos textos en `app/src/i18n/<idioma>/content.json` (claves `tag.*` y `ex.*`) |

3. Lleva al desarrollo la lista de textos confusos y fallos, con las notas.
4. Criterio de salida: el niño termina tests solo, entiende las explicaciones y las estrellas encajan con los premios.
