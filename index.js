const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

const upload = multer({ dest: 'uploads/' });

app.get('/', (req, res) => {
  res.send('OCR server locale attivo');
});

app.post('/ocr', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File mancante' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
 
    let images = [];

    if (ext === '.pdf') {
      const baseName = filePath;

      await new Promise((resolve, reject) => {
        exec(`pdftoppm "${filePath}" "${baseName}" -png`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const files = fs.readdirSync('./uploads');
      images = files
        .filter(
          (f) =>
            f.startsWith(path.basename(baseName)) &&
            f.toLowerCase().endsWith('.png')
        )
        .map((f) => `./uploads/${f}`);
    } else {
      images = [filePath];
    }

    let fullText = '';

    for (const img of images) {
      await new Promise((resolve, reject) => {
        exec(`tesseract "${img}" "${img}_out" -l ita`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const text = fs.readFileSync(`${img}_out.txt`, 'utf8');
      fullText += text + '\n';
    }

    return res.json({ text: fullText.trim() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: 'Errore OCR',
      details: err.toString(),
    });
  }
});

app.listen(3000, () => {
  console.log('Server OCR locale su http://localhost:3000');
});