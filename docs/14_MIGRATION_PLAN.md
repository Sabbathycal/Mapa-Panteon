# Mapa Panteón V2

## Migration Plan

Version: 2.0

Status: Planning

---

# Propósito

Este documento define la estrategia oficial para migrar **Mapa Panteón V1** hacia **Mapa Panteón V2**.

La migración deberá realizarse de forma gradual, controlada y sin afectar la operación de la versión actualmente utilizada por la empresa.

---

# Objetivos

* Mantener V1 completamente funcional durante el desarrollo.
* Evitar interrupciones para los usuarios.
* Reutilizar la mayor cantidad posible de lógica existente.
* Implementar la nueva arquitectura de forma incremental.
* Validar cada etapa antes de continuar con la siguiente.

---

# Principios

Toda migración deberá priorizar:

* Estabilidad.
* Simplicidad.
* Compatibilidad.
* Mantenibilidad.

---

# Estrategia General

V1 continuará operando mientras V2 se desarrolla de forma completamente independiente dentro de:

```text id="o7z37x"
Fork
└── V2
```

No se migrará toda la aplicación al mismo tiempo.

Cada fase deberá terminarse, probarse y estabilizarse antes de iniciar la siguiente.

---

# Orden Oficial de Migración

---

## Fase 0

### Preparación del Proyecto

Objetivos:

* Crear proyecto Vue.
* Configurar Vite.
* Configurar Pinia.
* Configurar Vue Router.
* Configurar ESLint.
* Configurar Prettier.
* Configurar estructura de carpetas.
* Configurar arquitectura base.

Resultado esperado:

Proyecto base funcionando correctamente.

---

## Fase 1

### Migración del Mapa

Objetivos:

* Inicializar Leaflet.
* Mostrar mapa.
* Cargar GeoJSON.
* Mostrar Secciones.
* Mostrar Manzanas.
* Mostrar Lotes.
* Mostrar Nichos.

Resultado esperado:

El mapa deberá visualizarse de forma equivalente a V1.

No se implementará todavía autenticación ni SharePoint.

---

## Fase 2

### Migración de Interacción

Objetivos:

* Selección de elementos.
* Sidebar.
* Búsqueda.
* Zoom.
* Centrado.
* Navegación.

Resultado esperado:

La navegación principal del mapa deberá estar completamente funcional.

---

## Fase 3

### Autenticación

Objetivos:

* Integrar Microsoft Entra ID.
* Implementar AuthService.
* Implementar AuthStore.
* Gestionar sesión.
* Implementar roles.
* Proteger rutas administrativas.

Resultado esperado:

La aplicación deberá identificar correctamente a cada usuario antes de acceder a información protegida.

---

## Fase 4

### Inventario

Objetivos:

* Integrar Microsoft Graph.
* Integrar SharePoint.
* Implementar InventoryService.
* Mostrar inventario.
* Actualizar estados.
* Actualizar observaciones.
* Implementar polling.

Resultado esperado:

Los usuarios podrán consultar y actualizar el inventario directamente desde SharePoint.

---

## Fase 5

### Herramientas Administrativas

Objetivos:

Migrar las herramientas administrativas existentes en V1.

Funciones:

* Crear Secciones.

* Editar Secciones.

* Eliminar Secciones.

* Crear Manzanas.

* Editar Manzanas.

* Eliminar Manzanas.

* Crear Lotes.

* Editar Lotes.

* Eliminar Lotes.

* Crear Nichos.

* Editar Nichos.

* Eliminar Nichos.

* Generar GeoJSON.

* Copiar GeoJSON.

Resultado esperado:

El área de Sistemas recupera completamente las capacidades administrativas existentes en V1.

La publicación continuará realizándose manualmente mediante GitHub.

---

## Fase 6

### Optimización

Objetivos:

* Refactorización.
* Optimización.
* Eliminación de código obsoleto.
* Mejoras de rendimiento.
* Limpieza general.

Resultado esperado:

Código limpio, mantenible y consistente.

---

## Fase 7

### Validación Final

Validar:

* Usuarios.
* Administradores.
* Autenticación.
* SharePoint.
* Sincronización.
* Herramientas administrativas.
* Publicación.
* Compatibilidad con GitHub Pages.

Resultado esperado:

Aplicación lista para evaluación de producción.

---

# Ciclo de Trabajo

Cada fase seguirá el mismo proceso:

Planificar

↓

Desarrollar

↓

Probar

↓

Corregir

↓

Actualizar documentación

↓

Continuar

---

# Compatibilidad

Durante todo el desarrollo:

* V1 continuará funcionando.
* V2 no modificará V1.
* Las mejoras para V1 seguirán realizándose desde el Fork Main mediante Pull Requests independientes.

---

# Criterios para Avanzar

No deberá iniciarse una nueva fase mientras la fase actual presente errores críticos o funcionalidades incompletas.

---

# Definición de MVP

Mapa Panteón V2 alcanzará el estado de MVP cuando existan:

* Mapa completamente funcional.
* Autenticación mediante Microsoft Entra ID.
* Integración con SharePoint.
* Consulta de inventario.
* Actualización de estados.
* Búsqueda.
* Sincronización automática.

Las herramientas administrativas podrán finalizarse posteriormente sin impedir el inicio de la operación.

---

# Criterios de Producción

La migración desde V1 podrá considerarse cuando:

* El MVP sea estable.
* Las pruebas sean satisfactorias.
* El área de Sistemas apruebe la aplicación.
* Se autorice formalmente el reemplazo de V1.

---

# Regla de Oro

Nunca deberá comprometerse la estabilidad de V1 para acelerar el desarrollo de V2.

La migración deberá realizarse de forma incremental, validando cada etapa antes de avanzar, garantizando que cada nueva funcionalidad mantenga la arquitectura y los principios definidos para el proyecto.
