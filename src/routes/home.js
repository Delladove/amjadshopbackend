const express = require("express");
const Product = require("../models/Product")
const router = express.Router();



router.get("/", (req, res) => {
  res.json({ message: "AMJC Wholesale API is running" });
});

// Product preview page
router.get("/share/:id", async (req, res) => {
  try {
    const p = await Product.findById(req.params.id).lean();

    if (!p)
      return res.status(404).send("Product not found");

    

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">

<title>${p.title_en}</title>

<meta property="og:type" content="website">
<meta property="og:title" content="${p.title_en}">
<meta property="og:description" content="Price: Rs. ${p.unit_price}">
<meta property="og:image" content="${p.img}">
<meta property="og:url" content="${process.env.CORS_ORIGIN}/customer">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${p.title_en}">
<meta name="twitter:description" content="Price: Rs. ${p.unit_price}">
<meta name="twitter:image" content="${p.img}">
<style>
    *{
        margin: 0;
        padding: 0;
    }
    html, body{
        width: 100%;
        min-height: 100vh;
    }
</style>
</head>
<body style="overflow-x: hidden; font-family:Arial; display: flex; justify-content: center; align-items: center;  background-image: linear-gradient(135deg, rgb(255, 68, 56) 0%, rgb(230, 35, 30) 55%, rgb(183, 20, 20) 100%); background-repeat: no-repeat;">
<div style="background-color: #fbf6f2; display: flex; flex-direction: column; gap: 10px; border-radius: 16px; width: 300px; padding:16px">
<h2>${p.title_en}</h2>
<h3 style="text-align: right;">${p.title_ur}</h3>
<div style="background-color: #fde1df; display: flex; justify-content: center; border-radius: 16px;">
    <img src="${p.img}" width="100%" style="border-radius: 16px;">
</div>
<p><strong>Price:</strong> Rs. ${p.unit_price}</p>
<p><strong>Barcode:</strong> ${p.barcode}</p>
</div>
</body>
</html>
`);
  } catch (err) {
    res.status(500).send(err.message);
  }
});


module.exports = router;