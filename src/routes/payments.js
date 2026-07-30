const express = require("express");
const { nanoid } = require("nanoid");

const Order = require("../models/Order");
const { getFullOrder } = require("./orders");

const router = express.Router();

// GET /api/orders/:id/payments
router.get("/:id/payments", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();

    if (!order)
      return res.status(404).json({
        error: "Order not found",
      });

    res.json(
      (order.payments || []).map((p) => ({
        id: p.id,
        amt: p.amt,
        method: p.method,
        receiptImg: p.receipt_img,
        at: p.at,
      }))
    );
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// POST /api/orders/:id/payments
router.post("/:id/payments", async (req, res) => {
  try {
    const { amt, method, receiptImg } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order)
      return res.status(404).json({
        error: "Order not found",
      });

    if (!amt || Number(amt) <= 0)
      return res.status(400).json({
        error: "amt must be a positive number",
      });

    if (!method)
      return res.status(400).json({
        error: "method is required",
      });

    order.payments.push({
      id: "pay" + nanoid(),
      amt: Number(amt),
      method,
      receipt_img:
        method === "Cash"
          ? null
          : receiptImg || null,
      at: Date.now(),
    });

    order.updated_at = Date.now();

    await order.save();

    res.status(201).json(
      await getFullOrder(req.params.id)
    );
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;