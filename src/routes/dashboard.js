const express = require("express");

const Product = require("../models/Product");
const Category = require("../models/Category");
const Order = require("../models/Order");
const Campaign = require("../models/Campaign");
const Visit = require("../models/Visit");

const router = express.Router();

// GET /api/dashboard
router.get("/", async (req, res) => {
  try {
    const [
      totalProducts,
      totalCategories,
      totalOrders,
      totalShares,
      revenue,
      visits,
      categories,
      orders,
    ] = await Promise.all([
      Product.countDocuments(),
      Category.countDocuments(),
      Order.countDocuments(),
      Campaign.countDocuments(),
      Order.aggregate([
        {
          $match: {
            status: { $ne: "cancelled" },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$total" },
          },
        },
      ]),
      Visit.find(),
      Category.find(),
      Order.find().select("status total payments"),
    ]);

    // Pending Balance
    const pendingBalance = orders.reduce((sum, order) => {
      const paid = (order.payments || []).reduce(
        (t, p) => t + (p.amt || 0),
        0
      );

      return sum + Math.max(0, order.total - paid);
    }, 0);

    // Average dwell across all visits
    const avgDwellMs =
      visits.length === 0
        ? 0
        : visits.reduce((s, v) => s + v.dwell_ms, 0) / visits.length;

    // Orders grouped by status
    const statusCounts = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    // Per-category stats
    //=====================================================================================
    const productCounts = await Product.aggregate([
      {
        $group: {
          _id: "$cat_id",
          products: { $sum: 1 }
        }
      }
    ]);

    const campaignCounts = await Campaign.aggregate([
      {
        $group: {
          _id: "$cat_id",
          campaigns: { $sum: 1 }
        }
      }
    ]);

    const visitStats = await Visit.aggregate([
      {
        $group: {
          _id: "$cat_id",
          visits: { $sum: 1 },
          avg_dwell_ms: { $avg: "$dwell_ms" }
        }
      }
    ]);

    const productMap = Object.fromEntries(
      productCounts.map(x => [x._id, x.products])
    );

    const campaignMap = Object.fromEntries(
      campaignCounts.map(x => [x._id, x.campaigns])
    );

    const visitMap = Object.fromEntries(
      visitStats.map(x => [
        x._id,
        {
          visits: x.visits,
          avg_dwell_ms: x.avg_dwell_ms
        }
      ])
    );

    const _categories = await Category.find().lean();

    const byCategory = _categories.map(cat => ({
        id: cat._id,
        name: cat.name,
        products: productMap[cat._id] || 0,
        campaigns: campaignMap[cat._id] || 0,
        visits: visitMap[cat._id]?.visits || 0,
        avg_dwell_ms: visitMap[cat._id]?.avg_dwell_ms || 0
    }));
    //========================================================================================

    res.json({
      totalProducts,
      totalCategories,
      totalOrders,
      totalShares,
      revenue: revenue.length ? revenue[0].total : 0,
      pendingBalance,
      avgDwellMs,
      statusCounts,
      byCategory,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;