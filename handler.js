const tf = require('@tensorflow/tfjs-node');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// Baca kredensial dari file JSON
const fileContent = fs.readFileSync('bucket_cred.json', 'utf-8');
const gcloudCreds = JSON.parse(fileContent);

// Inisialisasi Google Cloud Storage
const storage = new Storage({
  credentials: gcloudCreds,
  projectId: gcloudCreds.project_id,
});

const BUCKET_NAME = 'buckets-ml';
const MODEL_PATH = 'data'; // Lokasi model di bucket GCS

let model;

const loadModel = async () => {
  if (model) return model;

  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  try {
    console.log("Downloading model.json from GCS...");
    const modelJsonPath = path.join(tempDir, 'model.json');
    await storage.bucket(BUCKET_NAME).file(`${MODEL_PATH}/model.json`).download({ destination: modelJsonPath });

    console.log("Downloading shard files from GCS...");
    const shardFiles = await storage.bucket(BUCKET_NAME).getFiles({ prefix: `${MODEL_PATH}/group1-shard` });
    await Promise.all(
      shardFiles[0].map((file) =>
        file.download({ destination: path.join(tempDir, path.basename(file.name)) })
      )
    );

    console.log("Loading model into TensorFlow.js...");
    model = await tf.loadGraphModel(`file://${modelJsonPath}`);
    console.log("Model loaded successfully.");
  } catch (error) {
    console.error("Error loading model:", error.message);
    throw new Error("Failed to load model");
  }

  return model;
};

const preprocessImage = (imageBuffer) => {
  console.log("Preprocessing image...");
  return tf.node.decodeImage(imageBuffer)
    .resizeBilinear([224, 224])
    .expandDims(0)
    .div(255.0);
};

const predictCancer = async (imageBuffer) => {
  const model = await loadModel();
  const imageTensor = preprocessImage(imageBuffer);
  console.log("Running prediction...");
  const predictions = model.predict(imageTensor);
  const predictionData = predictions.dataSync();
  console.log("Prediction data:", predictionData);

  const threshold = 0.58;
  const result = predictionData[0];
  return result > threshold ? 'Cancer' : 'Non-cancer';
};

module.exports = { predictCancer };
