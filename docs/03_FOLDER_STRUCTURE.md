# Mapa Panteón V2

## Folder Structure

Version: 2.0

Status: Planning

---

# Propósito

Este documento define la estructura oficial de carpetas del proyecto.

Toda nueva funcionalidad deberá integrarse respetando esta organización.

El objetivo es:

* Facilitar mantenimiento.
* Separar responsabilidades.
* Reducir dependencias innecesarias.
* Permitir crecimiento futuro.

---

# Principio Fundamental

La aplicación contiene dos dominios completamente distintos.

## Dominio Operativo

Información administrativa.

Ejemplos:

* Estado
* Propietario
* Observaciones
* Inventario
* SharePoint

---

## Dominio Geométrico

Información cartográfica.

Ejemplos:

* Secciones
* Manzanas
* Lotes
* Nichos
* Coordenadas

---

# Estructura General

```text
src/

├── assets/
├── components/
├── composables/
├── config/
├── domains/
├── services/
├── stores/
├── router/
├── utils/
├── types/

├── App.vue
└── main.js
```

---

# assets/

Recursos estáticos.

```text
assets/

├── images/
├── icons/
├── fonts/
└── styles/
```

Ejemplos:

* logos
* iconografía
* estilos globales
* imágenes auxiliares

---

# components/

Componentes Vue reutilizables.

Los componentes NO contienen lógica de negocio.

```text
components/

├── common/
├── layout/
├── map/
├── sidebar/
├── search/
├── filters/
├── inventory/
├── admin/
└── dialogs/
```

---

# components/common/

Componentes genéricos.

Ejemplos:

```text
Button.vue
Modal.vue
Loading.vue
Notification.vue
```

---

# components/layout/

Elementos principales de interfaz.

Ejemplos:

```text
MainLayout.vue
TopBar.vue
Footer.vue
```

---

# components/map/

Elementos visuales relacionados con el mapa.

Ejemplos:

```text
MapView.vue
MapLegend.vue
LayerControl.vue
```

---

# components/sidebar/

Información contextual.

Ejemplos:

```text
Sidebar.vue
LotDetails.vue
SelectionInfo.vue
```

---

# components/search/

Búsquedas.

Ejemplos:

```text
SearchBox.vue
SearchResults.vue
```

---

# components/filters/

Filtros operativos.

Ejemplos:

```text
StatusFilter.vue
SectionFilter.vue
```

---

# components/inventory/

Edición de información operativa.

Ejemplos:

```text
InventoryForm.vue
StatusEditor.vue
OwnerEditor.vue
NotesEditor.vue
```

---

# components/admin/

Herramientas exclusivas de Sistemas.

Ejemplos:

```text
AdminToolbar.vue
GeometryPanel.vue
ImportPanel.vue
ExportPanel.vue
```

---

# components/dialogs/

Ventanas modales.

Ejemplos:

```text
ConfirmDialog.vue
ErrorDialog.vue
LoginDialog.vue
```

---

# composables/

Lógica reutilizable de Vue.

Todo composable deberá comenzar con "use".

```text
composables/

useMap.js
useSelection.js
useSearch.js
usePermissions.js
useInventory.js
```

---

# config/

Configuración global.

```text
config/

colors.js
map.js
layers.js
constants.js
permissions.js
```

---

# domains/

Contiene la lógica específica de cada dominio.

```text
domains/

├── geometry/
└── inventory/
```

---

# domains/geometry/

Responsable del dominio cartográfico.

```text
geometry/

├── renderers/
├── tools/
├── managers/
└── models/
```

---

# geometry/renderers/

Dibujo de elementos Leaflet.

```text
SectionRenderer.js
BlockRenderer.js
LotRenderer.js
NichoRenderer.js
```

Los renderers únicamente dibujan.

No toman decisiones.

---

# geometry/tools/

Herramientas administrativas.

Admin Only.

```text
SelectionTool.js
SectionTool.js
BlockTool.js
LotTool.js
NichoTool.js
```

---

# geometry/managers/

Coordinadores internos.

```text
ToolManager.js
LayerManager.js
EventManager.js
```

---

# geometry/models/

Modelos geométricos.

```text
Section.js
Block.js
Lot.js
Nicho.js
```

---

# domains/inventory/

Responsable del dominio operativo.

```text
inventory/

├── models/
├── mappers/
└── validators/
```

---

# inventory/models/

Modelos operativos.

```text
InventoryRecord.js
Owner.js
Status.js
```

---

# inventory/mappers/

Conversión de SharePoint a modelos internos.

```text
InventoryMapper.js
```

---

# inventory/validators/

Validación de información.

```text
InventoryValidator.js
```

---

# services/

Comunicación con sistemas externos.

```text
services/

AuthService.js
GraphService.js
InventoryService.js
GeometryService.js
ImportService.js
ExportService.js
```

---

# AuthService

Responsable de:

* Login
* Logout
* Token Refresh

---

# GraphService

Responsable de:

* Microsoft Graph

---

# InventoryService

Responsable de:

* Lectura SharePoint
* Escritura SharePoint
* Polling
* Sincronización

---

# GeometryService

Responsable de:

* Carga de geometría
* Exportación de geometría

---

# stores/

Estado global Pinia.

```text
stores/

auth.js
map.js
inventory.js
selection.js
ui.js
```

---

# auth.js

Estado de autenticación.

Ejemplos:

```text
user
role
permissions
token
```

---

# map.js

Estado del mapa.

Ejemplos:

```text
zoom
center
bounds
activeLayers
```

---

# inventory.js

Estado operativo.

Ejemplos:

```text
records
lastSync
syncStatus
```

---

# selection.js

Elemento seleccionado.

Ejemplos:

```text
selectedLot
selectedBlock
selectedSection
```

---

# ui.js

Estado visual.

Ejemplos:

```text
sidebar
loading
dialogs
notifications
```

---

# router/

La aplicación utilizará pocas rutas.

El mapa será persistente.

```text
router/

index.js
```

Rutas previstas:

```text
/
/admin
```

---

# types/

Modelos compartidos.

Preparado para futura migración a TypeScript.

```text
types/

User.js
Permission.js
Role.js
```

---

# utils/

Funciones puras.

No dependen de Vue.

No dependen de Pinia.

No dependen de Leaflet.

```text
utils/

geometry.js
coordinates.js
colors.js
validators.js
helpers.js
```

---

# docs/

Documentación oficial del proyecto.

```text
docs/

00_PROJECT_OVERVIEW.md
01_FEATURES.md
02_ARCHITECTURE.md
03_FOLDER_STRUCTURE.md
04_DATA_MODEL.md
05_COMPONENTS.md
06_STORES.md
07_SERVICES.md
08_SHAREPOINT_SYNC.md
09_ADMIN_TOOLS.md
10_SECURITY.md
11_ROADMAP.md
12_CODING_GUIDELINES.md
```

---

# Convenciones

## Componentes Vue

PascalCase

Ejemplo:

```text
MapView.vue
InventoryForm.vue
AdminToolbar.vue
```

---

## Servicios

PascalCase

Ejemplo:

```text
InventoryService.js
GraphService.js
```

---

## Stores

camelCase

Ejemplo:

```text
inventory.js
selection.js
auth.js
```

---

## Composables

Prefijo obligatorio:

```text
use
```

Ejemplos:

```text
useMap.js
useInventory.js
```

---

# Regla de Oro

Si un archivo no tiene una ubicación clara dentro de esta estructura, probablemente existe un problema de arquitectura que debe resolverse antes de continuar desarrollando.
