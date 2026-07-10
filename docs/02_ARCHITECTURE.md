# Mapa Panteón V2

## Architecture

Version: 2.0

Status: Planning

---

# Propósito

Este documento define la arquitectura oficial de Mapa Panteón V2.

Toda funcionalidad nueva deberá respetar los principios y estructuras descritas aquí.

---

# Filosofía Arquitectónica

Mapa Panteón V2 es una **Single Page Application (SPA)** centrada en la administración operativa de lotes.

El mapa funciona como una referencia visual para navegar y administrar información.

La geometría y el inventario son dominios separados.

---

# Objetivos Arquitectónicos

La arquitectura debe proporcionar:

* Mantenibilidad
* Escalabilidad
* Bajo acoplamiento
* Alta cohesión
* Seguridad
* Reutilización
* Integración con Microsoft 365

---

# Arquitectura General

```
                       GitHub Pages
                              │
                              ▼
                        Vue 3 SPA
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
           Components      Stores       Services
                │             │             │
                └──────┬──────┴──────┬──────┘
                       ▼             ▼
                Leaflet Map     Microsoft Graph
                       │             │
                       ▼             ▼
                Geometry Data   SharePoint Lists
```

---

# Dominios del Sistema

La aplicación se divide en dos dominios principales.

---

## Dominio Geométrico

Representa la estructura física del panteón.

Incluye:

* Imagen base
* Secciones
* Manzanas
* Lotes
* Nichos
* Coordenadas
* Capas

Estos datos cambian muy raramente.

Su administración corresponde exclusivamente al área de Sistemas.

---

## Dominio Operativo

Representa la información administrativa.

Incluye:

* Estado
* Propietario
* Observaciones
* Datos administrativos
* Historial futuro

Estos datos cambian constantemente.

SharePoint será la fuente oficial de información.

---

# Regla Fundamental

La geometría nunca deberá almacenar información administrativa.

El inventario nunca deberá almacenar geometría.

La relación entre ambos dominios deberá realizarse mediante identificadores únicos.

---

# Capas Arquitectónicas

---

## UI Layer

Responsabilidad:

Mostrar información al usuario.

Incluye:

* Sidebar
* Toolbar
* Search
* Filters
* Dialogs

No contiene lógica de negocio.

---

## Component Layer

Responsabilidad:

Renderizar componentes reutilizables.

Los componentes:

* Reciben datos.
* Emiten eventos.

No realizan llamadas directas a SharePoint.

---

## Store Layer

Responsabilidad:

Mantener estado global.

Tecnología:

Pinia

Todos los datos compartidos deberán existir aquí.

---

## Service Layer

Responsabilidad:

Comunicación con sistemas externos.

Incluye:

* SharePoint
* Microsoft Graph
* MSAL
* Importaciones
* Exportaciones

---

## Map Layer

Responsabilidad:

Renderizar elementos geográficos mediante Leaflet.

Leaflet no debe contener lógica de negocio.

Leaflet únicamente representa información.

---

## Data Layer

Responsabilidad:

Persistencia y origen de datos.

Fuentes:

### Local

* JSON
* Configuración
* Recursos

### Remoto

* SharePoint Lists
* Microsoft Graph

---

# Flujo de Datos

La dirección oficial del flujo será:

Data Source

↓

Service

↓

Store

↓

Component

↓

Usuario

---

# Flujo de Actualización

Usuario

↓

Formulario

↓

Store

↓

Service

↓

Microsoft Graph

↓

SharePoint

↓

Respuesta

↓

Store

↓

UI

---

# Roles

La arquitectura contempla dos niveles de acceso.

---

## User

Permisos:

* Consultar información.
* Buscar lotes.
* Filtrar información.
* Modificar información operativa autorizada.

No puede modificar geometría.

---

## Admin

Permisos:

* Todas las funciones User.
* Modificar geometría.
* Utilizar herramientas administrativas.
* Importar y exportar datos geométricos.

---

# Sistema de Permisos

La aplicación deberá ocultar herramientas no autorizadas.

La lógica crítica deberá validar permisos antes de ejecutar acciones.

Los permisos nunca deberán depender únicamente de la interfaz.

---

# Stores Oficiales

---

## AuthStore

Responsabilidad:

Autenticación y usuario actual.

Ejemplos:

* user
* role
* token
* permissions

---

## MapStore

Responsabilidad:

Estado del mapa.

Ejemplos:

* zoom
* center
* bounds
* activeLayers

---

## InventoryStore

Responsabilidad:

Inventario operativo.

Ejemplos:

* records
* lastSync
* syncStatus

---

## SelectionStore

Responsabilidad:

Elemento seleccionado.

Ejemplos:

* selectedLot
* selectedBlock
* selectedSection

---

## UIStore

Responsabilidad:

Estado visual.

Ejemplos:

* sidebarOpen
* dialogs
* loading
* notifications

---

# Servicios Oficiales

---

## AuthService

Responsabilidad:

MSAL.

Funciones:

* Login
* Logout
* Token Refresh

---

## GraphService

Responsabilidad:

Comunicación con Microsoft Graph.

---

## InventoryService

Responsabilidad:

Lectura y escritura de inventario.

---

## GeometryService

Responsabilidad:

Carga de geometría.

---

## ImportService

Responsabilidad:

Importación de datos.

---

## ExportService

Responsabilidad:

Exportación de datos.

---

# Sincronización SharePoint

La sincronización será responsabilidad exclusiva de InventoryService.

---

# Estrategia de Sincronización

La aplicación realizará polling periódico.

Objetivos:

* Detectar cambios.
* Evitar recargar información innecesaria.
* Minimizar llamadas a Graph.

---

# Estrategia de Actualización

Nunca deberá reconstruirse el mapa completo.

Únicamente deberán actualizarse los elementos afectados.

Ejemplos:

* Cambio de color.
* Cambio de estado.
* Cambio de información mostrada.

---

# Subsistema Administrativo

Las herramientas de edición geométrica forman un subsistema independiente.

Su acceso estará restringido a administradores.

---

# Tool System

Admin Only

Herramientas previstas:

* Selection Tool
* Section Tool (Secciones)
* Block Tool (Manzanas)
* Lot Tool (Lotes)
* Nicho Tool

---

# Gestión de Errores

Todos los servicios deberán:

* Capturar errores.
* Mostrar mensajes amigables.
* Registrar errores.
* Permitir reintentos.

---

# Dependencias Permitidas

Frontend:

* Vue
* Vite
* Pinia
* Leaflet
* MSAL

Microsoft:

* Microsoft Graph
* SharePoint

Herramientas:

* Python
* OpenPyXL

---

# Dependencias Prohibidas

No forman parte de la arquitectura:

* Express
* ASP.NET
* Django
* Flask
* PHP

No existirán servidores propios.

---

# Regla de Oro

Si una nueva funcionalidad no tiene un lugar claro dentro de esta arquitectura, primero deberá revisarse la arquitectura antes de implementar la funcionalidad.
