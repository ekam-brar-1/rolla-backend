const express = require("express");
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Order = require("../models/Order"); // Import Order model

dotenv.config();
const router = express.Router();

// Configure AWS S3
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // Limit file size to 5MB

/**
 * Convert base64 string to Buffer
 */
const base64ToBuffer = (base64) => {
  let arr = base64.split(",");
  let mime = arr[0].match(/:(.*?);/)[1];
  let bstr = atob(arr[1]);
  let u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return { buffer: Buffer.from(u8arr), mime };
};

/**
 * Upload an image to AWS S3
 */
const uploadToS3 = async (buffer, fileName, mimeType) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `uploads/${Date.now()}-${fileName}`,
    Body: buffer,
    ContentType: mimeType,
  };

  await s3.send(new PutObjectCommand(params));

  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
};

/**
 * API to handle file & base64 image uploads and store data in MongoDB
 */
router.post("/upload", upload.array("images"), async (req, res) => {
  try {
    const files = req.files || [];
    const { frontImage, backImage, text, text2 } = req.body; // Base64 images & text inputs

    const uploadedImages = { imageUrl: null, imageUrl2: null };

    // Process uploaded files (binary)
    for (const file of files) {
      const url = await uploadToS3(
        file.buffer,
        file.originalname,
        file.mimetype
      );
      if (!uploadedImages.imageUrl) {
        uploadedImages.imageUrl = url; // Assign first image as front
      } else {
        uploadedImages.imageUrl2 = url; // Assign second image as back
      }
    }

    // Process base64 images
    if (frontImage) {
      const { buffer, mime } = base64ToBuffer(frontImage);
      uploadedImages.imageUrl = await uploadToS3(
        buffer,
        "front_design.png",
        mime
      );
    }

    if (backImage) {
      const { buffer, mime } = base64ToBuffer(backImage);
      uploadedImages.imageUrl2 = await uploadToS3(
        buffer,
        "back_design.png",
        mime
      );
    }

    // Store image URLs & text in MongoDB
    const newOrder = new Order({
      imageUrl: uploadedImages.imageUrl,
      imageUrl2: uploadedImages.imageUrl2,
      text: text || "", // Default to empty if not provided
      text2: text2 || "",
    });

    await newOrder.save();

    res.status(200).json({
      message: "Images uploaded and order stored successfully!",
      order: newOrder,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

module.exports = router;
