const express = require("express");
const multer = require("multer");
const path = require("path");
const { nanoid } = require("nanoid");
const { BlobServiceClient } = require("@azure/storage-blob");
const sharp = require("sharp");



const router = express.Router();
const sasToken = process.env.SAS_TOKEN;
const azureAccountName = process.env.AZURE_ACCOUNT_NAME;
const azureContainerName = process.env.AZURE_CONTAINER_NAME;
console.log("CONNECTION_STRING:", process.env.AZURE_STORAGE_CONNECTION_STRING);
console.log("AZURE_CONTAINER_NAME:", process.env.AZURE_CONTAINER_NAME);

console.log("++++++++++++===================================++++++++++++++")
// const blobServiceClient = new BlobServiceClient(
//   `https://${azureAccountName}.blob.core.windows.net?${sasToken}`
// );
const blobServiceClient =
    BlobServiceClient.fromConnectionString(
        process.env.AZURE_STORAGE_CONNECTION_STRING
    );
const containerClient = blobServiceClient.getContainerClient(
    azureContainerName
);

async function uploadImage(file) {
    const filename = `${nanoid()}.webp`;

    const blockBlobClient = containerClient.getBlockBlobClient(filename);
    const resizedBuffer = await sharp(file.buffer)
      .resize({
        width: 800,
        withoutEnlargement: true,
      })
      .webp({
        quality: 85,
      })
      .toBuffer();
    console.log("Uploading Resized Image to Azure Blob Storage:", filename);
    await blockBlobClient.uploadData(resizedBuffer, {
        blobHTTPHeaders: {
            blobContentType: "image/webp",
        },
    });

    return blockBlobClient.url;
}




const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB per file
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image files are allowed"));
    cb(null, true);
  },
});

// POST /api/uploads  (multipart/form-data, field name "file")
// -> { url: "/uploads/xxxx.jpg" }  — save this url on the product/payment record
router.post("/", upload.single("file"), async (req, res) => {
    try {
      if (!req.file)
          return res.status(400).json({ error: "No file uploaded" });


      const url = await uploadImage(req.file);

      res.json({ url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Upload failed" });
    }

});

module.exports = router;
