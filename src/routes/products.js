const express = require("express");
const { nanoid } = require("nanoid");

const Product = require("../models/Product");
const Category = require("../models/Category");
const Campaign = require("../models/Campaign");

const { generateBarcode } = require("../services/barcodeService");

const router = express.Router();

function toApi(doc) {
  return {
    id: doc._id,
    catId: doc.cat_id,
    titleEn: doc.title_en,
    titleUr: doc.title_ur,
    unitPrice: doc.unit_price,
    barcode: doc.barcode,
    img: doc.img,
    imgs: doc.imgs || [],
    shared: doc.shared,
    shareCount: doc.share_count,
    createdAt: doc.created_at,
  };
}

// GET /api/products?catId=&q=
router.get("/", async (req, res) => {
  try {
    const { catId, q } = req.query;

    const filter = {};

    if (catId) filter.cat_id = catId;

    if (q) {
      filter.$or = [
        { title_en: { $regex: q, $options: "i" } },
        { title_ur: { $regex: q, $options: "i" } },
        { barcode: q },
      ];
    }

    const products = await Product.find(filter).sort({ created_at: -1 });

    res.json(products.map(toApi));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product)
      return res.status(404).json({ error: "Product not found" });

    res.json(toApi(product));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Product preview page
router.get("/product/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product)
      return res.status(404).send("Product not found");

    const p = toApi(product);

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">

<title>${p.titleEn}</title>

<meta property="og:type" content="website">
<meta property="og:title" content="${p.titleEn}">
<meta property="og:description" content="Price: Rs. ${p.unitPrice}">
<meta property="og:image" content="${p.img}">
<meta property="og:url" content="https://yourdomain.com/product/${p.id}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${p.titleEn}">
<meta name="twitter:description" content="Price: Rs. ${p.unitPrice}">
<meta name="twitter:image" content="${p.img}">
</head>

<body style="font-family:Arial;padding:30px">

<h1>${p.titleEn}</h1>
<h2>${p.titleUr}</h2>

<img src="${p.img}" width="350">

<p><strong>Price:</strong> Rs. ${p.unitPrice}</p>
<p><strong>Barcode:</strong> ${p.barcode}</p>



</body>
</html>
`);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// GET /api/products/barcode/:code
router.get("/barcode/:code", async (req, res) => {
  try {
    const product = await Product.findOne({
      barcode: req.params.code,
    });

    if (!product)
      return res.status(404).json({
        error: "No product with this barcode",
      });

    res.json(toApi(product));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products
router.post("/", async (req, res) => {
  // console.log("Received request to create product:", req.body);
  try {
    const {
      catId,
      titleEn,
      titleUr,
      unitPrice,
      img,
      imgs,
    } = req.body;

    if (!catId || !titleEn)
      return res.status(400).json({
        error: "catId and titleEn are required",
      });

    const cat = await Category.findById(catId);

    if (!cat)
      return res.status(400).json({
        error: "Unknown catId",
      });

    const id = "p" + nanoid();

    const barcode = await generateBarcode();
    // console.log("Generated barcode:", barcode);

    const imgList =
      Array.isArray(imgs) && imgs.length
        ? imgs
        : img
        ? [img]
        : [];

    const product = await Product.create({
      _id: id,
      cat_id: catId,
      title_en: titleEn.trim(),
      title_ur: (titleUr || "").trim(),
      unit_price: Number(unitPrice) || 0,
      barcode,
      img: imgList[0] || null,
      imgs: imgList,
      shared: false,
      share_count: 0,
      created_at: Date.now(),
    });

    res.status(201).json(toApi(product));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id
router.put("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product)
      return res.status(404).json({
        error: "Product not found",
      });

    const {
      titleEn,
      titleUr,
      unitPrice,
      img,
      imgs,
      catId,
    } = req.body;

    const imgList = Array.isArray(imgs)
      ? imgs
      : product.imgs;

    product.title_en = titleEn?.trim() ?? product.title_en;
    product.title_ur = titleUr?.trim() ?? product.title_ur;
    product.unit_price =
      unitPrice != null
        ? Number(unitPrice)
        : product.unit_price;

    product.img =
      img ?? imgList[0] ?? product.img;

    product.imgs = imgList;
    product.cat_id = catId || product.cat_id;

    await product.save();

    res.json(toApi(product));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/:id/share
router.post("/:id/share", async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        $set: { shared: true },
        $inc: { share_count: 1 },
      },
      {
        returnDocument: 'after',
      }
    );

    if (!product)
      return res.status(404).json({
        error: "Product not found",
      });

    await Campaign.create({
      _id: "camp" + nanoid(),
      cat_id: product.cat_id,
      created_at: Date.now(),
    });

    res.json(toApi(product));
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// DELETE /api/products/:id
router.delete("/:id", async (req, res) => {
  try {
    const result = await Product.deleteOne({
      _id: req.params.id,
    });

    if (result.deletedCount === 0)
      return res.status(404).json({
        error: "Product not found",
      });

    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;