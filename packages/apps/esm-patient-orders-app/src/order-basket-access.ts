/**
 * Every order action in the chart ends in the patient-chart-orders window
 * (gated by canastaOrdenes) hosting a workspace gated by ordenes.editar.
 * Offering an entry point on less than both lets the user cause effects —
 * start a visit, hydrate an order, stage a revision in the basket store —
 * before the workspace refuses to open, so both are required up front.
 */
export const orderBasketPrivileges = ['app:hoja.clinica.canastaOrdenes', 'app:hoja.clinica.ordenes.editar'];
