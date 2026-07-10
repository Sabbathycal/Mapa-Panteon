# Mapa Panteón V2

## Coding Guidelines

Version: 2.0

Status: Planning

---

# Propósito

Este documento define los estándares oficiales de desarrollo para Mapa Panteón V2.

Su objetivo es mantener una base de código consistente, mantenible y fácil de comprender para cualquier desarrollador que participe en el proyecto.

---

# Filosofía

Todo cambio deberá priorizar:

* Legibilidad.
* Mantenibilidad.
* Simplicidad.
* Consistencia.

El código deberá ser fácil de entender antes que ingenioso.

---

# Arquitectura

La aplicación seguirá estrictamente la siguiente separación de responsabilidades:

```text
Component
↓
Store
↓
Service
↓
Sistema Externo
```

No deberán existir atajos entre capas.

---

# Componentes

Los componentes Vue representan únicamente la interfaz.

Deben:

* Mostrar información.
* Recibir interacción del usuario.
* Emitir eventos.

No deben:

* Consultar APIs.
* Ejecutar lógica de negocio.
* Modificar SharePoint.
* Acceder directamente a Microsoft Graph.

---

# Stores

Los Stores administran únicamente el estado global.

Deben:

* Compartir información entre componentes.
* Mantener el estado reactivo.

No deben:

* Leer archivos.
* Consultar APIs.
* Comunicarse con SharePoint.
* Contener lógica de autenticación.

---

# Services

Los Services son responsables de toda comunicación externa.

Incluyen:

* Microsoft Graph.
* SharePoint.
* GeoJSON.
* Microsoft Entra ID.

Toda integración externa deberá implementarse mediante un Service.

---

# Organización

Cada archivo deberá tener una única responsabilidad.

Evitar archivos que mezclen múltiples funcionalidades.

---

# Tamaño de Componentes

Como regla general:

* Preferir componentes pequeños.
* Extraer componentes reutilizables cuando sea necesario.

Si un componente comienza a ser difícil de navegar, deberá dividirse.

No existe un límite estricto de líneas, pero la claridad siempre tendrá prioridad.

---

# Nombres

Utilizar nombres descriptivos.

Correcto:

```javascript
InventoryService
GeometryEditor
SelectionStore
```

Incorrecto:

```javascript
utils2
temp
dataFinal2
```

---

# Funciones

Las funciones deberán realizar una única tarea.

Preferir varias funciones pequeñas sobre una función extensa con múltiples responsabilidades.

---

# Comentarios

El código deberá ser autoexplicativo.

Los comentarios deberán utilizarse únicamente cuando expliquen decisiones de diseño o reglas de negocio que no sean evidentes.

No comentar código obvio.

---

# Manejo de Errores

Toda operación que interactúe con sistemas externos deberá manejar errores de forma controlada.

Los errores deberán proporcionar información útil para diagnóstico.

---

# Constantes

Los valores reutilizables deberán declararse como constantes.

Evitar números o cadenas "mágicas" distribuidas por el código.

---

# Importaciones

Mantener importaciones organizadas.

Eliminar dependencias no utilizadas.

---

# Formato

Utilizar un único formateador para todo el proyecto.

Se recomienda:

* Prettier
* ESLint

---

# Dependencias

Antes de agregar una nueva dependencia deberá evaluarse:

* ¿Resuelve un problema real?
* ¿Puede resolverse con herramientas existentes?
* ¿Será mantenida a largo plazo?

Evitar dependencias innecesarias.

---

# Rendimiento

Optimizar únicamente cuando exista una necesidad comprobada.

No sacrificar claridad por optimizaciones prematuras.

---

# Compatibilidad

Las modificaciones deberán mantener compatibilidad con la estructura general del proyecto.

Los cambios que afecten arquitectura deberán reflejarse en la documentación correspondiente.

---

# Git

Cada Commit deberá representar un cambio lógico.

Evitar Commits con múltiples objetivos diferentes.

Ejemplos:

Correcto:

```
feat: add inventory synchronization

fix: correct lot selection

docs: update routing documentation
```

---

# Documentación

Toda modificación importante de arquitectura deberá actualizar los documentos correspondientes.

La documentación forma parte del proyecto y deberá mantenerse sincronizada con el código.

---

# Revisión

Antes de integrar un cambio deberá verificarse:

* El proyecto compila.
* No existen errores de lint.
* No rompe funcionalidades existentes.
* La documentación continúa siendo válida.

---

# Regla de Oro

El objetivo no es escribir el código más complejo ni el más corto.

El objetivo es escribir código que cualquier desarrollador pueda comprender, mantener y extender con confianza dentro de varios años.
