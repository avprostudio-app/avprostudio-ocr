const express = require("express");
const multer = require("multer");
const vision = require("@google-cloud/vision");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const app = express();
app.use(cors());

const upload = multer({ dest: "uploads/" });

const client = new vision.ImageAnnotatorClient({
  keyFilename: "key.json",
});

function safeUnlink(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

function cleanupGeneratedFiles(dir, prefixBaseName) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.startsWith(prefixBaseName)) {
        safeUnlink(path.join(dir, file));
      }
    }
  } catch (_) {}
}

async function ocrImageFile(imagePath) {
  const [result] = await client.documentTextDetection(imagePath);
  return result?.fullTextAnnotation?.text || "";
}

async function ocrPdfFile(pdfPath) {
  const uploadsDir = path.dirname(pdfPath);
  const baseName = path.basename(pdfPath, path.extname(pdfPath));
  const outputPrefix = path.join(uploadsDir, `${baseName}-page`);

  // Converte ogni pagina PDF in PNG
  execFileSync("pdftoppm", ["-png", pdfPath, outputPrefix]);

  const generatedFiles = fs
    .readdirSync(uploadsDir)
    .filter(
      (file) =>
        file.startsWith(`${baseName}-page`) && file.toLowerCase().endsWith(".png")
    )
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (!generatedFiles.length) {
    throw new Error("Nessuna pagina PNG generata dal PDF.");
  }

  let finalText = "";

  for (const file of generatedFiles) {
    const pagePath = path.join(uploadsDir, file);
    const pageText = await ocrImageFile(pagePath);
    finalText += `${pageText}\n\n`;
  }

  cleanupGeneratedFiles(uploadsDir, `${baseName}-page`);
  return finalText.trim();
}

app.post("/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File mancante" });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname || "";
    const ext = path.extname(originalName).toLowerCase();
    const mime = req.file.mimetype || "";

    console.log("Ricevuto file:", originalName);
    console.log("Mime type:", mime);
    console.log("Path:", filePath);

    let text = "";

    if (mime === "application/pdf" || ext === ".pdf") {
      text = await ocrPdfFile(filePath);
    } else {
      text = await ocrImageFile(filePath);
    }

    safeUnlink(filePath);

    return res.json({ text });
  } catch (error) {
    console.error("OCR ERROR COMPLETO:", error);

    try {
      if (req.file?.path) safeUnlink(req.file.path);
    } catch (_) {}

    return res.status(500).json({
      error: "Errore OCR",
      details: error.message || String(error),
    });
  }
});

app.listen(3000, () => {
  console.log("🔥 OCR server attivo su http://localhost:3000");
});