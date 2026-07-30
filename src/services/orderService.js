/* Pure calculation helpers shared by the orders/payments routes.
   Kept framework-free and dependency-free on purpose — easy to unit test. */

function lineTotal(item) {
  if (item.custom != null && item.custom !== "") return Number(item.custom);
  return Number(item.qty) * Number(item.unit_price);
}

function computeSubtotal(items) {
  return items.reduce((sum, i) => sum + lineTotal(i), 0);
}

function computeTotal(subtotal, discount) {
  return Math.max(0, subtotal - Math.max(0, Number(discount) || 0));
}

function sumPayments(payments) {
  return payments.reduce((sum, p) => sum + Number(p.amt || 0), 0);
}

function balanceDue(total, payments) {
  return Math.max(0, total - sumPayments(payments));
}

function refundDue(total, payments) {
  return Math.max(0, sumPayments(payments) - total);
}

const BILL_STATUSES = ["new", "packed", "delivered", "cancelled"];

module.exports = {
  lineTotal,
  computeSubtotal,
  computeTotal,
  sumPayments,
  balanceDue,
  refundDue,
  BILL_STATUSES,
};
