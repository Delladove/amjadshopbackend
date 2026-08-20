const express = require("express");
const { nanoid } = require("nanoid");

const Visit = require("../models/Visit");

const router = express.Router();

// POST /api/visits
// { catId, at, dwellMs }
router.post("/", async (req, res) => {
  try {
    console.log("in Visit")
    const { catId, at, dwellMs } = req.body;

    // Ignore sub-second blips
    if (!catId || !dwellMs || dwellMs < 1000) {
      console.log("in 204 status")
      return res.status(204).json({ok:"ok"});
    }

    await Visit.create({
      _id: "visit" + nanoid(),
      cat_id: catId,
      at: at || Date.now(),
      dwell_ms: dwellMs,
    });
    console.log("Sending back 201 end().")
    res.status(201).json({ok:"ok"});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;