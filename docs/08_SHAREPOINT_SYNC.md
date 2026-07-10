# Mapa Panteón V2

## SharePoint Synchronization

Version: 2.0

Status: Planning

---

# Propósito

Este documento define la estrategia oficial de sincronización entre Mapa Panteón V2 y SharePoint.

La sincronización será utilizada para obtener y actualizar información de inventario.

La geometría permanecerá almacenada localmente en archivos GeoJSON.

---

# Principio Fundamental

Separar:

Geometría

↓

Repositorio GitHub

↓

GitHub Pages

**de**

Inventario

↓

SharePoint

↓

Microsoft Graph

---

# Fuente de Verdad

---

## Geometría

Fuente oficial:

Repositorio GitHub.

Archivos:

```text
data/
```

Ejemplos:

```text
secciones.geojson
manzanas.geojson
lotes.geojson
nichos.geojson
```

---

## Inventario

Fuente oficial:

SharePoint List.

---

Ejemplos:

```text
estatus_venta

estatus_ocupacion

observaciones

referencia_procap
```

---

# Arquitectura

Usuario

↓

Vue Components

↓

Pinia Stores

↓

InventoryService

↓

GraphService

↓

Microsoft Graph

↓

SharePoint

---

# Objetivos

Permitir:

* Consulta de inventario.
* Actualización de inventario.
* Refresco automático.
* Trabajo concurrente.

---

# Objetivos NO Incluidos

No se contempla:

* Edición de geometría.
* Creación de GeoJSON.
* Modificación de polígonos.
* Sincronización de mapas.

---

# Estrategia Inicial

La sincronización utilizará Polling.

---

# Motivo

GitHub Pages es un sitio estático.

No existe backend propio.

No existe servidor persistente.

---

# Polling

Definición:

Consultar SharePoint periódicamente.

---

Ejemplo

```text
10:00
Consulta

10:30
Consulta

11:00
Consulta

11:30
Consulta
```

---

# Intervalo Inicial

```text
30 minutos - 1 hora
```

---

Constante:

```javascript
POLLING_INTERVAL
```

---

# Flujo de Carga

Inicio Aplicación

↓

Cargar GeoJSON

↓

Renderizar Mapa

↓

Consultar SharePoint

↓

Actualizar InventoryStore

↓

Aplicación Lista

---

# Sincronización Manual

Debe existir un botón:

```text
Actualizar
```

---

Responsabilidad

Forzar lectura inmediata desde SharePoint.

---

# Sincronización Automática

InventoryService iniciará polling al cargar la aplicación.

---

Flujo

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

# Actualización de Registros

Cuando un usuario modifica un lote:

---

Ejemplo

```text
PLATINO A 001

Disponible

↓

Vendido
```

---

Flujo

Usuario

↓

InventoryForm

↓

InventoryService

↓

GraphService

↓

SharePoint

↓

Respuesta Exitosa

↓

InventoryStore

---

# Confirmación

La interfaz deberá indicar:

```text
Guardando...
```

y posteriormente:

```text
Cambios guardados.
```

---

# Manejo de Errores

Si SharePoint no responde:

---

Mostrar:

```text
No fue posible sincronizar.
```

---

Mantener:

Datos actualmente cargados.

---

No reiniciar:

Mapa

Selección

Filtros

---

# Estrategia de Conflictos

Escenario:

Usuario A

↓

Modifica lote

↓

Guarda

---

Usuario B

↓

Modifica mismo lote

↓

Guarda después

---

Regla Inicial

Last Write Wins.

---

Definición

El último cambio recibido por SharePoint prevalece.

---

Justificación

Simplicidad.

Menor complejidad operativa.

---

# Registro de Sincronización

InventoryStore almacenará:

```javascript
{
    lastSync: null,

    syncStatus: "idle"
}
```

---

Estados

```text
idle

syncing

error
```

---

# Indicador Visual

TopBar deberá mostrar:

---

Sincronizado

```text
Última sincronización:
10:15 AM
```

---

Sincronizando

```text
Sincronizando...
```

---

Error

```text
Error de sincronización
```

---

# Transformación de Datos

SharePoint no deberá consumirse directamente.

---

Flujo

SharePoint

↓

GraphService

↓

InventoryMapper

↓

InventoryRecord

↓

InventoryStore

---

# Beneficio

Aislar cambios futuros.

---

Si SharePoint cambia:

Solo cambia:

```text
InventoryMapper
```

---

No cambia:

Componentes

Stores

Mapa

---

# Caché Local

Permitido:

Geometría

Configuración visual

---

No permitido:

Inventario

Propietarios

Información sensible

Tokens

---

# Futuras Mejoras

Posibles evoluciones:

---

Webhooks

---

Microsoft Change Notifications

---

Azure Functions

---

Backend dedicado

---

Actualización en tiempo real

---

Estas mejoras no deberán requerir cambios en componentes o Stores.

Solo en Services.

---

# Regla de Oro

GitHub Pages seguirá siendo responsable únicamente de servir la aplicación.

SharePoint seguirá siendo responsable únicamente del inventario.

La sincronización entre ambos sistemas deberá realizarse exclusivamente mediante InventoryService y GraphService.
