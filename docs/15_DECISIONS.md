# Mapa Panteón V2

## Architecture Decisions

Version: 2.0

Status: Living Document

---

# Propósito

Este documento registra las decisiones arquitectónicas más importantes tomadas durante el diseño y desarrollo de Mapa Panteón V2.

Su objetivo es preservar el contexto detrás de cada decisión para facilitar el mantenimiento futuro del proyecto.

Cada decisión deberá incluir:

* Problema.
* Decisión tomada.
* Justificación.

---

# AD-001

## Single Page Application (SPA)

### Problema

La versión V1 utiliza múltiples páginas para distintas funciones administrativas.

Esto incrementa la navegación y dificulta mantener una experiencia consistente.

---

### Decisión

Mapa Panteón V2 será desarrollado como una **Single Page Application (SPA)**.

---

### Justificación

Permite:

* Mejor experiencia de usuario.
* Menor tiempo de navegación.
* Compartir estado entre componentes.
* Mejor integración con Vue.

---

# AD-002

## Vue como Framework Principal

### Problema

El crecimiento esperado del proyecto hace difícil continuar manteniendo JavaScript monolítico.

---

### Decisión

Migrar completamente la aplicación a Vue.

---

### Justificación

* Componentización.
* Reutilización.
* Ecosistema maduro.
* Fácil mantenimiento.

---

# AD-003

## Pinia para Estado Global

### Problema

Compartir información entre múltiples componentes puede generar dependencias difíciles de mantener.

---

### Decisión

Centralizar el estado utilizando Pinia.

---

### Justificación

* Estado único.
* Reactividad.
* Separación clara.
* Integración oficial con Vue.

---

# AD-004

## Separación entre Geometría e Inventario

### Problema

La geometría y el inventario tienen ciclos de vida completamente distintos.

---

### Decisión

Mantener ambos dominios completamente separados.

---

### Justificación

Geometría:

* GeoJSON.
* Git.
* GitHub Pages.

Inventario:

* SharePoint.
* Microsoft Graph.

Esto permite actualizar inventario sin volver a desplegar la aplicación.

---

# AD-005

## GitHub Pages como Plataforma

### Problema

Se requiere una solución sencilla, económica y fácil de mantener.

---

### Decisión

Mantener GitHub Pages como plataforma de despliegue.

---

### Justificación

* Ya forma parte de V1.
* No requiere infraestructura adicional.
* Reduce costos.
* Simplifica el mantenimiento.

---

# AD-006

## SharePoint como Fuente de Inventario

### Problema

El inventario cambia constantemente.

Mantenerlo dentro de archivos GeoJSON obligaría a publicar una nueva versión por cada modificación.

---

### Decisión

Almacenar el inventario en SharePoint.

---

### Justificación

* Actualización inmediata.
* Integración con Microsoft 365.
* Sin despliegues adicionales.
* Administración centralizada.

---

# AD-007

## Microsoft Graph

### Problema

La aplicación necesita comunicarse con SharePoint.

---

### Decisión

Utilizar Microsoft Graph como única API oficial.

---

### Justificación

* API soportada por Microsoft.
* Integración con Entra ID.
* Compatible con SharePoint Online.

---

# AD-008

## Microsoft Entra ID

### Problema

Se requiere autenticar únicamente empleados autorizados.

---

### Decisión

Toda autenticación será realizada mediante Microsoft Entra ID.

---

### Justificación

* No almacenar contraseñas.
* Integración con Microsoft 365.
* Administración centralizada de usuarios.

---

# AD-009

## Polling

### Problema

GitHub Pages es una plataforma estática.

No existe un backend que pueda mantener conexiones persistentes.

---

### Decisión

Utilizar Polling para sincronizar inventario.

---

### Justificación

* Simplicidad.
* Compatibilidad con GitHub Pages.
* Sin infraestructura adicional.
* Fácil mantenimiento.

---

# AD-010

## Publicación Manual de Geometría

### Problema

La geometría cambia con poca frecuencia y requiere revisión antes de publicarse.

---

### Decisión

Mantener el flujo actual:

Editar

↓

Generar GeoJSON

↓

Copiar

↓

Commit

↓

GitHub Pages

---

### Justificación

* Compatible con V1.
* Control total sobre los cambios.
* Fácil rollback.
* No requiere automatización.

---

# AD-011

## Desarrollo Aislado

### Problema

V1 continúa siendo utilizada por la empresa.

El desarrollo de V2 no debe afectar producción.

---

### Decisión

Desarrollar V2 exclusivamente dentro de la rama:

```text id="y3wy4v"
Fork/V2
```

---

### Justificación

* Aislamiento completo.
* Menor riesgo.
* Libertad para refactorizar.
* Protección de producción.

---

# AD-012

## Prioridad del MVP

### Problema

El proyecto tiene múltiples áreas de desarrollo posibles.

---

### Decisión

Priorizar:

1. Mapa.
2. Autenticación.
3. SharePoint.
4. Inventario.

Las herramientas administrativas continuarán desarrollándose posteriormente.

---

### Justificación

El mayor valor para los usuarios se obtiene al modernizar primero el flujo operativo diario.

---

# AD-013

## Arquitectura por Capas

### Problema

La lógica mezclada dificulta el mantenimiento.

---

### Decisión

Toda la aplicación seguirá el flujo:

```text id="ukzdrn"
Component

↓

Store

↓

Service

↓

Sistema Externo
```

---

### Justificación

* Responsabilidades claras.
* Código reutilizable.
* Fácil depuración.
* Escalabilidad.

---

# AD-014

## Documentación como Parte del Proyecto

### Problema

Las decisiones arquitectónicas suelen perderse con el tiempo.

---

### Decisión

La documentación técnica forma parte del proyecto.

Toda modificación importante de arquitectura deberá reflejarse en los documentos correspondientes.

---

### Justificación

Permite que futuros desarrolladores comprendan no sólo cómo funciona el sistema, sino también por qué fue construido de esa manera.

---

# Regla de Oro

Las decisiones registradas en este documento representan el estado actual de la arquitectura.

Podrán modificarse cuando exista una razón técnica suficientemente justificada, siempre que la documentación permanezca sincronizada con el código y las nuevas decisiones queden registradas para futuras generaciones de desarrolladores.
