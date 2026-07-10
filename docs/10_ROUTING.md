# Mapa Panteón V2

## Routing

Version: 2.0

Status: Planning

---

# Propósito

Este documento define la estrategia oficial de navegación de Mapa Panteón V2.

La aplicación será una **Single Page Application (SPA)** construida con **Vue Router**.

---

# Filosofía

La aplicación gira alrededor del mapa.

El mapa es la funcionalidad principal.

Todas las demás funciones complementan la experiencia del mapa.

---

# Principio Fundamental

La aplicación deberá minimizar cambios de pantalla.

La mayoría de las operaciones deberán realizarse dentro de una única interfaz principal.

---

# Autenticación

La aplicación no utilizará una ruta de login independiente.

La autenticación se realizará automáticamente al iniciar la aplicación mediante Microsoft Entra ID.

---

# Flujo de Inicio

Usuario abre aplicación

↓

Verificación de sesión Microsoft

↓

¿Sesión válida?

↓

Sí

↓

Cargar aplicación

---

No

↓

Login Microsoft

↓

Autenticación Exitosa

↓

Cargar aplicación

---

# Determinación de Rol

Una vez autenticado:

```text
AuthService
↓
AuthStore
↓
Role Assignment
```

---

Roles soportados:

```text
user
admin
```

---

# Comportamiento

Tanto usuarios normales como administradores ingresarán inicialmente a:

```text
/
```

---

El rol únicamente determina:

* Permisos disponibles.
* Componentes visibles.
* Acceso a herramientas administrativas.

---

# Ruta Principal

```text
/
```

---

# Propósito

Aplicación principal.

Representa el flujo operativo diario.

---

# Componentes Principales

```text
TopBar

↓

MapView

↓

Sidebar
```

---

# Funciones Disponibles

* Navegación del mapa.
* Consulta de lotes.
* Consulta de nichos.
* Búsqueda.
* Consulta de inventario.
* Actualización de información permitida.

---

# Flujo Principal

Usuario

↓

Mapa

↓

Selecciona elemento

↓

Sidebar

↓

Consulta o edición

↓

Guardar cambios

---

# Ruta Administrativa

```text
/admin
```

---

# Propósito

Herramientas exclusivas del área de Sistemas.

---

# Acceso

Requiere:

```javascript
role === "admin"
```

---

# Funciones Previstas

* Diagnósticos.
* Importaciones.
* Exportaciones.
* Herramientas de soporte.
* Utilidades administrativas.

---

# Usuario Sin Permiso

Si un usuario normal intenta acceder:

```text
/admin
```

deberá ser redirigido a:

```text
/
```

---

# Ruta Diagnósticos

```text
/admin/diagnostics
```

---

# Propósito

Visualizar:

* Estado de sincronización.
* Estado de servicios.
* Información técnica.
* Información de sesión.

---

# Acceso

Solo administradores.

---

# Ruta Importación

```text
/admin/import
```

---

# Propósito

Herramientas de importación.

---

Posibles funciones:

* Importar GeoJSON.
* Importar datos auxiliares.
* Herramientas de migración.

---

# Acceso

Solo administradores.

---

# Ruta Exportación

```text
/admin/export
```

---

# Propósito

Herramientas de exportación.

---

Posibles funciones:

* Exportar inventario.
* Exportar geometría.
* Exportar diagnósticos.

---

# Acceso

Solo administradores.

---

# Ruta No Encontrada

```text
*
```

---

# Comportamiento

Mostrar:

```text
404
Página no encontrada
```

---

Permitir regresar a:

```text
/
```

---

# Navegación Principal

```text
/
│
├── Mapa
├── Sidebar
├── Inventario
└── Búsqueda

/admin
│
├── Diagnósticos
├── Importaciones
└── Exportaciones
```

---

# Deep Linking

La aplicación deberá permitir abrir elementos específicos mediante URL.

---

# Lote

```text
/#/?lot=PLATINO-A-001
```

---

# Nicho

```text
/#/?nicho=SPN-CONCAVO-A1
```

---

# Comportamiento

La aplicación deberá:

1. Abrir mapa.
2. Localizar elemento.
3. Seleccionarlo.
4. Abrir Sidebar.
5. Mostrar información relacionada.

---

# Beneficios

Permite:

* Compartir referencias.
* Soporte remoto.
* Acceso rápido a elementos específicos.

---

# Protección de Rutas

Todas las rutas administrativas deberán utilizar Route Guards.

---

Flujo:

Ruta solicitada

↓

Validar autenticación

↓

Validar rol

↓

Permitir acceso

---

# Datos Permitidos en URL

Permitido:

* IDs de lotes.
* IDs de nichos.
* Parámetros de búsqueda.

---

No permitido:

* Tokens.
* Correos electrónicos.
* Información sensible.
* Datos provenientes de SharePoint.

---

# Estrategia GitHub Pages

Debido a que la aplicación se desplegará en GitHub Pages:

Se utilizará:

```javascript
createWebHashHistory()
```

---

Ejemplos:

```text
/#/

/#/admin

/#/admin/diagnostics
```

---

# Justificación

GitHub Pages es un servicio de hosting estático.

Hash Routing evita errores de recarga y rutas inexistentes.

---

# Evolución Futura

Si en algún momento existe un backend propio:

Podrá migrarse a:

```javascript
createWebHistory()
```

sin modificar componentes, stores o servicios.

---

# Regla de Oro

Todos los usuarios ingresan al mapa.

Las herramientas administrativas son funciones complementarias exclusivas para Sistemas.

La navegación deberá mantener al usuario dentro del flujo principal de trabajo la mayor parte del tiempo.
