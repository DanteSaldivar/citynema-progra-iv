# 🎬 Sistema de Gestión y Venta de Entradas de Cine

Sistema web progresivo (PWA) destinado a la gestión integral de un establecimiento de cine multisala. El proyecto contempla la venta de entradas, selección de butacas, comercialización de productos de candy bar, validación de accesos y administración del establecimiento.

**Materia:** Programación IV  
**Trabajo Práctico:** N.º 1  
**Ciclo lectivo:** 2026 — Segundo cuatrimestre  
**Versión de requerimientos:** 1.0

---

## 📋 Índice

- [1. Contexto y objetivo](#-1-contexto-y-objetivo)
- [2. Alcance del proyecto](#-2-alcance-del-proyecto)
- [3. Actores del sistema](#-3-actores-del-sistema)
- [4. Tecnologías y arquitectura](#-4-tecnologías-y-arquitectura)
- [5. Requerimientos funcionales](#-5-requerimientos-funcionales)
- [6. Reglas de negocio](#-6-reglas-de-negocio)
- [7. Requerimientos no funcionales](#-7-requerimientos-no-funcionales)
- [8. Decisiones de diseño](#-8-decisiones-de-diseño)
- [9. Criterios de aceptación](#-9-criterios-de-aceptación)
- [10. Instalación y ejecución](#-10-instalación-y-ejecución)

---

## 🎯 1. Contexto y objetivo

El cliente opera un único edificio de cine con múltiples salas. Actualmente no dispone de un canal de venta propio, por lo que se plantea desarrollar una aplicación que centralice las operaciones del establecimiento.

El objetivo es construir una **aplicación web progresiva (PWA)** que cubra tres áreas principales:

1. **Venta al público:** consulta de cartelera, selección de butacas, compra de entradas y productos de candy bar, emisión de comprobantes PDF con códigos QR.
2. **Operación en sala:** validación de entradas y retiro de productos mediante escaneo de códigos QR por parte del personal.
3. **Gestión administrativa:** administración de películas, salas, funciones, precios, promociones, productos, reportes y auditoría.

## 📦 2. Alcance del proyecto

### Dentro del alcance

- Gestión de usuarios y autenticación.
- Consulta de cartelera y películas.
- Compra de entradas y selección de butacas.
- Actualización de disponibilidad en tiempo real.
- Venta de productos de candy bar.
- Generación de comprobantes PDF y códigos QR.
- Validación de entradas y pedidos.
- Administración de películas, salas y funciones.
- Gestión de promociones, cupones y recompensas.
- Programa de fidelización.
- Reportes administrativos.
- Instalación y funcionamiento como PWA.

### Fuera del alcance

| Funcionalidad | Motivo |
|---|---|
| Mapa interactivo del establecimiento | No cuenta con aprobación del cliente. Se considera para una futura etapa. |
| Pasarela de pago real | Se implementa una simulación de pago. |
| Aplicación móvil nativa | La PWA cubre la necesidad de instalación en dispositivos. |
| Gestión de múltiples sedes | El establecimiento corresponde a un único edificio. |
| Facturación fiscal | No forma parte de los requerimientos del cliente. |

---

## 👥 3. Actores del sistema

El sistema contempla cuatro tipos de actores:

| Actor | Descripción | Autenticación |
|---|---|---|
| Visitante anónimo | Consulta la cartelera y puede comprar entradas sin registrarse. | No |
| Cliente registrado | Compra entradas y accede a beneficios, puntos, crédito e historial. | Sí |
| Empleado | Valida entradas y retiros de candy bar. | Sí |
| Administrador | Gestiona el catálogo, las funciones, los precios, las promociones y los reportes. | Sí |

## 🏗️ 4. Tecnologías y arquitectura

### Tecnologías

| Tecnología | Responsabilidad |
|---|---|
| Angular 22 | Desarrollo de la interfaz y lógica de aplicación. |
| TypeScript | Lenguaje principal del frontend. |
| Supabase | Servicios de backend y persistencia. |
| PostgreSQL | Base de datos relacional. |
| Supabase Auth | Autenticación y gestión de sesiones. |
| Supabase Realtime | Sincronización de disponibilidad de butacas. |
| Supabase Storage | Almacenamiento de imágenes y recursos. |
| SCSS | Estilos y diseño visual. |
| PWA | Instalación y experiencia de aplicación progresiva. |

### Arquitectura general

```text
┌──────────────────────────────────────────────┐
│                 ANGULAR 22                   │
│                                              │
│  Público       Cartelera · Películas · Compra│
│  Cuenta        Perfil · Puntos · Crédito     │
│  Staff         Escáner QR · Validaciones     │
│  Admin         ABM · Funciones · Reportes    │
│                                              │
│  Guards por rol · Lazy Loading · Signals     │
│  Servicios de negocio · Componentes standalone│
└──────────────────────┬───────────────────────┘
                       │
                   supabase-js
                       │
┌──────────────────────▼───────────────────────┐
│                  SUPABASE                    │
│                                              │
│  Auth       Autenticación y sesiones         │
│  PostgreSQL Persistencia de datos            │
│  RLS        Control de acceso                │
│  Realtime   Actualización en tiempo real     │
│  Storage    Imágenes y recursos              │
└──────────────────────────────────────────────┘
```

---

## ⚙️ 5. Requerimientos funcionales

Los requerimientos se organizan por módulos y se identifican mediante códigos para facilitar su seguimiento durante el desarrollo.

Prioridades:

- **P0:** Crítico. Indispensable para el funcionamiento del sistema.
- **P1:** Importante. Funcionalidad necesaria dentro del alcance.
- **P2:** Deseable. Funcionalidad complementaria.

### 5.1 Autenticación y usuarios (AUT)

- **AUT-01 (P0):** Registro de clientes con email, nombre, apellido, fecha de nacimiento, tipo de sangre, color de ojos y cantidad de días de vacaciones anuales.
- **AUT-02 (P0):** Inicio y cierre de sesión mediante email y contraseña.
- **AUT-03 (P0):** Soporte para roles cliente, empleado y administrador.
- **AUT-04 (P0):** Compra sin registro, solicitando un email de contacto.
- **AUT-05 (P1):** Consulta y edición del perfil, incluyendo puntos, crédito e historial de canjes.
- **AUT-06 (P0):** Asignación y modificación de roles exclusivamente por parte del administrador.

### 5.2 Catálogo público (CAT)

- **CAT-01 (P1):** Mostrar las tres películas más vendidas en la página principal.
- **CAT-02 (P0):** Permitir al administrador seleccionar las películas destacadas y su orden.
- **CAT-03 (P0):** Buscador por título y sinopsis.
- **CAT-04 (P0):** Filtros por género, permitiendo múltiples géneros por película.
- **CAT-05 (P0):** Ficha de película con imagen, sinopsis, duración, géneros, clasificación y puntuación promedio.
- **CAT-06 (P0):** Mostrar funciones disponibles con fecha, hora, sala, formato e idioma.
- **CAT-07 (P1):** Sección de películas próximas a estrenarse.
- **CAT-08 (P2):** Alertas de estreno para clientes registrados.
- **CAT-09 (P2):** Sección Mis películas con historial de películas vistas y calificaciones.

### 5.3 Reseñas (RES)

- **RES-01 (P1):** Calificar películas con estrellas del 1 al 5 y comentarios cortos.
- **RES-02 (P1):** Mostrar reseñas antes de iniciar la compra.
- **RES-03 (P1):** Calcular y mostrar el promedio y cantidad de reseñas.

### 5.4 Compra de entradas (COM)

- **COM-01 (P0):** Selección de función y butacas mediante un mapa visual de la sala.
- **COM-02 (P0):** Actualización en tiempo real de la ocupación de butacas.
- **COM-03 (P0):** Diferenciación visual de butacas accesibles.
- **COM-04 (P1):** Diferenciación visual de butacas VIP y aplicación de un precio superior.
- **COM-05 (P0):** Impedir la compra concurrente de una misma butaca para una función.
- **COM-06 (P0):** Generar comprobantes PDF descargables con información de la entrada y código QR.
- **COM-07 (P0):** Restringir compras según la clasificación por edad.
- **COM-08 (P0):** Informar cuando una entrada requiere acompañamiento de un adulto.
- **COM-09 (P1):** Permitir comprar productos de candy bar junto con las entradas.
- **COM-10 (P2):** Destacar combos promocionales durante la compra.

### 5.5 Candy bar (CAN)

- **CAN-01 (P1):** ABM de categorías de productos.
- **CAN-02 (P1):** ABM de productos, categorías y precios.
- **CAN-03 (P2):** Creación de combos con precios configurables.
- **CAN-04 (P1):** Retiro de productos mediante el código QR asociado a la orden.

### 5.6 Descuentos y promociones (DES)

- **DES-01 (P1):** Asignar un cupón de bienvenida a nuevos clientes registrados.
- **DES-02 (P1):** Permitir configurar el porcentaje del cupón de bienvenida. Valor inicial: 20 %.
- **DES-03 (P1):** Crear cupones destinados a usuarios mayores de 50 años.
- **DES-04 (P1):** Configurar preventas por película, con apertura predeterminada de 7 días antes del estreno y precio especial.

### 5.7 Fidelización (FID)

- **FID-01 (P2):** Acumular un punto por cada peso gastado en compras de clientes registrados.
- **FID-02 (P2):** Canjear puntos por entradas gratuitas o productos de candy bar.
- **FID-03 (P2):** Configurar el costo en puntos de cada recompensa.
- **FID-04 (P2):** Consultar saldo de puntos e historial de canjes.
- **FID-05 (P2):** Impedir la transferencia de puntos entre usuarios.

### 5.8 Cancelaciones y crédito (CRE)

- **CRE-01 (P2):** Permitir cancelar compras hasta dos horas antes de la función.
- **CRE-02 (P2):** Generar crédito en la cuenta en lugar de devolver dinero.
- **CRE-03 (P2):** Consultar y utilizar el crédito en compras posteriores.
- **CRE-04 (P2):** Liberar butacas y anular códigos QR al cancelar una entrada.

### 5.9 Validación en sala (VAL)

- **VAL-01 (P0):** Escanear códigos QR mediante la cámara del dispositivo.
- **VAL-02 (P0):** Permitir ingresar códigos manualmente.
- **VAL-03 (P1):** Validar códigos QR de retiro de candy bar.
- **VAL-04 (P0):** Invalidar el código QR luego de su utilización.
- **VAL-05 (P0):** Mostrar película, función, butaca, tipo de butaca y necesidad de acompañante adulto al validar.

### 5.10 Administración (ADM)

- **ADM-01 (P0):** ABM de películas.
- **ADM-02 (P0):** ABM de géneros.
- **ADM-03 (P0):** ABM de salas y consulta de distribución de butacas.
- **ADM-04 (P0):** ABM de funciones.
- **ADM-05 (P0):** Asignación automática de salas disponibles.
- **ADM-06 (P0):** Impedir funciones superpuestas en una misma sala.
- **ADM-07 (P0):** Respetar un mínimo de 30 minutos entre funciones.
- **ADM-08 (P1):** Programar funciones recurrentes.
- **ADM-09 (P1):** ABM de cupones, productos, categorías, combos y recompensas.
- **ADM-10 (P2):** Registro de actividad administrativa con usuario, fecha y hora.

### 5.11 Reportes (REP)

- **REP-01 (P1):** Reporte diario de facturación y cantidad de entradas vendidas.
- **REP-02 (P2):** Exportación de reportes a PDF y Excel.
- **REP-03 (P2):** Gráficos de películas más vistas por semana y mes.
- **REP-04 (P2):** Identificación del producto de candy bar más vendido.

### 5.12 Notificaciones y PWA (NOT)

- **NOT-01 (P0):** Aplicación instalable como PWA, con manifiesto, iconos y service worker.
- **NOT-02 (P1):** Funcionamiento con conectividad degradada mediante caché de cartelera y entradas adquiridas.
- **NOT-03 (P2):** Notificaciones push al habilitarse la venta de películas con alertas activadas.

---

## 📏 6. Reglas de negocio

| ID | Regla |
|---|---|
| RN-01 | Todas las salas tienen 20 filas identificadas de A a T, con una distribución estándar de 28 butacas por fila. |
| RN-02 | Las filas J y K corresponden a butacas accesibles, con 14 butacas por fila. |
| RN-03 | Las filas R, S y T corresponden a butacas VIP. |
| RN-04 | Deben transcurrir al menos 30 minutos entre funciones de una misma sala. |
| RN-05 | No pueden existir dos funciones superpuestas en una misma sala. |
| RN-06 | La asignación de salas es automática. |
| RN-07 | Las restricciones de edad se aplican según la clasificación ATP, +13 y +18. |
| RN-08 | Las entradas con restricción deben indicar si requieren acompañante adulto. |
| RN-09 | Los códigos QR son de un solo uso. |
| RN-10 | Una butaca no puede venderse dos veces para una misma función, salvo cancelación previa. |
| RN-11 | El cupón de bienvenida se aplica una sola vez y exclusivamente en la primera compra de un cliente registrado. |
| RN-12 | Los cupones por edad requieren cumplir el umbral correspondiente. |
| RN-13 | Se acumula un punto por peso efectivamente pagado. |
| RN-14 | Los puntos no son transferibles entre usuarios. |
| RN-15 | Las compras sólo pueden cancelarse si faltan más de dos horas para la función. |
| RN-16 | Las cancelaciones generan crédito y no devolución de dinero. |
| RN-17 | Durante el período de preventa se aplica el precio especial configurado. |
| RN-18 | El cálculo del precio sigue un orden definido: precio base, recargo VIP, preventa, descuentos, puntos y crédito. |
| RN-19 | Las operaciones administrativas sensibles deben quedar registradas. |

### Distribución de butacas

Cada sala dispone de 532 butacas, distribuidas de la siguiente manera:

| Tipo | Filas | Butacas por fila | Total |
|---|---|---:|---:|
| Estándar | A-I y L-Q | 28 | 476 |
| Accesible | J y K | 14 | 28 |
| VIP | R-T | 28 | 84 |
| **Total** | **20 filas** | | **532** |

---

## 🔍 7. Requerimientos no funcionales

- **RNF-01:** Identidad visual propia y coherente.
- **RNF-02:** Interfaces intuitivas y fáciles de utilizar.
- **RNF-03:** Selectores propios de fecha y hora, evitando controles nativos de desplazamiento largo.
- **RNF-04:** Actualización en tiempo real de la disponibilidad de butacas.
- **RNF-05:** Seguridad de datos mediante Row Level Security (RLS).
- **RNF-06:** Integridad de las reservas ante operaciones concurrentes mediante restricciones de base de datos.
- **RNF-07:** Instalación y funcionamiento como PWA.
- **RNF-08:** Diseño responsive, especialmente para compras y validación de entradas.
- **RNF-09:** Accesibilidad mediante navegación por teclado, contraste y atributos ARIA.
- **RNF-10:** Aplicación desplegada, código publicado en GitHub y documentación técnica.
- **RNF-11:** Buenas prácticas de Angular: standalone components, signals, computed, inject(), lazy loading y guards por rol.
- **RNF-12:** Integración con Supabase Auth, PostgreSQL, RLS, Realtime y Storage.

---

## 🧩 8. Decisiones de diseño

Durante el análisis de los requerimientos se identificaron situaciones ambiguas que requirieron decisiones para definir el comportamiento del sistema.

| Tema | Decisión adoptada |
|---|---|
| Butacas accesibles | Se consideran dos filas, J y K, con 14 butacas cada una. |
| Compra anónima con restricción de edad | Se solicita fecha de nacimiento durante el checkout cuando corresponda. |
| Publicación de reseñas | Sólo clientes registrados con una entrada validada de la película pueden reseñar. |
| Cálculo de descuentos | Se establece un orden único de aplicación de descuentos y beneficios. |
| QR de entradas y candy | Se utilizan códigos independientes para validar acceso y retiro de productos. |
| Precio VIP | Recargo configurable, inicialmente del 50 %. |
| Cancelaciones | Se revierten los puntos acumulados y se libera el cupón utilizado. |
| Reserva temporal de butacas | Se establece un período de 10 minutos, configurable. |
| Medio de pago | Se implementa una simulación de pago. |
| Longitud de reseñas | Máximo de 280 caracteres. |

---

## ✅ 9. Criterios de aceptación

El sistema deberá cumplir con los siguientes escenarios:

1. Un visitante anónimo puede consultar películas, seleccionar funciones y butacas, completar una compra y descargar su comprobante PDF con QR.
2. Dos navegadores pueden visualizar los cambios de disponibilidad de butacas en tiempo real.
3. El administrador puede programar funciones recurrentes sin seleccionar manualmente una sala.
4. El sistema impide la venta duplicada de butacas y las superposiciones de funciones.
5. Un empleado puede validar un QR y el sistema rechaza un segundo uso del mismo código.
6. Un usuario de 15 años no puede comprar entradas para una película +18.
7. Las butacas accesibles y VIP se identifican visualmente y sus precios se comunican antes de pagar.
8. El administrador puede consultar la facturación diaria y las entradas vendidas.
9. La aplicación puede instalarse como PWA en un dispositivo móvil.
10. El proyecto cuenta con una versión desplegada y documentación en GitHub.

---


## 📌 Estado del proyecto

Proyecto académico correspondiente a Programación IV, segundo cuatrimestre de 2026.

Los requerimientos aquí documentados representan el alcance funcional y técnico definido para el desarrollo. La implementación de cada funcionalidad puede encontrarse en distintas etapas de avance.

---
