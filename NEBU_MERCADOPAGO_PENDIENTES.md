# NEBU Mercado Pago - pendientes

Actualizado: 2026-07-01 UTC.

Este archivo no debe guardar access tokens, client secrets, public keys completas ni secretos de webhook.

## Estado validado

- La integracion esta usando credenciales de produccion: el backend creo preferencias con `sandbox: false`.
- Mercado Pago recibio intentos reales de pago Yape por S/ 3 para el producto temporal `qa-mp-3-soles`.
- Mercado Pago aprobo un pago real con tarjeta debito por S/ 3 para la orden `ORD-1782880026970-468D27E7`.
- La pagina de Checkout Pro carga correctamente y muestra medios sin cuenta de Mercado Pago, incluyendo tarjeta y Yape.
- El webhook correcto para Mercado Pago es:
  `https://api.flow-telligence.com/api/v1/webhooks/mercadopago`
- El endpoint de webhook responde `200 {"received":true}` cuando Mercado Pago envia el webhook moderno firmado con `body.data.id`.

## Evidencia de pagos reales

Ordenes de prueba:

- `ORD-1782877129845-4043B91B`
- `ORD-1782878778179-BABF8BE1`

Pagos observados en la API de Mercado Pago:

- `165758120581`: `rejected`, `cc_rejected_high_risk`, metodo `yape`, monto `3 PEN`.
- `165759228845`: `rejected`, `cc_rejected_high_risk`, metodo `yape`, monto `3 PEN`.
- `166321209028`: `in_process`, `pending_review_manual`, metodo `yape`, monto `3 PEN`.
- `166596973748`: `rejected`, `cc_rejected_high_risk`, metodo `yape`, monto `3 PEN`.
- `165760814843`: `approved`, `accredited`, metodo `debvisa`, monto `3 PEN`, orden `ORD-1782880026970-468D27E7`.

Conclusion: el checkout y la comunicacion con Mercado Pago funcionan hasta el intento de cobro. El rechazo actual no parece originarse en NEBU; Mercado Pago/Yape lo clasifica como riesgo alto o revision manual.

## Estado en base de datos

- Las dos ordenes de prueba siguen en `pending`.
- No hay filas en `payment_transactions` para esas ordenes.
- El producto temporal `qa-mp-3-soles` quedo sin stock despues de las pruebas pendientes/rechazadas.
- La orden con tarjeta aprobada `ORD-1782880026970-468D27E7` fue regularizada manualmente:
  - `orders.status = confirmed`
  - `payment_transactions.status = completed`
  - `transaction_id = 165760814843`

Esto confirma una deuda del backend: los pagos rechazados o en revision se leen en logs, pero no quedan persistidos como transacciones fallidas/en revision ni liberan stock con una regla clara.

## Pendientes P0

- Rotar secretos expuestos durante la prueba: access token de Mercado Pago, client secret y secreto de webhook. Aunque ya funcionen, fueron pegados en chat.
- Corregir el bug que impide procesar automaticamente pagos aprobados:
  - Error: `FOR UPDATE cannot be applied to the nullable side of an outer join`.
  - Ubicacion: `backend/src/payments/mercadopago-webhook.service.ts`, `handlePaymentApproved`.
  - Causa: TypeORM hace `FOR UPDATE` sobre una consulta con `relations: ['payments', 'items']`, que genera `LEFT JOIN`.
  - Solucion sugerida: bloquear primero solo la fila `orders` sin relaciones, luego cargar `items/payments` en consultas separadas dentro de la misma transaccion.
- Reprocesar o regularizar cualquier pago aprobado que haya quedado sin `payment_transactions`.

## Pendientes P1

- Corregir `backend/src/payments/mercadopago-webhook.controller.ts` para aceptar tambien notificaciones legacy/IPN con query params:
  - `?id=<payment_id>&topic=payment`
  - `?id=<merchant_order_id>&topic=merchant_order`
- Para la firma HMAC, usar `body.data.id || query["data.id"] || query.id`.
- Para el tipo de evento, usar `body.type || query.type || query.topic` y normalizar nombres como `topic_merchant_order_wh`.
- Corregir `backend/src/payments/mercadopago-webhook.service.ts`: `handlePaymentRejected` solo envia email. Debe registrar una transaccion fallida y aplicar una politica explicita para la orden.
- Definir la politica de stock ante rechazo:
  - Opcion A: mantener la orden `pending` durante una ventana de retry y liberar stock por expiracion.
  - Opcion B: cancelar y liberar stock cuando el usuario abandona o cuando no hay pagos `in_process`.
  La opcion elegida debe evitar liberar stock si existe otro intento activo o si luego llega un `approved`.
- Corregir la fuente de stock: `OrdersService.createFromCheckout` descuenta `product_catalog.stock_count`, pero tambien existe tabla `inventory`. Hay que unificar fuente o sincronizar ambas en la misma transaccion.

## Pendientes P2

- Decidir si se procesan eventos `merchant_order` o si se desactivan en Mercado Pago para reducir ruido.
- Evitar correos a aliases QA inexistentes o marcar esos envios como no criticos en pruebas.
- Revisar aparte los warnings de firma del webhook de Resend; no pertenecen a Mercado Pago.

## Comandos de verificacion

Logs de Mercado Pago:

```bash
ssh nebu 'docker logs --since 8h nebu-backend 2>&1 | grep -E "MercadoPago webhook|Payment .*status|Invalid webhook signature" | tail -n 200'
```

Estado de una orden:

```bash
ssh nebu 'docker exec -i nebu-postgres sh -lc '\''psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off'\''' <<'SQL'
select o.order_number,o.status,o.total_amount,o.email_sent,o.created_at,o.updated_at,
       count(pt.id) as payment_transactions
from orders o
left join payment_transactions pt on pt.order_id=o.id
where o.order_number = '<ORDER_NUMBER>'
group by o.id;
SQL
```

Stock del producto temporal:

```bash
ssh nebu 'docker exec -i nebu-postgres sh -lc '\''psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off'\''' <<'SQL'
select slug,name,stock_count,in_stock,active,updated_at
from product_catalog
where slug = 'qa-mp-3-soles';
SQL
```
