# Mapa Panteón V2

## Features

Version: 2.0

Status: Planning

---

# Objetivo

Mapa Panteón V2 es una **Single Page Application (SPA)** para la administración y consulta del inventario del panteón.

La aplicación permitirá a los empleados consultar y actualizar información operativa de lotes y nichos, mientras que el área de Sistemas conservará el control sobre la estructura geométrica del mapa.

---

# Usuarios

## User

Personal operativo del panteón.

Funciones principales:

* Consultar mapa.
* Buscar lotes y nichos.
* Consultar información.
* Actualizar estados permitidos.
* Consultar observaciones.

---

## Admin

Uso exclusivo del área de Sistemas.

Además de todas las funciones de User, podrá:

* Administrar geometría.
* Importar geometría.
* Exportar geometría.
* Utilizar herramientas administrativas.
* Ejecutar diagnósticos.

---

# Funcionalidades Principales (MVP)

## Mapa

* Navegación interactiva.
* Zoom.
* Pan.
* Selección de elementos.

---

## Inventario

* Consulta de información.
* Actualización de estados.
* Actualización de observaciones.
* Sincronización con SharePoint.

---

## Búsqueda

* Buscar por lote.
* Buscar por nicho.
* Buscar por sección.
* Buscar por manzana.

---

## Sincronización

* Integración con SharePoint.
* Polling automático.
* Actualización manual.

---

## Autenticación

* Inicio de sesión mediante Microsoft Entra ID.
* Roles User/Admin.

---

# Administración de Geometría

**Disponible únicamente para administradores.**

El sistema deberá permitir administrar la estructura geométrica del mapa conforme el panteón continúe expandiéndose físicamente.

Las funciones incluyen:

* Crear secciones.

* Editar secciones.

* Eliminar secciones.

* Crear manzanas.

* Editar manzanas.

* Eliminar manzanas.

* Crear lotes.

* Editar lotes.

* Eliminar lotes.

* Crear nichos.

* Editar nichos.

* Eliminar nichos.

---

# Publicación de Geometría

Las modificaciones geométricas **no** se publicarán automáticamente.

El flujo oficial será:

Editar geometría

↓

Generar GeoJSON actualizado

↓

Copiar GeoJSON

↓

Actualizar archivo correspondiente en GitHub

↓

Commit

↓

Despliegue mediante GitHub Pages

Este flujo replica el proceso utilizado actualmente en V1 y permite mantener control sobre los cambios publicados.

---

# Funciones Futuras

Posibles mejoras:

* Editor geométrico avanzado.
* Herramientas de validación.
* Historial de cambios.
* Auditoría.
* Reportes.
* Estadísticas.

Estas funciones no forman parte del MVP y podrán implementarse posteriormente sin modificar la arquitectura principal.

---

# Objetivo del MVP

La prioridad de V2 será entregar una aplicación estable para el personal operativo mediante:

* Consulta rápida del mapa.
* Actualización de inventario mediante SharePoint.
* Autenticación con Microsoft Entra ID.
* Conservación de las herramientas administrativas de geometría ya existentes en V1.
