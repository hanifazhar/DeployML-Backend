const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { predictCancer } = require('./handler.js');
const { Firestore } = require('@google-cloud/firestore');

// Konfigurasi Firestore
const firestore = new Firestore({
  keyFilename: 'firebase_cred.json', // Pastikan file ini ada di root aplikasi Anda
});

// Fungsi menyimpan data ke Firestore
async function savePredictionToFirestore(predictionData) {
  console.log("Saving prediction to Firestore...");
  console.log("Prediction Data:", predictionData);

  const docRef = firestore.collection('predictions').doc(predictionData.id);
  await docRef.set(predictionData); // Simpan data hasil prediksi ke Firestore
  console.log("Prediction saved successfully!");
}

// Mulai aplikasi Express
const app = express();
const port = 8080;
const host = '0.0.0.0';

// Konfigurasi CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Konfigurasi Multer untuk upload file
const upload = multer({
  limits: { fileSize: 1000000 }, // Maksimum 1MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'));
    }
    cb(null, true);
  }
}).single('image');

app.get('/', (req, res) => {
  res.send("Welcome to ML Dicoding API");
});

// Endpoint prediksi
app.post('/predict', (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          status: 'fail',
          message: 'Payload content length greater than maximum allowed: 1000000',
        });
      }
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid file upload',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No file uploaded',
      });
    }

    try {
      const result = await predictCancer(req.file.buffer);

      const predictionData = {
        id: uuidv4(),
        result: result === 'Cancer' ? 'Cancer' : 'Non-cancer',
        suggestion: result === 'Cancer' ? 'Segera periksa ke dokter!' : 'Penyakit kanker tidak terdeteksi.',
        createdAt: moment().toISOString(),
      };

      await savePredictionToFirestore(predictionData);

      res.status(201).json({
        status: 'success',
        message: 'Model is predicted successfully',
        data: predictionData,
      });
    } catch (error) {
      console.error('Prediction error:', error);
      res.status(400).json({
        status: 'fail',
        message: 'Terjadi kesalahan dalam melakukan prediksi',
      });
    }
  });
});

// Endpoint riwayat prediksi
app.get('/predict/histories', async (req, res) => {
  try {
    const snapshot = await firestore.collection('predictions').get();

    if (snapshot.empty) {
      return res.status(404).json({
        status: 'fail',
        message: 'No predictions found',
      });
    }

    const histories = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        history: {
          result: data.result,
          createdAt: data.createdAt,
          suggestion: data.suggestion,
        },
      };
    });

    res.status(200).json({
      status: 'success',
      data: histories,
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(400).json({
      status: 'fail',
      message: 'Terjadi kesalahan dalam melakukan prediksi',
    });
  }
});

// **Endpoint uji dengan data dummy**
app.get('/test-firestore', async (req, res) => {
  try {
    const dummyData = {
      id: 'test-id',
      result: 'dummy-result',
      suggestion: 'This is a dummy suggestion.',
      createdAt: new Date().toISOString(),
    };

    console.log("Testing Firestore with dummy data:", dummyData);

    const docRef = firestore.collection('predictions').doc(dummyData.id);
    await docRef.set(dummyData);

    console.log("Dummy data saved successfully to Firestore!");
    res.status(200).json({
      status: 'success',
      message: 'Firestore test successful',
      data: dummyData,
    });
  } catch (error) {
    console.error("Error during Firestore test:", error.message);
    res.status(500).json({
      status: 'fail',
      message: 'Firestore test failed',
      error: error.message,
    });
  }
});

// Jalankan server
app.listen(port, host, () => {
  console.log(`Server is running on ${host}:${port}`);
});
