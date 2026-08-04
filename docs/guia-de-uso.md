# Guía de uso — Fauna de Tela

Guía para el dueño/operador del negocio: cómo registrar movimientos por WhatsApp y cómo consultar todo lo cargado desde el panel web.

> Las credenciales de acceso (usuario y contraseña) te las da quien administra el sistema — no están en este documento.

---

## 1. Dos formas de usar el sistema

| | Para qué sirve |
|---|---|
| **Bot de WhatsApp** | Cargar movimientos del día a día: compras, entregas a operarias, ventas, ajustes — todo charlando, sin entrar a ninguna página. |
| **Panel web** | Ver todo lo cargado: catálogo completo, historial de movimientos, operarias, órdenes de producción. Pensado para consultar y revisar, no para cargar día a día. |

Los dos apuntan a la misma información — lo que cargás por WhatsApp aparece al instante en el panel web, y viceversa.

## 2. Bot de WhatsApp

**Para empezar**: escribile cualquier mensaje (ej. "hola") al número del bot y te muestra el menú principal.

**Menú principal**:
1. Compra de tela
2. Entrega de material a operaria
3. Recepción de producto terminado
4. Venta
5. Ajuste de stock
6. Ver stock
7. Agregar operaria nueva
8. Agregar material o producto nuevo
9. Ver últimos movimientos

**Cómo se usa** (mismo patrón en casi todos los flujos):
1. Elegís una opción tocando el número (ej. `1`).
2. El bot pregunta qué material/producto — primero el nombre (ej. "Gabardina"), después el color si tiene variantes.
3. Pide la cantidad.
4. Muestra un resumen y pregunta **sí/no** antes de guardar — nada se graba hasta confirmar. Si algo está mal, respondé "no" y no queda registrado.

**Casos especiales**:
- **Opción 2 (Entrega a operaria)** → después usás la **opción 3 (Recepción)** para esa misma entrega, y quedan vinculadas: así se sabe qué tela salió y qué producto volvió de esa entrega puntual.
- **Opción 5 (Ajuste)** acepta cantidad negativa, para corregir un stock mal contado.
- **Opción 6 (Ver stock)** muestra ⚠️ al lado de lo que está por debajo del mínimo configurado.

**Atajos válidos en cualquier momento**: escribir `0`, `menu` o `cancelar` vuelve al menú principal, sin importar en qué paso estés.

**Si el bot no responde**: puede haber expirado tu conexión al número (si todavía está en modo de prueba/Sandbox de Twilio). Consultá con el administrador del sistema.

## 3. Panel web

Entrá a la URL del panel (te la pasa el administrador del sistema) e iniciá sesión con tu usuario y contraseña.

**Secciones**:
- **Items** — catálogo completo de materiales y productos, con su stock actual.
- **Operarios** — personas registradas que reciben material y entregan producto terminado.
- **Órdenes de producción** — cada entrega de material a una operaria, vinculada con lo que devolvió.
- **Movimientos** — historial completo: cada compra, entrega, recepción, venta y ajuste cargado, con fecha y quién lo hizo.

Para salir, usá el botón **"Salir"** arriba a la derecha.

## 4. Dudas frecuentes

**¿Necesito usar las dos formas (WhatsApp y panel web)?**
No — la mayoría del día a día se hace por WhatsApp. El panel web es para cuando querés ver todo junto, revisar el historial completo o chequear el catálogo con calma.

**Me equivoqué al cargar algo por WhatsApp, ¿lo puedo borrar?**
No hay forma de borrar o editar un movimiento ya confirmado (es intencional, para que el historial sea siempre confiable). Si cargaste algo mal, usá la opción **5 (Ajuste de stock)** para corregir la cantidad, o avisale al administrador del sistema.

**¿Puedo usar el bot desde otro número de WhatsApp?**
No por tu cuenta — el número autorizado lo configura el administrador del sistema.
