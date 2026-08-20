const express = require("express");
const { nanoid } = require("nanoid");

const Product = require("../models/Product");
const Category = require("../models/Category");
const Campaign = require("../models/Campaign");

const { generateBarcode } = require("../services/barcodeService");

const router = express.Router();

function toApi(doc) {
  // console.log("doc", doc)
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

//GET /api/products/shared?limit=&cursor=
router.get("/shared", async (req, res) => {
  try {
    console.log("Loaded ",Number(req.query.limit))
    const limit = Math.min(
      Number(req.query.limit) || 20,
      50
    );

    const filter = {
      shared: true,
      shared_at: { $ne: null }
    };

    console.log("cursor", req.query.cursor)
    // Read cursor
    if (req.query.cursor) {
      console.log("inside cursor");
      try {
        const decoded = JSON.parse(
          Buffer.from(
            req.query.cursor,
            "base64url"
          ).toString()
        );

        const { sharedAt, id } = decoded;

        filter.$or = [
          {
            shared_at: {
              $lt: Number(sharedAt)
            }
          },
          {
            shared_at: Number(sharedAt),
            _id: {
              $lt: id
            }
          }
        ];
      } catch {
        return res.status(400).json({
          message: "Invalid cursor"
        });
      }
    }

    const products = await Product.find(filter)
      .sort({
        shared_at: -1,
        _id: -1
      })
      .limit(limit + 1)
      .lean();
    console.log("products",products.length);
    const hasMore = products.length > limit;

    if (hasMore) {
      products.pop();
    }

    let nextCursor = null;

    if (hasMore && products.length > 0) {
      const lastProduct =
        products[products.length - 1];

      nextCursor = Buffer.from(
        JSON.stringify({
          sharedAt: lastProduct.shared_at,
          id: lastProduct._id
        })
      ).toString("base64url");
    }
    const transformed_products = products.map(toApi);
    // console.log(transformed_products)
   res.json({
        products: transformed_products,
        nextCursor,
        hasMore
      });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch shared products"
    });
  }
});

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
    const product = await Product.findById(req.params.id).lean();

    if (!product)
      return res.status(404).json({ error: "Product not found" });

    res.json(toApi(product));
  } catch (err) {
    res.status(500).json({ error: err.message });
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
  console.log("Received request to create product:", req.body);
  try {
    const {
      catId,
      titleEn,
      titleUr,
      unitPrice,
      img,
      imgs,
    } = req.body;
    // console.log(req.body);
    if (!catId || !titleEn)
      return res.status(400).json({
        error: "catId and titleEn are required",
      });

    const cat = await Category.findById(catId);
    // console.log("cat",cat);

    if (!cat)
      return res.status(400).json({
        error: "Unknown catId",
      });

    const id = "p" + nanoid();
    // console.log("Generated id:", id);
  

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
    console.log(product)
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
        $set: { shared: true , shared_at: Date.now() },
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