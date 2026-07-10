# Mapa Panteón V2

## Authentication & Authorization

Version: 2.0

Status: Planning

---

# Propósito

Este documento define la estrategia oficial de autenticación y autorización de Mapa Panteón V2.

---

# Objetivos

Permitir:

* Identificar usuarios.
* Controlar permisos.
* Limitar acceso a funciones administrativas.
* Integrarse con Microsoft 365.

---

# Proveedor de Identidad

Proveedor oficial:

Microsoft Entra ID

(Azure Active Directory)

---

# Método de Inicio de Sesión

Autenticación Microsoft.

---

Flujo

Usuario

↓

Login

↓

Microsoft Entra ID

↓

Aplicación

↓

AuthStore

---

# Fuente de Verdad

La identidad del usuario proviene exclusivamente de Microsoft.

La aplicación no almacenará contraseñas.

---

# Información Mínima

Cada usuario deberá proporcionar:

```javascript
{
    id: "",

    name: "",

    email: ""
}
```

---

# Roles Oficiales

La aplicación utilizará dos roles.

---

## User

Usuario operativo.

---

Permisos:

* Ver mapa.
* Buscar lotes.
* Buscar nichos.
* Consultar inventario.
* Modificar información permitida.
* Actualizar estados permitidos.

---

Restricciones:

* No modificar geometría.
* No importar datos.
* No exportar geometría.
* No acceder a herramientas administrativas.

---

## Admin

Uso exclusivo de Sistemas.

---

Permisos:

* Todas las capacidades User.
* Herramientas administrativas.
* Importaciones.
* Exportaciones.
* Diagnósticos.
* Funciones avanzadas.

---

# Determinación de Rol

Inicialmente:

Lista estática.

---

Ejemplo:

```javascript
const admins = [
    "sistemas@empresa.com",
    "admin@empresa.com"
]
```

---

Si el correo existe:

```javascript
role = "admin"
```

---

En caso contrario:

```javascript
role = "user"
```

---

# Evolución Futura

Opciones futuras:

* Grupo Microsoft 365.
* Grupo Entra ID.
* SharePoint Group.
* App Roles.

---

La arquitectura deberá permitir migrar sin cambios mayores.

---

# AuthStore

Responsabilidad:

Mantener sesión activa.

---

Estado:

```javascript
{
    user: null,

    role: "user",

    isAuthenticated: false
}
```

---

# AuthService

Responsabilidad:

Gestionar autenticación.

---

Funciones:

```javascript
login()

logout()

refreshSession()

getCurrentUser()
```

---

# Sesión

La sesión deberá mantenerse mientras el token sea válido.

---

Si el token expira:

AuthService deberá renovarlo.

---

# Cierre de Sesión

Logout deberá:

* Limpiar AuthStore.
* Limpiar SelectionStore.
* Limpiar información sensible.

---

No deberá:

* Reiniciar geometría.
* Eliminar configuración visual.

---

# Acceso a Funciones

La interfaz deberá ocultar funciones no autorizadas.

---

Ejemplo

Usuario:

```text
Mapa
Búsqueda
Inventario
```

---

Admin:

```text
Mapa
Búsqueda
Inventario

Administración
Importar
Exportar
Diagnóstico
```

---

# Protección de Componentes

Los componentes administrativos deberán validar:

```javascript
role === "admin"
```

---

Ejemplos:

```text
AdminToolbar

GeometryPanel

ImportPanel

ExportPanel
```

---

# Protección de Acciones

La UI no es suficiente.

Los Services también deberán validar permisos cuando corresponda.

---

# Principio de Menor Privilegio

Cada usuario deberá tener únicamente los permisos necesarios para realizar su trabajo.

---

# Auditoría

Versión inicial:

No incluida.

---

Posible mejora futura:

Registrar:

* Usuario
* Fecha
* Acción
* Elemento modificado

---

# Acceso Sin Autenticación

No permitido.

---

Toda interacción con inventario requiere sesión válida.

---

# Comportamiento Offline

No soportado.

La aplicación requiere conectividad para consultar SharePoint.

---

# Regla de Oro

Microsoft Entra ID es la única fuente de identidad.

La aplicación nunca almacenará contraseñas.

Los permisos deberán asignarse mediante roles claramente definidos y fáciles de mantener por el área de Sistemas.
