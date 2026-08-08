// routes/whatsapp.js
const express = require("express");
const { nanoid } = require("nanoid");
const Order = require("../models/Order")
const Product = require("../models/Product")
const router = express.Router();



router.get("/", (req, res) => {
  res.json({ message: "AMJC Wholesale API is running" });
});

// GET /webhook
// Meta uses this to verify your webhook
router.get("/webhook", (req, res) => {
  console.log("GET /webhook")
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  console.log("mode", mode)
  console.log("token", token)
  console.log("process.env.WHATSAPP_VERIFY_TOKEN ", process.env.WHATSAPP_VERIFY_TOKEN)

  if (
    mode === "subscribe" &&
    token === (process.env.WHATSAPP_VERIFY_TOKEN || "amjc_whatsapp_webhook_2026")
  ) {

    console.log("WhatsApp webhook verified");

    return res.status(200).send(challenge);
  }

  console.log("WhatsApp webhook verification failed");

  return res.sendStatus(403);
});


// POST /webhook
// Meta sends incoming WhatsApp messages here
// router.post("/webhook", async (req, res) => {
//   console.log("POST /webhook")
//   try {
//     console.log(
//       "WhatsApp webhook:",
//       JSON.stringify(req.body, null, 2)
//     );

//     const body = req.body;

//     // Make sure this is a WhatsApp webhook
//     if (body.object !== "whatsapp_business_account") {
//       return res.sendStatus(404);
//     }

//     // Meta expects a successful response
//     return res.sendStatus(200);

//   } catch (error) {
//     console.error(
//       "WhatsApp webhook error:",
//       error
//     );

//     return res.sendStatus(500);
//   }
// });


function extractQuantity(text) {
  // Now find the first number
  const match = text.match(/\b(\d+(?:\.\d+)?)\b/);
  if (!match) {
    return 1;
  }
  const quantity = Number(match[1]);
  return quantity > 0 ? quantity : 1;
}

function extractProductId(text) {
  const match = text.match(
    /\/api\/products\/product\/([A-Za-z0-9_-]+)/
  );

  return match ? match[1] : null;
}

function recalculateOrder(order) {
  order.subtotal = order.items.reduce(
    (sum, item) => sum + item.line_total,
    0
  );
  order.discount = Number(order.discount) || 0;
  order.total = order.subtotal - order.discount;
}

router.post("/webhook", async (req, res) => {
  console.log("POST /webhook");
  try {
    console.log(
      "WhatsApp webhook:",
      JSON.stringify(req.body, null, 2)
    );

    const entries = req.body?.entry || [];

    for (const entry of entries) {
      const changes = entry?.changes || [];

      for (const change of changes) {
        if (change?.field !== "messages") {
          continue;
        }

        const value = change.value;
        const messages = value?.messages || [];

        for (const message of messages) {
          // Only process text messages
          if (message.type !== "text") {
            continue;
          }
          const wa_name = (value?.contacts[0]).profile?.name;
          const phone = message.from || "";
          const messageBody = message.text?.body || "";

          console.log("Incoming message:", {
            phone,
            messageBody,
          });

          // ---------------------------------------------
          // Extract product
          // ---------------------------------------------
          let order = await Order.findOne({
            phone,
            status: "new",
          });

          const productId = extractProductId(messageBody);
          const url_removed_body = messageBody.replace(/https?:\/\/\S+/gi, "");
          if (!productId) {
            console.log("No product URL found");
            if (order){
              order.notes = `${order.notes || ""}\n---\n${url_removed_body}`;
              await order.save();
            }
            continue;
          }

          // ---------------------------------------------
          // Extract quantity
          // ---------------------------------------------

          const quantity = extractQuantity(url_removed_body);

          console.log("Product:", productId);
          console.log("Quantity:", quantity);

          // ---------------------------------------------
          // Find product
          // ---------------------------------------------

          const product = await Product.findById(productId);

          if (!product) {
            console.log("Product not found:", productId);
            continue;
          }


          // ---------------------------------------------
          // CREATE NEW ORDER
          // ---------------------------------------------

          if (!order) {
            const now = Date.now();
            order = new Order({
              _id: nanoid(),

              bill_type: "Booking",
              status: "new",

              customer: wa_name ? (wa_name + "Whatsapp_user") : "Whatsapp_user",
              phone,
              city: "Lahore",

              payment: "Cash",
              notes: url_removed_body,

              cargo: null,

              subtotal: quantity * product.unit_price,
              discount: 0,
              total: quantity * product.unit_price,

              items: [
                {
                  id: nanoid(),
                  product_id: product._id,
                  title_en: product.title_en,
                  title_ur: product.title_ur,
                  qty: quantity,
                  unit_price: product.unit_price,
                  custom: null,
                  line_total: product.unit_price * quantity,
                }
              ],

              payments: [
                {
                  id: nanoid(),
                  amt: 0,
                  method: "cash",
                  receipt_img: "",
                  at: now,
                },
              ],

              created_at: now,
              updated_at: now,
            });
          }
          else {
            // Different product -> add new item
            order.items.push({
              id: nanoid(),

              product_id: product._id,

              title_en: product.title_en,
              title_ur: product.title_ur || "",

              qty: quantity,

              unit_price: product.unit_price,

              custom: null,

              line_total: product.unit_price * quantity,
            });
            recalculateOrder(order);
            order.updated_at = Date.now();
            order.notes = `${order.notes || ""}\n---\n${url_removed_body}`;
          }
          await order.save();
          console.log("WhatsApp order saved:", order._id);
          console.log("Items:", order.items);
          console.log("Total:", order.total);
          console.log("Final order", order);
        }
      }
    }

    // Always acknowledge Meta
    return res.sendStatus(200);

  } catch (error) {
    console.error("WhatsApp webhook error:", error);

    return res.sendStatus(500);
  }
});


module.exports = router;