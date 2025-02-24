const mongoose = require("mongoose");

const CheckoutOrderSchema = new mongoose.Schema({
  items: [
    {
      name: String,
      price: Number,
      quantity: Number,
      size: String, // Include size for clothing if applicable
    },
  ],
  totalAmount: Number,
  address: {
    street: String,
    city: String,
    postalCode: String,
    country: String,
    latitude: Number,
    longitude: Number,
  },
  createdAt: { type: Date, default: Date.now }, // Timestamp for the order
});

module.exports = mongoose.model("CheckoutOrder", CheckoutOrderSchema);
