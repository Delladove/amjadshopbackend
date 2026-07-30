const express = require("express");
const Setting = require("../models/Settings");

const router = express.Router();

const DEFAULT_PAYMENT_METHODS = [
  "Cash",
  "Bank transfer",
  "Easypaisa / JazzCash",
];

async function getSetting(key, fallback) {
  const setting = await Setting.findOne({ key });
  return setting ? setting.value : fallback;
}

async function setSetting(key, value) {
  await Setting.findOneAndUpdate(
    { key },
    { value },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
}

// GET /api/settings
router.get("/", async (req, res) => {
  try {
    res.json({
      waNumber: await getSetting("wa_number", ""),
      paymentMethods: DEFAULT_PAYMENT_METHODS,
      paymentMethodImgs: await getSetting("payment_method_imgs", {}),
      business: {
        name: process.env.BUSINESS_NAME || "Amjad Magic Center",
        address:
          process.env.BUSINESS_ADDRESS || "Shah Alam Market Lahore",
        phone: process.env.BUSINESS_PHONE || "03008838824",
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings
router.put("/", async (req, res) => {
  try {
    const { waNumber, paymentMethodImgs } = req.body;

    if (waNumber !== undefined) {
      await setSetting("wa_number", waNumber);
    }

    if (paymentMethodImgs !== undefined) {
      await setSetting(
        "payment_method_imgs",
        paymentMethodImgs
      );
    }

    res.json({
      waNumber: await getSetting("wa_number", ""),
      paymentMethodImgs: await getSetting(
        "payment_method_imgs",
        {}
      ),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;