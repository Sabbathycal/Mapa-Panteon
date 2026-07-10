# Mapa Panteón V2

## Deployment

Version: 2.0

Status: Planning

---

# Propósito

Este documento define el proceso oficial de desarrollo, compilación, publicación y despliegue de Mapa Panteón V2.

El objetivo es garantizar un proceso seguro que permita desarrollar nuevas funcionalidades sin afectar la versión estable utilizada por la empresa.

---

# Arquitectura de Despliegue

Mapa Panteón V2 es una Single Page Application (SPA) desarrollada con:

* Vue
* Vite
* GitHub Pages

La aplicación no requiere un servidor propio.

---

# Infraestructura

Frontend

↓

GitHub Pages

---

Inventario

↓

SharePoint

↓

Microsoft Graph

---

Autenticación

↓

Microsoft Entra ID

---

# Estrategia de Repositorios

Actualmente existen tres ramas de trabajo distribuidas entre el repositorio oficial y un Fork personal.

---

## 1. Repositorio Oficial

```text
main
```

Contiene:

* V1 estable.
* Código actualmente utilizado por la empresa.

Esta rama representa producción.

No deberá utilizarse para el desarrollo de V2.

---

## 2. Fork Personal

```text
main
```

Utilizado para:

* Correcciones a V1.
* Mejoras menores.
* Pull Requests hacia el repositorio oficial.

Su objetivo es mantener una copia sincronizada con la versión estable.

---

## 3. Fork Personal

```text
V2
```

Rama exclusiva para el desarrollo de Mapa Panteón V2.

Aquí se desarrollarán:

* Nueva arquitectura.
* Migración a Vue.
* Integración con SharePoint.
* Nuevas funcionalidades.

Los cambios realizados en esta rama no afectan V1.

---

# Justificación

Esta estrategia permite:

* Proteger la versión utilizada por la empresa.
* Mantener un entorno seguro para experimentación.
* Facilitar Pull Requests independientes.
* Reducir el riesgo de afectar producción.

---

# Flujo de Desarrollo

Desarrollo

↓

Fork

↓

Branch V2

↓

Pruebas

↓

Revisión

↓

Integración futura con el repositorio oficial

---

# Build

Antes de realizar pruebas de despliegue deberá ejecutarse:

```bash
npm install

npm run build
```

El resultado se generará en:

```text
dist/
```

---

# Publicación

Durante el desarrollo de V2, los despliegues podrán realizarse desde el Fork para validar funcionamiento.

La versión oficial utilizada por la empresa continuará siendo V1 hasta que V2 sea aprobada para producción.

---

# Geometría

La geometría permanecerá almacenada como archivos GeoJSON dentro del repositorio Git.

---

# Actualización de Geometría

El flujo oficial continuará siendo:

Editar geometría

↓

Generar GeoJSON actualizado

↓

Copiar GeoJSON

↓

Actualizar archivo correspondiente

↓

Commit

↓

Push

↓

Despliegue mediante GitHub Pages

Este proceso mantiene compatibilidad con la metodología utilizada actualmente en V1.

---

# Inventario

El inventario permanecerá completamente separado del proceso de despliegue.

Toda la información operativa continuará almacenándose en SharePoint.

No será necesario publicar una nueva versión para reflejar cambios de inventario.

---

# Configuración

Toda configuración sensible deberá mantenerse fuera del código fuente siempre que sea posible.

Ejemplos:

* Tenant ID
* Client ID
* Microsoft Graph URL
* Polling Interval

---

# Lista de Verificación Antes del Despliegue

* El proyecto compila correctamente.
* No existen errores de lint.
* La autenticación funciona.
* El mapa carga correctamente.
* SharePoint responde correctamente.
* Los GeoJSON son válidos.

---

# Lista de Verificación Después del Despliegue

Verificar:

* Inicio de sesión.
* Navegación del mapa.
* Consulta de inventario.
* Actualización de estados.
* Sincronización con SharePoint.
* Herramientas administrativas.

---

# Rollback

Si una versión presenta errores críticos:

1. Revertir el Commit correspondiente.
2. Restaurar la última versión estable.
3. Verificar el correcto funcionamiento.

El rollback únicamente afecta la aplicación.

La información almacenada en SharePoint no deberá modificarse.

---

# Futuro

Cuando V2 alcance la estabilidad necesaria:

* Se evaluará su integración al repositorio oficial.
* Se definirá una estrategia de migración desde V1.
* La empresa decidirá el momento del cambio de producción.

Hasta ese momento, V2 permanecerá completamente aislada dentro del Fork de desarrollo.

---

# Regla de Oro

La estabilidad de la versión utilizada por la empresa tiene prioridad sobre la velocidad de desarrollo.

Toda experimentación y desarrollo de nuevas funcionalidades deberá realizarse en la rama V2 del Fork personal hasta que la aplicación esté lista para su integración oficial.
