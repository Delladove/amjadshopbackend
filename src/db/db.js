const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGO_URI;

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);

    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}

module.exports = connectDB;






