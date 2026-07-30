const express = require("express");
const { nanoid } = require("nanoid");

const Visit = require("../models/Visit");

const router = express.Router();

// POST /api/visits
// { catId, at, dwellMs }
router.post("/", async (req, res) => {
  try {
    const { catId, at, dwellMs } = req.body;

    // Ignore sub-second blips
    if (!catId || !dwellMs || dwellMs < 1000) {
      return res.status(204).end();
    }

    await Visit.create({
      _id: "visit" + nanoid(),
      cat_id: catId,
      at: at || Date.now(),
      dwell_ms: dwellMs,
    });

    res.status(201).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;