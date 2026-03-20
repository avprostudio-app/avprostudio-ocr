const express = require('express');
const multer = require('multer');
const cors = require('cors');
const Tesseract = require('tesseract.js');
const fs = require('fs');

const app = express();
app.use(cors());

const upload = multer({ dest: 'uploads/' });

app.get('/', (req, res) => {
  res.send('OCR server ONLINE 🚀');
});

app.post('/ocr', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File mancante' });
    }

    const filePath = req.file.path;

    const result = await Tesseract.recognize(filePath, 'ita');

    fs.unlinkSync(filePath);

    return res.json({
      text: result.data.text.trim()
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: 'Errore OCR',
      details: err.toString(),
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server OCR su porta ${PORT}`);
});