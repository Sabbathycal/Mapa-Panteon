# Mapa Panteón V2

## Components

Version: 2.0

Status: Planning

---

# Propósito

Este documento define los componentes oficiales de la interfaz de usuario.

Todos los componentes deberán tener una responsabilidad clara y única.

Los componentes no deberán contener lógica de negocio.

La lógica deberá residir en:

* Stores
* Services
* Composables

---

# Jerarquía General

App

↓

MainLayout

↓

TopBar

MapView

Sidebar

Dialogs

Notifications

---

# App.vue

Componente raíz.

Responsabilidades:

* Inicializar aplicación.
* Cargar stores principales.
* Montar MainLayout.

No contiene lógica de negocio.

---

# MainLayout.vue

Contenedor principal.

Responsabilidades:

* Organizar distribución visual.
* Coordinar mapa y paneles.

---

# TopBar.vue

Responsabilidades:

* Mostrar nombre de aplicación.
* Mostrar usuario.
* Mostrar estado de sincronización.
* Acciones globales.

Los usuarios con rol **Admin** deberán visualizar un acceso al módulo administrativo.

---

# MapView.vue

Componente principal del mapa.

Responsabilidades:

* Inicializar Leaflet.
* Mostrar geometría.
* Gestionar selección de elementos.

No deberá contener lógica de negocio.

---

# Sidebar.vue

Responsabilidades:

* Mostrar información del elemento seleccionado.
* Mostrar formularios de edición.
* Actualizar información de inventario.

---

# Componentes Operativos

## LotDetails.vue

Información del lote seleccionado.

---

## NichoDetails.vue

Información del nicho seleccionado.

---

## InventoryForm.vue

Edición de información operativa.

Campos previstos:

* Estado de venta.
* Estado de ocupación.
* Observaciones.
* Referencia Procap.

---

## SearchBox.vue

Búsqueda de elementos.

---

## SearchResults.vue

Resultados de búsqueda.

---

## FilterPanel.vue

Filtros de búsqueda.

---

## MapLegend.vue

Leyenda del mapa.

---

## LayerControl.vue

Control de capas.

---

## NotificationContainer.vue

Mensajes del sistema.

---

## LoadingOverlay.vue

Pantalla de carga.

---

## ConfirmDialog.vue

Confirmaciones.

---

## ErrorDialog.vue

Errores.

---

# Componentes Administrativos

Accesibles únicamente mediante:

```text
/admin
```

y visibles exclusivamente para usuarios con rol **Admin**.

---

## AdminDashboard.vue

Pantalla principal de herramientas administrativas.

Desde este componente se accederá al resto de herramientas del área de Sistemas.

---

## GeometryEditor.vue

Editor principal de geometría.

Responsabilidades:

* Administrar Secciones.
* Administrar Manzanas.
* Administrar Lotes.
* Administrar Nichos.

Este componente representa la migración del editor geométrico existente en V1.

---

## GeometryToolbar.vue

Barra de herramientas del editor.

Posibles acciones:

* Crear.
* Editar.
* Eliminar.
* Copiar GeoJSON.

---

## GeometryProperties.vue

Editor de propiedades geométricas.

Permitirá modificar información estructural de:

* Sección.
* Manzana.
* Lote.
* Nicho.

---

## GeometryExportPanel.vue

Herramienta para generar el GeoJSON actualizado.

Responsabilidades:

* Validar geometría.
* Generar GeoJSON.
* Copiar GeoJSON al portapapeles.

La publicación en GitHub continuará siendo un proceso manual.

---

## ImportPanel.vue

Herramientas de importación.

---

## ExportPanel.vue

Herramientas de exportación.

---

## DiagnosticsPanel.vue

Diagnóstico de la aplicación.

Información prevista:

* Estado de sincronización.
* Estado de servicios.
* Información técnica.

---

# Principios de Diseño

## Responsabilidad Única

Cada componente deberá tener una única responsabilidad.

---

## Componentes Pequeños

Preferir múltiples componentes especializados sobre componentes monolíticos.

---

## Separación de Responsabilidades

Los componentes no deberán:

* Consultar SharePoint.
* Consultar Microsoft Graph.
* Contener lógica de negocio.

---

## Comunicación

El flujo oficial será:

Componentes

↓

Stores

↓

Services

---

# Regla de Oro

Los componentes representan únicamente la interfaz de usuario.

Toda lógica de negocio, comunicación con sistemas externos y administración del estado deberá realizarse mediante Stores y Services.

Las herramientas administrativas de geometría deberán mantener el flujo operativo utilizado actualmente: edición local, generación de GeoJSON y publicación manual mediante GitHub.
