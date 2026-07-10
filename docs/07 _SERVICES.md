# Mapa Panteón V2

## Services

Version: 2.0

Status: Planning

---

# Propósito

Este documento define los servicios oficiales de la aplicación.

Los Services son responsables de toda comunicación con sistemas externos.

---

# Filosofía

Los Services son la única capa autorizada para:

* Leer datos externos.
* Escribir datos externos.
* Procesar respuestas.
* Transformar datos.
* Gestionar autenticación.

---

# Regla Fundamental

Los componentes nunca deberán comunicarse directamente con:

* SharePoint
* Microsoft Graph
* MSAL
* Archivos GeoJSON

Toda comunicación deberá pasar por un Service.

---

# Arquitectura

Component

↓

Store

↓

Service

↓

Sistema Externo

---

# Servicios Oficiales

```text id="6v0knl"
AuthService
GraphService
GeometryService
InventoryService
ImportService
ExportService
```

---

# AuthService

Responsabilidad:

Autenticación Microsoft.

---

## Funciones

```javascript id="y1wdaf"
login()

logout()

getCurrentUser()

refreshToken()

isAuthenticated()
```

---

# Flujo

Usuario

↓

Login

↓

MSAL

↓

Microsoft Entra ID

↓

AuthStore

---

# Reglas

AuthService es el único lugar autorizado para trabajar con MSAL.

---

# GraphService

Responsabilidad:

Comunicación con Microsoft Graph.

---

## Funciones

```javascript id="fr1o6v"
get()

post()

patch()

delete()

batch()
```

---

## Objetivo

Centralizar todas las llamadas Graph.

---

Incorrecto

```javascript id="jlwmiv"
fetch(graphUrl)
```

en componentes.

---

Correcto

```javascript id="6a2ndx"
GraphService.get(...)
```

---

# GeometryService

Responsabilidad:

Carga y administración de geometría.

---

# Fuente de Datos

GeoJSON

JSON

Recursos locales

---

## Funciones

```javascript id="3laxio"
loadSections()

loadBlocks()

loadLots()

loadNichos()

buildCanonicalId()
```

---

# buildCanonicalId()

Genera identificadores oficiales.

---

Ejemplo

```text id="vxy4iu"
PLATINO
A
001
```

↓

```text id="ojzvlp"
PLATINO-A-001
```

---

# Reglas

GeometryService nunca consulta SharePoint.

GeometryService nunca modifica inventario.

---

# InventoryService

Responsabilidad:

Administrar inventario operativo.

---

# Fuente Oficial

SharePoint Lists

---

# Funciones

```javascript id="9t7j74"
loadInventory()

getRecord()

updateRecord()

syncChanges()

startPolling()

stopPolling()
```

---

# loadInventory()

Obtiene registros desde SharePoint.

---

# updateRecord()

Actualiza información.

Ejemplo:

```javascript id="5fw5zn"
saleStatus

occupancyStatus

observations
```

---

# syncChanges()

Envía cambios pendientes.

---

# Polling

Responsabilidad:

Mantener sincronización con SharePoint.

---

# Estrategia Inicial

Polling cada:

```text id="avq7my"
30 minutos - 1 hora
```

---

# Configurable

```javascript id="7xyrm7"
POLLING_INTERVAL
```

---

# Flujo

Timer

↓

InventoryService

↓

GraphService

↓

SharePoint

↓

InventoryStore

---

# Reglas

InventoryService es el único servicio autorizado para modificar inventario.

---

# ImportService

Admin Only

---

Responsabilidad:

Importar datos.

---

## Funciones

```javascript id="2r2fkk"
importGeoJSON()

validateGeometry()

importInventory()
```

---

# Casos de Uso

Carga masiva.

Migraciones.

Herramientas internas.

---

# ExportService

Admin Only

---

Responsabilidad:

Exportar información.

---

## Funciones

```javascript id="w65qvy"
exportGeoJSON()

exportJSON()

exportInventory()
```

---

# Mappers

Los Services pueden utilizar mappers internos.

---

Ejemplo

```text id="tz6dbx"
SharePoint
↓
Mapper
↓
InventoryRecord
```

---

# InventoryMapper

Responsabilidad:

Convertir SharePoint a modelos internos.

---

Ejemplo

Entrada:

```javascript id="k9fw2y"
{
    estatus_venta: "Vendido"
}
```

---

Salida:

```javascript id="p0lfte"
{
    saleStatus: "Vendido"
}
```

---

# Validadores

Los Services pueden utilizar validadores.

---

Ejemplo

```text id="e89yrv"
InventoryValidator
```

---

Responsabilidades:

* Campos requeridos.
* Formatos válidos.
* Reglas de negocio.

---

# Gestión de Errores

Todos los Services deberán:

* Capturar errores.
* Registrar errores.
* Lanzar errores controlados.
* Proporcionar mensajes útiles.

---

Incorrecto

```javascript id="mwnn0q"
throw error
```

---

Correcto

```javascript id="cbb2b3"
throw new Error(
  "No fue posible actualizar SharePoint."
)
```

---

# Cache Local

Permitido únicamente para:

* Geometría.
* Configuración.

---

No almacenar:

* Inventario.
* Tokens.
* Información sensible.

---

# Dependencias Permitidas

AuthService

↓

MSAL

---

GraphService

↓

Microsoft Graph

---

GeometryService

↓

GeoJSON

---

InventoryService

↓

GraphService

---

# Dependencias Prohibidas

---

Incorrecto

```text id="18zm31"
Component
↓
GraphService
```

---

Incorrecto

```text id="rnn5gr"
Component
↓
SharePoint
```

---

Incorrecto

```text id="if3a4y"
MapView
↓
Graph API
```

---

Correcto

```text id="8ksxco"
Component
↓
Store
↓
Service
↓
Graph
```

---

# Futuras Extensiones

Posibles servicios futuros:

```text id="9g51qf"
AuditService

ReportService

NotificationService

AnalyticsService
```

---

# Regla de Oro

Si un componente necesita leer o escribir información fuera de la aplicación, esa operación debe realizarse mediante un Service.

Si una integración externa requiere lógica especializada, deberá implementarse como un Service independiente y no dentro de componentes o Stores.
