# Mapa Panteón V2

## Stores

Version: 2.0

Status: Planning

---

# Propósito

Este documento define los Stores oficiales de la aplicación.

Mapa Panteón V2 utilizará **Pinia** como sistema centralizado de estado.

Todos los datos compartidos deberán administrarse mediante Stores.

---

# Filosofía

Los Stores tienen una única responsabilidad:

Mantener estado global.

Los Stores **NO** son responsables de:

* Consultar SharePoint
* Consultar Microsoft Graph
* Leer archivos
* Renderizar Leaflet

**---->Esas responsabilidades pertenecen a Services.<----**

---

# Flujo Oficial

Service

↓

Store

↓

Component

↓

Usuario

---

# Stores Oficiales

La aplicación utilizará cinco Stores principales.

```text
AuthStore
MapStore
InventoryStore
SelectionStore
UIStore
```

---

# AuthStore

Responsabilidad:

Gestionar autenticación y permisos.

---

## Estado

```javascript
{
    user: null,

    role: "user",

    permissions: [],

    accessToken: null,

    isAuthenticated: false
}
```

---

## User

Información básica del usuario.

```javascript
{
    id: "",

    name: "",

    email: ""
}
```

---

## Getters

```javascript
isAdmin

isUser

userName

userEmail
```

---

## Actions

```javascript
setUser()

setRole()

logout()

clearSession()
```

---

# Reglas

AuthStore nunca consulta Microsoft Graph directamente.

Toda autenticación debe realizarse mediante AuthService.

---

# MapStore

Responsabilidad:

Estado visual del mapa.

---

## Estado

```javascript
{
    zoom: 0,

    center: [],

    bounds: null,

    activeLayers: [],

    selectedLayer: null
}
```

---

## Getters

```javascript
currentZoom

activeLayerCount
```

---

## Actions

```javascript
setZoom()

setCenter()

toggleLayer()

resetView()
```

---

# Reglas

MapStore no contiene geometría.

MapStore únicamente contiene estado visual.

---

Incorrecto:

```javascript
{
    lots: [...]
}
```

---

Correcto:

```javascript
{
    zoom: 18
}
```

---

# InventoryStore

Responsabilidad:

Mantener inventario operativo.

---

## Estado

```javascript
{
    records: {},

    lastSync: null,

    syncStatus: "idle",

    pendingChanges: []
}
```

---

# records

Almacena inventario indexado por ID.

Ejemplo:

```javascript
{
    "PLATINO-A-001": {

        referenceId: "PLATINO-A-001",

        saleStatus: "Vendido",

        occupancyStatus: "Libre"
    }
}
```

---

# syncStatus

Valores permitidos:

```javascript
idle

syncing

error
```

---

# pendingChanges

Cambios aún no sincronizados.

Ejemplo:

```javascript
[
    {
        referenceId: "PLATINO-A-001",

        field: "saleStatus",

        value: "Vendido"
    }
]
```

---

## Getters

```javascript
getRecordById()

hasPendingChanges()

syncStatusLabel
```

---

## Actions

```javascript
setRecords()

updateRecord()

addPendingChange()

clearPendingChanges()

setSyncStatus()
```

---

# Reglas

InventoryStore no conoce SharePoint.

InventoryStore solo administra estado.

---

# SelectionStore

Responsabilidad:

Mantener selección activa.

---

## Estado

```javascript
{
    selectedId: null,

    selectedType: null,

    selectedGeometry: null
}
```

---

## selectedType

Valores:

```javascript
lot

nicho
```

---

## Getters

```javascript
hasSelection

selectedRecord
```

---

## Actions

```javascript
select()

clearSelection()
```

---

# Flujo de Selección

Usuario

↓

Click lote

↓

SelectionStore.select()

↓

Sidebar actualiza

↓

InventoryForm actualiza

---

# UIStore

Responsabilidad:

Estado visual global.

---

## Estado

```javascript
{
    loading: false,

    loadingMessage: "",

    notifications: [],

    dialogs: {}
}
```

---

# Loading

Ejemplos:

```javascript
{
    loading: true,

    loadingMessage: "Sincronizando SharePoint..."
}
```

---

# Notifications

Ejemplo:

```javascript
[
    {
        type: "success",

        message: "Cambios guardados."
    }
]
```

---

# Dialogs

Ejemplo:

```javascript
{
    confirmSave: false,

    errorDialog: false
}
```

---

## Actions

```javascript
showLoading()

hideLoading()

showNotification()

closeNotification()

openDialog()

closeDialog()
```

---

# Comunicación Entre Stores

Los Stores deben mantenerse desacoplados.

---

Correcto:

```text
Component
↓
InventoryStore
```

---

Incorrecto:

```text
InventoryStore
↓
MapStore
↓
AuthStore
↓
SelectionStore
```

---

# Store Ownership

Cada dato tiene un único dueño.

---

Usuario

```text
AuthStore
```

---

Zoom

```text
MapStore
```

---

Inventario

```text
InventoryStore
```

---

Selección

```text
SelectionStore
```

---

Diálogos

```text
UIStore
```

---

# Persistencia

Por defecto:

Ningún Store deberá persistirse automáticamente.

---

Excepciones futuras

Podrán persistirse:

```javascript
zoom

center

activeLayers
```

mediante LocalStorage.

---

# Datos Prohibidos

No almacenar:

* Objetos Leaflet completos
* Tokens expirados
* Archivos
* Respuestas completas de Graph

---

Incorrecto:

```javascript
{
    graphResponse: {...}
}
```

---

Correcto:

```javascript
{
    saleStatus: "Vendido"
}
```

---

# Relación con Services

Los Services actualizan Stores.

Los Stores nunca llaman APIs directamente.

---

Ejemplo Correcto

InventoryService

↓

InventoryStore.setRecords()

↓

UI

---

# Regla de Oro

Si un dato **debe ser compartido por múltiples componentes**, probablemente pertenece a un Store.

Si un dato **proviene de SharePoint, Microsoft Graph o un archivo externo**, probablemente **debe pasar primero por un Service** antes de llegar al Store.
