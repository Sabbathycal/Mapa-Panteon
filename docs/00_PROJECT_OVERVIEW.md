# Mapa Panteón V2

## Project Overview

**Version**: 2.0

**Status**: Planning

**Deployment**: GitHub Pages

**Architecture**: Vue 3 + Vite + Pinia + Leaflet + Microsoft Graph

---

# ¿Qué es Mapa Panteón V2?

Mapa Panteón V2 es una aplicación web interna utilizada para consultar, localizar y administrar información relacionada con lotes dentro del panteón mediante un mapa interactivo.

La aplicación utiliza el mapa como referencia visual para permitir a los usuarios encontrar rápidamente ubicaciones físicas y acceder a la información administrativa asociada.

La V2 reemplaza la arquitectura de la versión actual mediante una **Single Page Application** moderna, modular y preparada para integrarse con Microsoft 365.

---

# Misión del Proyecto

Permitir que los empleados consulten y administren información de lotes utilizando un mapa interactivo como herramienta principal de navegación.

La modificación de la geometría del mapa será una función administrativa reservada para personal autorizado del área de Sistemas.

---

# Objetivos Principales

## Administración Operativa

Permitir que los usuarios:

* Localicen lotes.
* Consulten información.
* Actualicen estados.
* Actualicen observaciones.
* Consulten propietarios.
* Realicen búsquedas avanzadas.

---

## Experiencia de Usuario

Reducir el tiempo necesario para localizar información dentro del panteón.

El mapa deberá funcionar como una referencia visual permanente.

---

## Integración Empresarial

Integrar la aplicación con Microsoft 365 utilizando:

* Microsoft Entra ID
* Microsoft Graph
* SharePoint Lists

---

## Mantenibilidad

Reducir dependencias innecesarias.

Separar responsabilidades.

Facilitar futuras modificaciones.

---

## Escalabilidad

Permitir la incorporación futura de:

* Nuevos módulos.
* Nuevos tipos de elementos.
* Reportes.
* Estadísticas.
* Auditoría.
* Multiusuario.

---

# Roles

La aplicación contempla dos niveles de acceso.

---

## User

Usuarios operativos.

Permisos:

* Consultar mapa.
* Buscar lotes.
* Filtrar información.
* Consultar inventario.
* Modificar información operativa autorizada.
* Guardar cambios en SharePoint.

No pueden modificar la geometría del mapa.

---

## Admin

Personal de Sistemas.

Permisos:

* Todas las funciones User.
* Crear lotes.
* Eliminar lotes.
* Modificar lotes.
* Crear manzanas.
* Modificar manzanas.
* Crear secciones.
* Modificar secciones.
* Importar geometría.
* Exportar geometría.
* Acceder a herramientas administrativas.

---

# Arquitectura General

La aplicación funcionará como una Single Page Application (SPA).

El mapa permanecerá cargado durante toda la sesión.

La interfaz cambiará dinámicamente sin abandonar la página principal.

---

# Restricciones del Proyecto

## GitHub Pages

La aplicación será desplegada mediante GitHub Pages.

Por lo tanto:

* No existirá backend propio.
* No existirán servidores de aplicación.
* Toda la lógica deberá ejecutarse en el navegador.

---

## Aplicación Frontend

Toda funcionalidad deberá ejecutarse desde el cliente.

No se utilizarán:

* Express
* ASP.NET
* Django
* Flask
* PHP

---

## Seguridad

No podrán almacenarse secretos dentro del proyecto.

La autenticación deberá realizarse utilizando Microsoft Authentication Library (MSAL).

---

# Fuentes de Datos

La aplicación manejará dos dominios independientes.

---

## Geometría

Información estructural del mapa.

Incluye:

* Imagen base.
* Secciones.
* Manzanas.
* Lotes.
* Nichos.
* Coordenadas.

Estos datos cambian muy rara vez.

La administración de estos datos corresponde exclusivamente a Sistemas.

---

## Inventario

Información operativa.

Incluye:

* Estado.
* Propietario.
* Observaciones.
* Datos administrativos.

Estos datos cambian constantemente.

SharePoint será la fuente oficial de información.

---

# Integración Microsoft 365

La autenticación será realizada mediante Microsoft Entra ID.

La consulta y actualización de inventario se realizará mediante Microsoft Graph.

SharePoint funcionará como sistema maestro para la información operativa.

---

# Filosofía de Desarrollo

La V2 no es una migración.

La V2 es una reimplementación.

La V1 sirve como referencia funcional.

La V2 servirá como nueva base tecnológica para el crecimiento futuro del sistema.

---

# Definición de Éxito

La V2 se considerará exitosa cuando:

* Los usuarios puedan localizar información rápidamente.
* El inventario se sincronice correctamente con SharePoint.
* La aplicación reduzca tiempos de consulta.
* La arquitectura sea modular y mantenible.
* La edición geométrica permanezca bajo control del área de Sistemas.
* El proyecto pueda evolucionar sin requerir una nueva reescritura.
