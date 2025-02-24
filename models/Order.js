const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  imageUrl: { type: String, default: null }, // Store front image URL if provided
  imageUrl2: { type: String, default: null }, // Store back image URL if provided
  text: { type: String, default: "" }, // First text input
  text2: { type: String, default: "" }, // Second text input
  createdAt: { type: Date, default: Date.now }, // Automatically set timestamp
});

module.exports = mongoose.model("Order", OrderSchema);
