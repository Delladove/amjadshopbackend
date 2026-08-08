const express = require("express");
const { nanoid } = require("nanoid");
const Order = require("../models/Order");
const Product = require("../models/Product");
const {
  computeSubtotal,
  computeTotal,
  sumPayments,
  balanceDue,
  refundDue,
  BILL_STATUSES,
} = require("../services/orderService");


const router = express.Router();

async function getFullOrder(id) {
  const order = await Order.findById(id).lean();

  if (!order) return null;

  return await toApi(order);
}

async function toApi(order) {
  // Get product images for all products in this order
  const productIds = order.items
    .map((i) => i.product_id)
    .filter(Boolean);

  const products = await Product.find({
    _id: { $in: productIds },
  })
    .select("_id img")
    .lean();

  const productMap = Object.fromEntries(
    products.map((p) => [p._id, p.img])
  );

  const payments = order.payments || [];

  const paid = sumPayments(payments);

  return {
    id: order._id,
    billType: order.bill_type,
    status: order.status,
    customer: order.customer,
    phone: order.phone,
    city: order.city,
    payment: order.payment,
    notes: order.notes,
    cargo: order.cargo,

    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,

    createdAt: order.created_at,
    updatedAt: order.updated_at,

    items: order.items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      titleEn: i.title_en,
      titleUr: i.title_ur,
      qty: i.qty,
      unitPrice: i.unit_price,
      custom: i.custom,
      line: i.line_total,
      img: productMap[i.product_id] || null,
    })),

    payments: payments.map((p) => ({
      id: p.id,
      amt: p.amt,
      method: p.method,
      receiptImg: p.receipt_img,
      at: p.at,
    })),

    paid,
    balance: balanceDue(order.total, payments),
    refundDue: refundDue(order.total, payments),
  };
}

// GET /api/orders
router.get("/", async (req, res) => {
  try {
    const { billType, status, q, updatedAfter } = req.query;

    const filter = {};

    if (billType) filter.bill_type = billType;

    if (status) filter.status = status;

    if (q) {
      filter.$or = [
        {
          customer: {
            $regex: q,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: q,
            $options: "i",
          },
        },
      ];
    }

    if (updatedAfter) {
      filter.updated_at = {
        $gt: Number(updatedAfter),
      };
    }

    const orders = await Order.find(filter)
      .sort({ created_at: -1 })
      .lean();

    const full = await Promise.all(
      orders.map((o) => toApi(o))
    );

    res.json(full);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// GET /api/orders/:id
router.get("/:id", async (req, res) => {
  try {
    const full = await getFullOrder(req.params.id);

    if (!full) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    res.json(full);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// POST /api/orders
router.post("/", async (req, res) => {
  try {
    const b = req.body;

    if (!b.customer || !b.customer.trim())
      return res.status(400).json({ error: "customer name is required" });

    if (!Array.isArray(b.items) || !b.items.length)
      return res.status(400).json({ error: "at least one item is required" });

    if (!b.payment)
      return res.status(400).json({ error: "payment method is required" });

    const now = Date.now();
    const id = "ord" + nanoid();

    const items = b.items.map((i) => ({
      id: "item" + nanoid(),
      product_id: i.productId || null,
      title_en: i.titleEn,
      title_ur: i.titleUr || "",
      qty: Number(i.qty) || 1,
      unit_price: Number(i.unitPrice) || 0,
      custom:
        i.custom != null && i.custom !== ""
          ? Number(i.custom)
          : null,
      line_total:
        i.custom != null && i.custom !== ""
          ? Number(i.custom)
          : Number(i.qty) * Number(i.unitPrice),
    }));

    const subtotal = computeSubtotal(
      items.map((i) => ({
        qty: i.qty,
        unit_price: i.unit_price,
        custom: i.custom,
      }))
    );

    const discount = Math.max(0, Number(b.discount) || 0);
    const total = computeTotal(subtotal, discount);

    const paidNow =
      b.paidNow === "" || b.paidNow == null
        ? total
        : Math.max(0, Number(b.paidNow) || 0);

    const payments = [];

    if (paidNow > 0) {
      payments.push({
        id: "pay" + nanoid(),
        amt: paidNow,
        method: b.payment,
        receipt_img:
          b.payment === "Cash"
            ? null
            : b.paymentReceiptImg || null,
        at: now,
      });
    }

    await Order.create({
      _id: id,
      bill_type: b.billType || "Walkin",
      status: "new",

      customer: b.customer.trim(),
      phone: b.phone || "",
      city: b.city || "",
      payment: b.payment,
      notes: b.notes || "",

      cargo: b.cargo || null,

      subtotal,
      discount,
      total,

      items,
      payments,

      created_at: now,
      updated_at: now,
    });

    res.status(201).json(await getFullOrder(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// PUT /api/orders/:id
router.put("/:id", async (req, res) => {
  try {
    console.log("PUT /api/orders/:id", req.body);
    const order = await Order.findById(req.params.id);

    if (!order)
      return res.status(404).json({ error: "Order not found" });

    if (order.status === "cancelled")
      return res
        .status(400)
        .json({ error: "Cancelled bills can't be edited" });

    const {
      items,
      discount,
      cargo,
      notes,
      customer,
      phone,
      city,
    } = req.body;

    if (!items && !discount && !cargo && !notes && !phone && !city) {
       console.log("in whatsapp user");
       order.customer = customer?.trim() || order.customer;
    }
    else {
      if (!Array.isArray(items))
        return res
          .status(400)
          .json({ error: "items array is required" });

      const lineItems = items.map((i) => ({
        id: i.id || "item" + nanoid(),
        product_id: i.productId || null,
        title_en: i.titleEn,
        title_ur: i.titleUr || "",
        qty: Number(i.qty) || 1,
        unit_price: Number(i.unitPrice) || 0,
        custom:
          i.custom != null && i.custom !== ""
            ? Number(i.custom)
            : null,
        line_total:
          i.custom != null && i.custom !== ""
            ? Number(i.custom)
            : Number(i.qty) * Number(i.unitPrice),
      }));

      const subtotal = computeSubtotal(
        lineItems.map((i) => ({
          qty: i.qty,
          unit_price: i.unit_price,
          custom: i.custom,
        }))
      );

      const disc = Math.max(0, Number(discount) || 0);
      const total = computeTotal(subtotal, disc);

      order.items = lineItems;

      order.subtotal = subtotal;
      order.discount = disc;
      order.total = total;

      if (cargo !== undefined)
        order.cargo = cargo;

      order.notes = notes ?? order.notes;
      order.customer = customer?.trim() || order.customer;
      order.phone = phone ?? order.phone;
      order.city = city ?? order.city;
    }

    order.updated_at = Date.now();
    await order.save();

    res.json(await getFullOrder(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// POST /api/orders/:id/status
router.post("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    if (!BILL_STATUSES.includes(status))
      return res.status(400).json({
        error: `status must be one of ${BILL_STATUSES.join(", ")}`,
      });

    const order = await Order.findById(req.params.id);

    if (!order)
      return res
        .status(404)
        .json({ error: "Order not found" });

    order.status = status;
    order.updated_at = Date.now();

    await order.save();

    res.json(await getFullOrder(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.getFullOrder = getFullOrder; // reused by payments.js
