require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
console.log("PORT", process.env.PORT)

const connectDB = require("./db/db");
const categoriesRoutes = require("./routes/categories");
const productsRoutes = require("./routes/products");
const ordersRoutes = require("./routes/orders");
const paymentsRoutes = require("./routes/payments");
const barcodesRoutes = require("./routes/barcodes");
const settingsRoutes = require("./routes/settings");
const dashboardRoutes = require("./routes/dashboard");
const uploadsRoutes = require("./routes/uploads");
const visitsRoutes = require("./routes/visits");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN)
  .split(",")
  .map((s) => s.trim());
app.use(cors({ origin: allowedOrigins }));


app.use(express.json({ limit: "15mb" })); // generous limit; product photos go through /uploads, not JSON


app.get("/api/health", (req, res) => res.json({ ok: true, time: Date.now() }));

app.use("/api/categories", categoriesRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/orders", ordersRoutes);       // also mounts /api/orders/:id/payments (see payments.js)
app.use("/api/orders", paymentsRoutes);
app.use("/api/barcodes", barcodesRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/visits", visitsRoutes);

// centralized error handler — keeps every route's try/catch simple
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

async function startServer() {
  await connectDB();
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`AMJC Wholesale API running on http://localhost:${PORT}`);
  });
}

startServer();