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
  generateBillno,
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
    billNo: order.bill_no,
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
      packedQty: i.packed_qty,
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
      packed_qty: 0,
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

    const billNo = await generateBillno();
    await Order.create({
      _id: id,
      bill_no: billNo,
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

    // if (!items && !discount && !cargo && !notes && !phone && !city) {
    //   console.log("in whatsapp user");
    //   order.customer = customer?.trim() || order.customer;
    // }
    // else {
      if (!Array.isArray(items))
        return res
          .status(400)
          .json({ error: "items array is required" });

      const oldItems = new Map(
        order.items.map((item) => [item.product_id, item.packed_qty])
      );

      const lineItems = items.map((i) => {
        const oldItem_packedqty = oldItems.get(i.productId);

        return {
          id: i.id || "item" + nanoid(),
          product_id: i.productId || null,
          title_en: i.titleEn,
          title_ur: i.titleUr || "",
          qty: Number(i.qty) || 1,

          packed_qty:Number(oldItem_packedqty) || 0,
            

          unit_price: Number(i.unitPrice) || 0,

          custom:
            i.custom != null && i.custom !== ""
              ? Number(i.custom)
              : null,

          line_total:
            i.custom != null && i.custom !== ""
              ? Number(i.custom)
              : Number(i.qty) * Number(i.unitPrice),
        };
      });



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
    // }

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
    if(status === "new")
      order.items.map((item)=> item.packed_qty = 0 )
    else if(status === "packed" || status === "delivered")
      order.items.map((item)=> item.packed_qty = item.qty )

    order.updated_at = Date.now();


    await order.save();

    res.json(await getFullOrder(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


//POST /api/orders/:orderId/packing
router.patch("/:orderId/packing", async (req, res) => {
  console.log("in /api/orders/:orderId/packing")
  try {
    const { orderId } = req.params;
    const packedItems = req.body;
    console.log("orderId", orderId);
    console.log("packedItem", packedItems);


    // Validate request
    if (!packedItems || typeof packedItems !== "object" || Array.isArray(packedItems)) {
      return res.status(400).json({
        error: "Invalid packed items data"
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    let somethingPacked = false;

    for (const [itemId, packedQty] of Object.entries(packedItems)) {
      const qty = Number(packedQty);

      if (!Number.isFinite(qty) || qty < 0) {
        return res.status(400).json({
          error: `Invalid packed quantity for item ${itemId}`
        });
      }

      // 0 means nothing was packed for this item
      if (qty === 0) continue;

      const item = order.items.find((i) => i.id === itemId);

      if (!item) {
        return res.status(400).json({
          error: `Item ${itemId} does not exist in this order`
        });
      }

      const currentPacked = item.packed_qty || 0;

      // Don't allow packing more than required quantity
      if (currentPacked + qty > item.qty) {
        return res.status(400).json({
          error: `Packed quantity for ${item.title_en} cannot exceed ${item.qty}`,
          itemId,
          requiredQty: item.qty,
          previousPackedQty: currentPacked,
          newPackedQty: currentPacked + qty
        });
      }

      // Add newly packed quantity to previous packed quantity
      item.packed_qty = currentPacked + qty;

      somethingPacked = true;
    }

    // If nothing was packed, don't change status
    if (somethingPacked) {
      const allPacked = order.items.every(
        (item) => (item.packed_qty || 0) == item.qty
      );

      if (allPacked) {
        order.status = "packed";
      } else {
        order.status = "packing";
      }
    }

    order.updated_at = Date.now();

    await order.save();
    const tofrontend = await toApi(order);
    console.log("tofrontend", tofrontend);

    return res.json({
      message: "Packing updated successfully",
      updatedOrder:tofrontend,
    });

  } catch (error) {
    console.error("Update packing error:", error);

    return res.status(500).json({
      error: "Failed to update packing"
    });
  }
});

// POST /api/orders/:orderId/deliver-packed
router.post("/:orderId/deliver-packed", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { yesCreateNew } = req.body;

    const original = await Order.findById(orderId);

    if (!original) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    if (original.status !== "packing") {
      return res.status(400).json({
        error: "Only packing orders can deliver packed items"
      });
    }

    // -----------------------------------------
    // 1. Separate packed and remaining items
    // -----------------------------------------

    const packedItems = [];
    const remainingItems = [];

    for (const item of original.items) {
      const packedQty = Number(item.packed_qty) || 0;
      const remainingQty = Number(item.qty) - packedQty;

      if (packedQty > 0) {
        packedItems.push({
          id: "item" + nanoid(),
          product_id: item.product_id,
          title_en: item.title_en,
          title_ur: item.title_ur,
          qty: packedQty,
          packed_qty: item.packed_qty,
          unit_price: item.unit_price,
          custom: item.custom,
          line_total: packedQty * Number(item.unit_price || 0)
        });
      }

      if (remainingQty > 0) {
        remainingItems.push({
          id: "item" + nanoid(),
          product_id: item.product_id,
          title_en: item.title_en,
          title_ur: item.title_ur || "",
          qty: remainingQty,
          packed_qty: 0,
          unit_price: item.unit_price,
          custom: item.custom,
          line_total:
            item.custom != null
              ? Number(item.custom)
              : remainingQty * Number(item.unit_price || 0)
        });
      }
    }

    // -----------------------------------------
    // 2. Calculate totals
    // -----------------------------------------

    const packedSubtotal = computeSubtotal(
      packedItems.map((i) => ({
        qty: i.qty,
        unit_price: i.unit_price,
        custom: i.custom
      }))
    );

    const remainingSubtotal = computeSubtotal(
      remainingItems.map((i) => ({
        qty: i.qty,
        unit_price: i.unit_price,
        custom: i.custom
      }))
    );

    /*
      You said:

      If original is fully paid AND discount === 0,
      then automatically make each new order fully paid.

      Otherwise no payments are copied.
    */

    const originalPaid = sumPayments(original.payments || []);

    const originalFullyPaid =
      Math.abs(originalPaid - original.total) < 0.001 &&
      Number(original.discount || 0) === 0;



    const now = Date.now();


    // -----------------------------------------
    // 3. Create delivered order
    // -----------------------------------------

    const deliveredId = "ord" + nanoid();

    const deliveredPayments = [];

    if (originalFullyPaid) {
      deliveredPayments.push({
        id: "pay" + nanoid(),
        amt: packedSubtotal,
        method: original.payment,
        receipt_img: null,
        at: now
      });
    }
    const billNo = await generateBillno();
    const deliveredOrderData = {
      _id: deliveredId,
      bill_no: billNo,

      bill_type: original.bill_type,
      status: "delivered",

      customer: original.customer,
      phone: original.phone,
      city: original.city,
      payment: original.payment,
      notes: original.notes,
      cargo: original.cargo,

      subtotal: packedSubtotal,
      discount: 0,
      total: packedSubtotal,

      items: packedItems,
      payments: deliveredPayments,

      created_at: now,
      updated_at: now
    };

    await Order.create(deliveredOrderData);

    // -----------------------------------------
    // 4. Create remaining NEW order if requested
    // -----------------------------------------

    let newOrderData = null;

    if (yesCreateNew) {
      const newId = "ord" + nanoid();

      const newPayments = [];

      if (originalFullyPaid) {
        newPayments.push({
          id: "pay" + nanoid(),
          amt: remainingSubtotal,
          method: original.payment,
          receipt_img: null,
          at: now
        });
      }
      const billNo = await generateBillno();
      newOrderData = {
        _id: newId,
        bill_no: billNo,
        bill_type: original.bill_type,
        status: "new",

        customer: original.customer,
        phone: original.phone,
        city: original.city,
        payment: original.payment,
        notes: original.notes,
        cargo: original.cargo,

        subtotal: remainingSubtotal,
        discount: 0,
        total: remainingSubtotal,

        items: remainingItems,
        payments: newPayments,

        created_at: now,
        updated_at: now
      };
      await Order.create(newOrderData);

    }

    // -----------------------------------------
    // 5. Cancel original order
    // -----------------------------------------

    original.status = "cancelled";
    original.updated_at = now;

    await original.save();

    // -----------------------------------------
    // 6. Return API-formatted orders
    // -----------------------------------------

    const deliveredOrder = await toApi(deliveredOrderData);
    const newOrder = newOrderData ? await toApi(newOrderData) : null;

    return res.json({
      deliveredOrder,
      newOrder
    });

  } catch (err) {
    console.error("Deliver packed error:", err);

    return res.status(500).json({
      error: err.message
    });
  }
});

module.exports = router;
module.exports.getFullOrder = getFullOrder; // reused by payments.js
