# Guía de uso — StockAsist

Guía para el dueño/operador del negocio: cómo crear tu cuenta, registrar movimientos por WhatsApp y consultar todo lo cargado desde el panel web.

---

## 0. Cómo empezar

- **Si todavía no tenés cuenta**: entrá al panel web y hacé clic en "Registrate" — completás el nombre de tu negocio, tu nombre, email y contraseña, y quedás adentro al instante. No hace falta que nadie te dé de alta.
- **Si alguien ya te dio de alta** (por ejemplo, no pudiste registrarte solo): usá el email y la contraseña que te pasó esa persona.

---

## 1. Dos formas de usar el sistema

| | Para qué sirve |
|---|---|
| **Bot de WhatsApp** | Cargar movimientos del día a día: compras, entregas a operarias, ventas, ajustes — todo charlando, sin entrar a ninguna página. Es la forma recomendada para el uso diario. |
| **Panel web** | Ver todo lo cargado de un vistazo (resumen de stock, historial, catálogo) y también cargar o corregir desde ahí — sirve como respaldo completo si el WhatsApp no anda. |

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
- **Resumen** — lo primero que ves al entrar: gráfico de stock de materiales y productos, con lo que está bajo mínimo o sin stock destacado en rojo/amarillo. Para un vistazo rápido de qué falta.
- **Items** — catálogo completo de materiales y productos, con su stock actual, y un formulario para dar de alta un material o producto nuevo.
- **Operarios** — personas registradas que reciben material y entregan producto terminado, con formulario para agregar una nueva.
- **Órdenes de producción** — cada entrega de material a una operaria, vinculada con lo que devolvió, con formulario para abrir una nueva.
- **Movimientos** — historial completo (cada compra, entrega, recepción, venta y ajuste cargado, con fecha y quién lo hizo) **y un formulario para cargar movimientos nuevos** — es el equivalente a las opciones 1 a 5 del menú de WhatsApp, útil sobre todo si el bot no está disponible.

Para salir, usá el botón **"Salir"** arriba a la derecha.

> ⚠️ A diferencia del bot, el panel web **no pide confirmación antes de guardar** — al tocar "Registrar" o "Crear" queda grabado al instante. Revisá los datos antes de enviar.

### ¿Qué tipo de movimiento elijo? (para el formulario de Movimientos)

El desplegable "Tipo" no dice cuál suma o resta stock — se elige según lo que realmente pasó, no según si querés sumar o restar:

| Quiero... | Elijo | Suma o resta |
|---|---|---|
| Registrar tela que le compré a un proveedor | **Compra** | Suma |
| Darle material a una operaria para que trabaje | **Consumo** | Resta |
| Registrar un producto terminado que volvió (una operaria lo entregó) | **Producción** | Suma |
| Registrar una venta | **Venta** | Resta |
| Corregir un conteo mal hecho (sobra o falta algo sin que haya venta/compra de por medio) | **Ajuste** | Suma o resta, según el signo de la cantidad |

**Ajuste** es el único que acepta cantidad **negativa** — poné el número con `-` adelante para restar (ej. `-3`), sin signo para sumar. En los demás tipos, poné siempre la cantidad en positivo; el sistema ya sabe si suma o resta según el tipo elegido.

**Ejemplo con un producto terminado** (como "Ballena"): para sumar unidades nuevas usá **Producción**; para restar por una venta usá **Venta**; **Compra** y **Consumo** son para materiales (tela), no para productos terminados.

## 4. Dudas frecuentes

**¿Necesito usar las dos formas (WhatsApp y panel web)?**
No — la mayoría del día a día se hace por WhatsApp. El panel web es para cuando querés ver todo junto, revisar el historial completo o chequear el catálogo con calma.

**Me equivoqué al cargar algo por WhatsApp, ¿lo puedo borrar?**
No hay forma de borrar o editar un movimiento ya confirmado (es intencional, para que el historial sea siempre confiable). Si cargaste algo mal, usá la opción **5 (Ajuste de stock)** para corregir la cantidad, o avisale al administrador del sistema.

**¿Puedo usar el bot desde otro número de WhatsApp?**
No por tu cuenta — el número autorizado lo configura el administrador del sistema.

**Se cayó el WhatsApp (o no me conecta), ¿pierdo la posibilidad de cargar?**
No — entrá al panel web y cargá desde ahí, en la sección **Movimientos** (ver [¿Qué tipo de movimiento elijo?](#qué-tipo-de-movimiento-elijo-para-el-formulario-de-movimientos) más arriba). Es la misma base de datos, así que no se pierde ni se duplica nada cuando el bot vuelva a andar.
