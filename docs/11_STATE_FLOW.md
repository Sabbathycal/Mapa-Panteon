# Mapa Panteón V2

## State Flow

Version: 2.0

Status: Planning

---

# Propósito

Este documento define el flujo oficial de datos y estados dentro de la aplicación.

Describe cómo se mueve la información entre:

* Componentes
* Stores
* Services
* SharePoint
* Editor Geométrico

---

# Principio Fundamental

El flujo de información deberá ser predecible.

Todos los cambios deberán seguir una ruta conocida y documentada.

---

# Flujo General

```text
Usuario
↓
Componente
↓
Store
↓
Service
↓
Sistema Externo
↓
Store
↓
Componente
```

---

# Regla Principal

Los componentes nunca deberán modificar directamente:

* SharePoint
* Microsoft Graph
* Otros componentes

Toda modificación deberá pasar por:

```text
Store
↓
Service
```

---

# Inicio de Aplicación

```text
Usuario abre aplicación
↓
AuthService
↓
Validar sesión Microsoft
↓
AuthStore
↓
Cargar geometría
↓
GeometryStore
↓
Cargar inventario
↓
InventoryStore
↓
Renderizar aplicación
```

---

# Selección de Lote

```text
MapView
↓
SelectionStore
↓
Sidebar
```

Resultado:

* Sidebar actualiza automáticamente.
* Se carga la información del inventario.

---

# Selección de Nicho

```text
MapView
↓
SelectionStore
↓
Sidebar
```

Resultado:

* Sidebar actualiza automáticamente.
* Se carga la información del inventario.

---

# Búsqueda

```text
SearchBox
↓
SelectionStore
↓
MapView
↓
Sidebar
```

Resultado:

* Centrar mapa.
* Seleccionar elemento.
* Mostrar información.

---

# Actualización de Inventario

Ejemplo:

Disponible

↓

Vendido

Flujo:

```text
InventoryForm
↓
InventoryStore
↓
InventoryService
↓
GraphService
↓
SharePoint
↓
InventoryStore
↓
Sidebar
```

---

# Sincronización Automática

```text
Timer
↓
InventoryService
↓
GraphService
↓
SharePoint
↓
InventoryStore
```

---

# Sincronización Manual

```text
Botón Actualizar
↓
InventoryService
↓
GraphService
↓
SharePoint
↓
InventoryStore
```

---

# Error de Sincronización

```text
InventoryService
↓
Error
↓
InventoryStore
↓
UIStore
↓
Notificación
```

La aplicación deberá mantener:

* Geometría.
* Selección.
* Inventario previamente descargado.

---

# Administración de Geometría

Este flujo es exclusivo para usuarios con rol **Admin**.

---

## Crear / Editar / Eliminar

```text
Admin
↓
GeometryEditor
↓
GeometryStore
↓
Actualizar geometría local
```

Los cambios únicamente existirán durante la sesión del navegador hasta ser exportados.

---

# Exportación de Geometría

```text
Admin
↓
GeometryExportPanel
↓
GeometryService
↓
Generar GeoJSON
↓
Copiar al portapapeles
```

---

# Publicación

La publicación **no forma parte de la aplicación**.

El flujo oficial será:

```text
Copiar GeoJSON
↓
Repositorio GitHub
↓
Commit
↓
GitHub Pages
```

Este proceso continuará siendo manual.

---

# Cierre de Sesión

```text
AuthService
↓
AuthStore
↓
SelectionStore
↓
InventoryStore
↓
GeometryStore
```

Resultado:

* Limpiar sesión.
* Limpiar selección.
* Limpiar inventario.
* Descartar cambios geométricos no exportados.

---

# Flujo Permitido

```text
Component
↓
Store
↓
Service
↓
Sistema Externo
```

---

# Flujos Prohibidos

```text
Component
↓
SharePoint
```

```text
Component
↓
Graph API
```

```text
Store
↓
SharePoint
```

```text
Store
↓
Graph API
```

---

# Regla de Oro

El inventario y la geometría son dominios independientes.

El inventario se sincroniza con SharePoint mediante Services.

La geometría se administra localmente por el área de Sistemas y únicamente se publica mediante la generación manual de archivos GeoJSON para su posterior despliegue en GitHub Pages.
