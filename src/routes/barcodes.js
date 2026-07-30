const express = require("express");

const Product = require("../models/Product");
const { isValidEan13 } = require("../services/barcodeService");

const router = express.Router();

// GET /api/barcodes?q=
router.get("/", async (req, res) => {
  try {
    const { q } = req.query;

    const filter = {
      barcode: { $ne: null },
    };

    if (q) {
      filter.$or = [
        { title_en: { $regex: q, $options: "i" } },
        { barcode: { $regex: q, $options: "i" } },
      ];
    }

    const products = await Product.find(filter)
      .select("_id title_en img barcode created_at")
      .sort({ created_at: -1 });

    res.json(
      products.map((p) => ({
        productId: p._id,
        titleEn: p.title_en,
        img: p.img,
        barcode: p.barcode,
        valid: isValidEan13(p.barcode),
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;