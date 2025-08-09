const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Crear directorios si no existen
const uploadsDir = './public/uploads';
const processedDir = './public/processed';

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(processedDir)) {
  fs.mkdirSync(processedDir, { recursive: true });
}

// Configuración de multer para carga de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|bmp|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'));
    }
  }
});

// Rutas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Subir imagen
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const imageInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      path: `/uploads/${req.file.filename}`
    };

    res.json({ success: true, image: imageInfo });
  } catch (error) {
    res.status(500).json({ error: 'Error al subir la imagen' });
  }
});

// Aplicar filtros
app.post('/api/filter', async (req, res) => {
  try {
    const { filename, filter, value } = req.body;
    const inputPath = path.join(uploadsDir, filename);
    const outputFilename = `filtered-${Date.now()}-${filename}`;
    const outputPath = path.join(processedDir, outputFilename);

    let sharpInstance = sharp(inputPath);

    switch (filter) {
      case 'brightness':
        sharpInstance = sharpInstance.modulate({ brightness: parseFloat(value) });
        break;
      case 'contrast':
        sharpInstance = sharpInstance.modulate({ brightness: 1, saturation: 1, hue: 0 });
        break;
      case 'saturation':
        sharpInstance = sharpInstance.modulate({ saturation: parseFloat(value) });
        break;
      case 'blur':
        sharpInstance = sharpInstance.blur(parseFloat(value));
        break;
      case 'sharpen':
        sharpInstance = sharpInstance.sharpen();
        break;
      case 'grayscale':
        sharpInstance = sharpInstance.grayscale();
        break;
      case 'sepia':
        sharpInstance = sharpInstance.tint({ r: 255, g: 240, b: 196 });
        break;
      case 'negative':
        sharpInstance = sharpInstance.negate();
        break;
      default:
        return res.status(400).json({ error: 'Filtro no válido' });
    }

    await sharpInstance.toFile(outputPath);

    res.json({ 
      success: true, 
      processedImage: `/processed/${outputFilename}` 
    });
  } catch (error) {
    console.error('Error aplicando filtro:', error);
    res.status(500).json({ error: 'Error al aplicar el filtro' });
  }
});

// Redimensionar imagen
app.post('/api/resize', async (req, res) => {
  try {
    const { filename, width, height } = req.body;
    const inputPath = path.join(uploadsDir, filename);
    const outputFilename = `resized-${Date.now()}-${filename}`;
    const outputPath = path.join(processedDir, outputFilename);

    await sharp(inputPath)
      .resize(parseInt(width), parseInt(height))
      .toFile(outputPath);

    res.json({ 
      success: true, 
      processedImage: `/processed/${outputFilename}` 
    });
  } catch (error) {
    console.error('Error redimensionando:', error);
    res.status(500).json({ error: 'Error al redimensionar la imagen' });
  }
});

// Rotar imagen
app.post('/api/rotate', async (req, res) => {
  try {
    const { filename, angle } = req.body;
    const inputPath = path.join(uploadsDir, filename);
    const outputFilename = `rotated-${Date.now()}-${filename}`;
    const outputPath = path.join(processedDir, outputFilename);

    await sharp(inputPath)
      .rotate(parseInt(angle))
      .toFile(outputPath);

    res.json({ 
      success: true, 
      processedImage: `/processed/${outputFilename}` 
    });
  } catch (error) {
    console.error('Error rotando:', error);
    res.status(500).json({ error: 'Error al rotar la imagen' });
  }
});

// Recortar imagen
app.post('/api/crop', async (req, res) => {
  try {
    const { filename, x, y, width, height } = req.body;
    const inputPath = path.join(uploadsDir, filename);
    const outputFilename = `cropped-${Date.now()}-${filename}`;
    const outputPath = path.join(processedDir, outputFilename);

    await sharp(inputPath)
      .extract({ 
        left: parseInt(x), 
        top: parseInt(y), 
        width: parseInt(width), 
        height: parseInt(height) 
      })
      .toFile(outputPath);

    res.json({ 
      success: true, 
      processedImage: `/processed/${outputFilename}` 
    });
  } catch (error) {
    console.error('Error recortando:', error);
    res.status(500).json({ error: 'Error al recortar la imagen' });
  }
});

// Guardar canvas como imagen
app.post('/api/save-canvas', (req, res) => {
  try {
    const { imageData, format = 'png' } = req.body;
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const filename = `canvas-${Date.now()}.${format}`;
    const outputPath = path.join(processedDir, filename);
    
    fs.writeFileSync(outputPath, buffer);
    
    res.json({ 
      success: true, 
      savedImage: `/processed/${filename}` 
    });
  } catch (error) {
    console.error('Error guardando canvas:', error);
    res.status(500).json({ error: 'Error al guardar la imagen' });
  }
});

// Manejo de errores
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande' });
    }
  }
  res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});