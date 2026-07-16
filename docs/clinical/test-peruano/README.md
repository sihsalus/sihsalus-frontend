# Test Peruano de Evaluacion del Desarrollo del Nino

Material normativo, operativo y visual reunido para analizar la implementacion de un
widget del Test Peruano de Evaluacion del Desarrollo del Nino (TPED) usado localmente
por el hospital.

> **Estado normativo:** este es un instrumento historico. No es el instrumento indicado
> por la norma CRED vigente. Su eventual implementacion debe identificarse como flujo
> local/legado y ser validada por la jefatura clinica del hospital.

## Conclusion normativa

La palabra "deprecado" describe bien la situacion funcional, pero la cadena legal es mas
precisa:

1. La RM N. 990-2010/MINSA aprobo la NTS N. 087-MINSA/DGSP-V.01. Su Anexo 9 contiene
   la ficha y la guia completa del Test Peruano para ninos de 0 a 30 meses.
2. La RM N. 537-2017/MINSA aprobo la NTS N. 137-MINSA/2017/DGIESP y, en su articulo
   3, dejo sin efecto la RM N. 990-2010/MINSA.
3. La RM N. 644-2018/MINSA modifico un apartado de la NTS N. 137.
4. La RM N. 682-2025/MINSA aprobo la NTS N. 238-MINSA/DGIESP-2025 y, en su articulo
   2, derogo las RM N. 537-2017/MINSA y N. 644-2018/MINSA.
5. La NTS N. 238 vigente usa el Huanca Test adaptado para vigilancia hasta los 36 meses
   y la prueba EDI para tamizaje desde 1 hasta 60 meses. No incluye el TPED como
   instrumento vigente.

La publicacion editorial oficial de la NTS N. 238 y su libreta CRED se publicaron el 12
de marzo de 2026. Esta carpeta fue verificada el **9 de julio de 2026**.

## Lectura minima necesaria

1. [Anexo 9 del TPED, paginas PDF 88-118](excerpts/test-peruano-anexo-09-paginas-pdf-88-118.pdf):
   ficha, factores de riesgo, materiales, administracion, interpretacion y exploracion de
   cada hito. Es la especificacion operativa principal.
2. [NTS 087 completa](pdf/historical/rm-990-2010-minsa-nts-087.pdf): contexto de la
   norma historica y fuente del Anexo 9.
3. [RM 537 y NTS 137](pdf/historical/rm-537-2017-minsa-nts-137.pdf): documento que
   dejo sin efecto la RM 990-2010.
4. [RM 682-2025](pdf/current/rm-682-2025-minsa.pdf) y
   [NTS 238 vigente](pdf/current/nts-238-minsa-dgiesp-2025.pdf): estado normativo y
   flujo CRED actual.
5. [Libreta CRED 2026](pdf/current/libreta-cred-2026.pdf): representacion visual
   vigente de la vigilancia del desarrollo.

## Inventario

### Historico

| Archivo | Contenido | Paginas PDF relevantes |
| --- | --- | --- |
| `pdf/historical/rm-990-2010-minsa-nts-087.pdf` | NTS 087 completa | 88-118: Anexo 9 TPED |
| `pdf/historical/rm-537-2017-minsa-nts-137.pdf` | RM 537 y cuerpo de la NTS 137 | 2: deja sin efecto la RM 990 |
| `pdf/historical/rm-537-2017-minsa-anexos-01-10.pdf` | Anexos 1 al 10 de la NTS 137 | Referencia historica |
| `pdf/historical/rm-537-2017-minsa-anexos-11-22.pdf` | Anexos 11 al 22 de la NTS 137 | Referencia historica |
| `pdf/historical/rm-644-2018-modificacion-nts-137.pdf` | Modificacion de la NTS 137 | Documento completo |

Los archivos de 2017 y 2018 son escaneos oficiales sin capa de texto. Se conservaron
sin OCR para no modificar los originales.

### Vigente y comparativo

| Archivo | Contenido | Paginas PDF relevantes |
| --- | --- | --- |
| `pdf/current/rm-682-2025-minsa.pdf` | Resolucion que aprueba NTS 238 y deroga RM 537/644 | 2 |
| `pdf/current/nts-238-minsa-dgiesp-2025.pdf` | NTS CRED vigente, edicion febrero 2026 | 26-27, 101-117 |
| `pdf/current/libreta-cred-2026.pdf` | Libreta de Cuidado Integral CRED | 7: vigilancia del desarrollo |

En la NTS 238, la pagina PDF 26 define Huanca Test adaptado para vigilancia; la pagina
27 define EDI para tamizaje. El procedimiento del Anexo 10 comienza en la pagina PDF
101, Huanca Test en la 103 y EDI en la 117.

## Imagenes y pictogramas

- [Ficha historica en horizontal](images/historical/test-peruano-profile-landscape.png):
  render derivado de la pagina PDF 88, a 200 dpi. Es la referencia visual mas legible.
- [Pagina historica sin rotar](images/historical/test-peruano-profile-source-page-088.png):
  render fiel a la orientacion del PDF.
- [Mascara de pictogramas incrustada](images/historical/test-peruano-pictogram-mask-original.jpg):
  extraccion binaria de 640 x 433 px. Es una mascara monocroma de baja resolucion y no
  debe usarse como asset de produccion.
- [Grafico Huanca de la NTS 238](images/current/huanca-chart-nts238-original.jpg):
  imagen incrustada en la pagina PDF 107; sirve solo para contrastar el instrumento vigente.
- [Pagina 7 de la Libreta CRED](images/current/huanca-chart-libreta-source-page-007.png)
  y [version SVG de la pagina](images/current/huanca-chart-libreta-page.svg): referencia
  visual vigente. El SVG es una conversion de la pagina completa, no un original editorial.

No se encontro un paquete oficial independiente de pictogramas del TPED. La ficha
historica es la unica fuente oficial localizada que contiene esos dibujos. La propia guia
indica que el "libro de figuras" del material de aplicacion es de **diseno propio**, con 10
a 12 paginas y una o dos figuras grandes por pagina; por tanto, no existe en la norma un
libro oficial de laminas que deba copiarse.

## Alcance operativo historico

El TPED cubre de 0 a 30 meses. La ficha tiene columnas para 1 a 12, 15, 18, 21, 24 y 30
meses, y doce lineas de comportamiento:

1. Control de cabeza y tronco sentado (A).
2. Control de cabeza y tronco, rotaciones (B).
3. Control de cabeza y tronco, marcha (C).
4. Uso del brazo y mano (D).
5. Vision (E).
6. Audicion (F).
7. Lenguaje comprensivo (G).
8. Lenguaje expresivo (H).
9. Comportamiento social (I).
10. Alimentacion, vestido e higiene (J).
11. Juego (K).
12. Inteligencia y aprendizaje (L).

Reglas que deben conservarse si se implementa el flujo legado:

- Los espacios en blanco equivalen al hito inmediato anterior.
- La edad se calcula en meses cumplidos: 1 mes y 28 dias cuenta como 1 mes; 1 mes y
  29 dias cuenta como 2 meses.
- Hasta los 12 meses la evaluacion es mensual; luego se usan 15, 18, 21, 24 y 30 meses.
- Se comienza en la columna del mes anterior y se avanza horizontalmente hasta el hito
  mas alto logrado en cada linea.
- Cada hito puede ser observado, referido u observado/referido segun la guia. Cuando
  ambas opciones son validas, se prefiere observacion directa.
- El perfil se obtiene uniendo el ultimo hito logrado de cada linea.
- Sin desviacion: desarrollo normal. Desviacion a la izquierda: trastorno del desarrollo.
  Desviacion a la derecha: adelanto. Perfil sin desviacion pero con al menos un factor de
  riesgo: riesgo para trastorno del desarrollo.

Los pequenos valores numericos impresos dentro de la ficha no tienen una regla de suma o
puntaje explicada en la guia. No deben convertirse en un score inventado.

## Limites de uso

- Este material no sustituye criterio clinico, capacitacion ni aprobacion institucional.
- El widget debe mostrar claramente que se trata del **TPED historico/local**, no de la
  evaluacion CRED normativa vigente.
- Conviene habilitarlo por configuracion del hospital y conservar instrumento, version,
  fecha y autor de cada evaluacion para auditoria.
- Los pictogramas deben complementar texto accesible, nunca ser el unico significado del
  hito.
- La ficha y las ilustraciones son material de MINSA con participacion y creditos de
  UNICEF. Su archivo aqui sirve para referencia clinica y de software; no concede permiso
  para rediseno, publicacion comercial o redistribucion de assets derivados.

La procedencia exacta, enlaces de capacitacion, fallos de descarga y hashes estan en
[SOURCES.md](SOURCES.md). Las decisiones recomendadas para el modelo de datos y el widget
estan en [IMPLEMENTATION-NOTES.md](IMPLEMENTATION-NOTES.md). El estado real del mapeo de
los 88 hitos se encuentra en [CONCEPT-AUDIT.md](CONCEPT-AUDIT.md).
