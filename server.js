require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios"); // Import axios for API calls
const CheckoutOrder = require("./models/CheckoutOrder");

const app = express();
app.use(
  cors({
    origin: [
      "https://rolla-frontend.vercel.app",
      "https://rolla-frontend-ekamjot-singhs-projects-bffb6a9b.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
//
// MongoDB Connection
app.get("/api/config", (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID,
  });
});
const uploadRoutes = require("./routes/uploadRoutes"); // Import upload routes
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/defaultdb";
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Failed", err));

app.use("/api", uploadRoutes); // ✅ Integrate the upload API
// Google Maps Address Validation
const validateAddressWithGoogle = async (address) => {
  const GOOGLE_API_KEY = process.env.MAP_API;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${GOOGLE_API_KEY}`;

  console.log("🔍 Checking Address with Google:", url); // ✅ Debugging

  try {
    const response = await axios.get(url);
    console.log("🔹 Google API Response:", response.data); // ✅ Log Response

    if (response.data.status === "OK") {
      const result = response.data.results[0];
      const location = result.geometry.location;
      return {
        formattedAddress: result.formatted_address,
        latitude: location.lat,
        longitude: location.lng,
      };
    } else {
      console.error("❌ Google API Error:", response.data.status);
      return null;
    }
  } catch (error) {
    console.error("❌ Google API Request Failed:", error);
    return null;
  }
};

// Checkout Route - Validate Address and Save Order
app.post("/api/checkout", async (req, res) => {
  try {
    const { cartItems, total, address } = req.body;

    if (
      !address ||
      !address.street ||
      !address.city ||
      !address.postalCode ||
      !address.country
    ) {
      return res
        .status(400)
        .json({ message: "All address fields are required." });
    }

    // Validate Address with Google API
    const validatedAddress = await validateAddressWithGoogle(
      `${address.street}, ${address.city}, ${address.postalCode}, ${address.country}`
    );

    if (!validatedAddress) {
      return res
        .status(400)
        .json({ message: "Invalid address. Please enter a valid one." });
    }

    // Save Order to MongoDB
    const newOrder = new CheckoutOrder({
      items: cartItems.map((item) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        size: item.size || "N/A",
      })),
      totalAmount: total,
      address: {
        street: address.street,
        city: address.city,
        postalCode: address.postalCode,
        country: address.country,
        latitude: validatedAddress.latitude,
        longitude: validatedAddress.longitude,
      },
    });

    await newOrder.save();
    res.status(201).json({
      message: "Order placed successfully!",
      orderId: newOrder._id,
      validatedAddress,
    });
  } catch (error) {
    console.error("Error saving checkout order:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Fetch all checkout orders
app.get("/api/checkout", async (req, res) => {
  try {
    const orders = await CheckoutOrder.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching checkout orders:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
// This is your test secret API key.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const YOUR_DOMAIN =
  "https://rolla-frontend.vercel.app" ||
  "https://rolla-frontend-ekamjot-singhs-projects-bffb6a9b.vercel.app";
app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { cartItems } = req.body;
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: cartItems.map((item) => ({
        price_data: {
          currency: "cad",
          product_data: { name: item.name },
          unit_amount: item.price * 100, // Convert dollars to cents
        },
        quantity: item.quantity,
      })),
      mode: "payment",
      success_url: `${YOUR_DOMAIN}/success`,
      cancel_url: `${YOUR_DOMAIN}/canceled`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
