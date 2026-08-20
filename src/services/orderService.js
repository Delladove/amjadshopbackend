/* Pure calculation helpers shared by the orders/payments routes.
   Kept framework-free and dependency-free on purpose — easy to unit test. */
const Setting = require("../models/Settings")

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

const BILL_STATUSES = ["new", "packed","packing", "delivered", "cancelled"];

async function getNextSeq() {
  // let setting = await Setting.findOne({ key: "next_barcode_seq" });

  // if (!setting) {
  //   console.log("new doc created next_barcode_seq")
  //   await Setting.create({
  //     key: "next_barcode_seq",
  //     value: 4,
  //   });
  //   return 4;
  // } Assuming already has value in db

  const setting = await Setting.findOneAndUpdate(
    { key: "next_bill_no" },
    { $inc: { value: 1 } },
    { returnDocument: "after" }
  );

  return setting.value;
}

async function generateBillno() {
  const seq = await getNextSeq();
  return "B" + String(seq).padStart(5, "0"); // 6 digits total
}

module.exports = {
  lineTotal,
  computeSubtotal,
  computeTotal,
  sumPayments,
  balanceDue,
  refundDue,
  BILL_STATUSES,
  generateBillno,
};
