# Mapa Panteón V2

## Data Model

Version: 2.0

Status: Planning

---

# Propósito

Este documento define los modelos de datos oficiales de Mapa Panteón V2.

Todos los componentes, stores, servicios y sincronizaciones deberán utilizar estas estructuras.

---

# Filosofía

La aplicación se divide en dos dominios principales.

---

## Geometría

Describe dónde está algo.

Ejemplos:

* Secciones
* Manzanas
* Lotes
* Nichos
* Coordenadas

---

## Inventario

Describe qué información tiene algo.

Ejemplos:

* Estado
* Propietario
* Observaciones
* Información administrativa

---

# Regla Fundamental

La geometría no contiene información operativa.

El inventario no contiene coordenadas.

Ambos dominios se relacionan mediante identificadores únicos.

---

# Enumeraciones

---

## ElementType

```javascript
{
    LOT: "lot",
    NICHO: "nicho"
}
```

---

## UserRole

```javascript
{
    USER: "user",
    ADMIN: "admin"
}
```

---

## SyncStatus

```javascript
{
    IDLE: "idle",
    SYNCING: "syncing",
    ERROR: "error"
}
```

---

# Modelo Base

Todos los elementos del sistema comparten una estructura mínima.

```javascript
{
    id: "",
    type: "",
    displayName: ""
}
```

---

# Modelo Geométrico

---

## Section

Representa una sección completa.

Ejemplo:

```text
PLATINO
BRONCE
ORO
SJV
SPV
SMP
```

---

Estructura:

```javascript
{
    id: "PLATINO",

    name: "PLATINO",

    blocks: []
}
```

---

## Block

Representa una manzana.

Ejemplo:

```text
A
B
C
D
```

---

Estructura:

```javascript
{
    id: "PLATINO-A",

    sectionId: "PLATINO",

    name: "A",

    lots: []
}
```

---

## LotGeometry

Representa un lote dentro del mapa.

---

Ejemplo:

```text
PLATINO A 001
```

---

Estructura:

```javascript
{
    id: "PLATINO-A-001",

    type: "lot",

    section: "PLATINO",

    block: "A",

    lotNumber: "001",

    displayName: "PLATINO A 001",

    geometry: {},

    properties: {}
}
```

---

# Identificador Oficial de Lote

Formato:

```text
SECCION-MANZANA-CODIGO
```

Ejemplos:

```text
PLATINO-A-001
BRONCE-G-301
ORO-C-145
```

---

# Modelo Nicho

Los nichos siguen una estructura diferente.

---

Ejemplos:

```text
SPN CONCAVO A1
SPN CONVEXO B2
```

---

Estructura:

```javascript
{
    id: "SPN-CONCAVO-A1",

    type: "nicho",

    zoneId: "SPN",

    face: "CONCAVO",

    code: "A1",

    displayName: "SPN CONCAVO A1",

    geometry: {}
}
```

---

# Identificador Oficial de Nicho

Formato:

```text
ZONA-CARA-CODIGO
```

Ejemplos:

```text
SPN-CONCAVO-A1
SPN-CONVEXO-B3
```

---

# Inventario

Información administrativa.

Fuente oficial:

SharePoint.

---

## InventoryRecord

Modelo principal de inventario.

---

Estructura:

```javascript
{
    id: "",

    referenceId: "",

    type: "",

    saleStatus: "",

    occupancyStatus: "",

    owner: "",

    observations: "",

    referenceProcap: "",

    lastUpdated: null
}
```

---

# referenceId

Llave que conecta:

```text
Mapa
↔
Pinia
↔
SharePoint
↔
Microsoft Graph
```

---

Ejemplo:

```text
PLATINO-A-001
```

---

# referenceProcap

Representación utilizada por sistemas externos.

Ejemplo:

```text
PLATINO - 001 - A
```

---

# Sale Status

Corresponde a:

```text
estatus_venta
```

---

Ejemplos:

```text
Disponible
Vendido
Separado
Suspendido
```

---

# Occupancy Status

Corresponde a:

```text
estatus_ocupacion
```

---

Ejemplos:

```text
Libre
Utilizado
Ocupado
```

---

# Servicios Especiales

Utilizado principalmente por nichos.

---

## ServiceType

```javascript
{
    TS: "TS",
    TSC: "TSC"
}
```

---

Descripción:

```text
TS  = Total Service

TSC = Total Service Complemento
```

---

# Modelo Usuario

---

## User

```javascript
{
    id: "",

    name: "",

    email: "",

    role: "user",

    permissions: []
}
```

---

# Modelo Permiso

```javascript
{
    id: "",

    name: "",

    description: ""
}
```

---

# Modelo Selección

Representa el elemento actualmente seleccionado.

---

```javascript
{
    selectedId: "",

    selectedType: "",

    selectedRecord: null
}
```

---

# Modelo Mapa

Estado general del mapa.

---

```javascript
{
    zoom: 0,

    center: [],

    activeLayers: []
}
```

---

# Modelo Sincronización

Estado de SharePoint.

---

```javascript
{
    status: "idle",

    lastSync: null,

    lastError: null
}
```

---

# Relación Entre Dominios

La unión oficial será:

```text
LotGeometry.id
        │
        ▼
InventoryRecord.referenceId
```

---

Ejemplo:

```text
PLATINO-A-001
```

↓

```text
GeoJSON
```

↓

```text
Inventory Record
```

↓

```text
Sidebar
```

↓

```text
Mapa
```

---

# Regla de Oro

Ningún componente deberá depender directamente de SharePoint.

Ningún renderer deberá contener lógica de inventario.

Ningún registro de inventario deberá almacenar geometría.

Toda relación entre dominios deberá realizarse mediante identificadores oficiales definidos en este documento.
