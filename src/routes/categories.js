const express = require("express");
const { nanoid } = require("nanoid");

const Category = require("../models/Category");
const Product = require("../models/Product");
const Campaign = require("../models/Campaign");

const router = express.Router();
console.log("CATEGORIES ROUTER LOADED");
function slugify(name) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || nanoid(6)
  );
}

// GET /api/categories
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find().sort({ created_at: 1 });

    const result = await Promise.all(
      categories.map(async (cat) => {
        const [productCount, sharedCount, campaignCount] =
          await Promise.all([
            Product.countDocuments({ cat_id: cat._id }),
            Product.countDocuments({
              cat_id: cat._id,
              shared: true,
            }),
            Campaign.countDocuments({
              cat_id: cat._id,
            }),
          ]);

        return {
          ...cat.toObject(),
          product_count: productCount,
          shared_count: sharedCount,
          campaign_count: campaignCount,
        };
      })
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/categories/:id
router.get("/:id", async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id);

    if (!cat)
      return res
        .status(404)
        .json({ error: "Category not found" });

    const [productCount, sharedCount, campaignCount] =
      await Promise.all([
        Product.countDocuments({ cat_id: cat._id }),
        Product.countDocuments({
          cat_id: cat._id,
          shared: true,
        }),
        Campaign.countDocuments({
          cat_id: cat._id,
        }),
      ]);

    res.json({
      ...cat.toObject(),
      product_count: productCount,
      shared_count: sharedCount,
      campaign_count: campaignCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/categories
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim())
      return res.status(400).json({
        error: "name is required",
      });

    const id = "cat" + nanoid();

    let slug = slugify(name);
    console.log("slug", slug);
    const exists = await Category.findOne({
      link_slug: slug,
    });

    if (exists) {
      slug = `${slug}-${nanoid(5)}`;
    }

    const category = await Category.create({
      _id: id,
      name: name.trim(),
      link_slug: slug,
      created_at: Date.now(),
    });
    console.log("Created category", category);
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/categories/:id
router.put("/:id", async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category)
      return res
        .status(404)
        .json({ error: "Category not found" });

    category.name =
      req.body.name?.trim() || category.name;

    await category.save();

    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/categories/:id
router.delete("/:id", async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category)
      return res
        .status(404)
        .json({ error: "Category not found" });

    // Equivalent to SQLite ON DELETE CASCADE
    await Product.deleteMany({
      cat_id: req.params.id,
    });

    await Campaign.deleteMany({
      cat_id: req.params.id,
    });

    await category.deleteOne();

    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
