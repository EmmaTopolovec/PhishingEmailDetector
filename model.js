import * as tf from '@tensorflow/tfjs';

async function loadDataset() {
  const response = await fetch('/mnt/data/job_offers.json');
  const data = await response.json();

  const trainingData = data.map(entry => ({
    text: entry.Text,
    label: Number(entry.Spam)
  })).filter(d => d.text && !isNaN(d.label));

  return trainingData;
}

function preprocessText(text, vocabulary) {
  const words = text.toLowerCase().split(/\s+/);
  const tensor = tf.tensor1d(vocabulary.map(word => words.includes(word) ? 1 : 0));
  return tensor;
}

async function trainModel() {
  const dataset = await loadDataset();
  const vocabulary = ['urgent', 'money', 'transfer', 'immediate', 'payment', 'no', 'experience', 'needed', 'job', 'salary', 'benefits', 'interview', 'remote', 'weekly', 'stipend'];

  const xs = tf.stack(dataset.map(d => preprocessText(d.text, vocabulary)));
  const ys = tf.tensor2d(dataset.map(d => [d.label]), [dataset.length, 1]);

  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 16, inputShape: [vocabulary.length], activation: 'relu' }));
  model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

  model.compile({ optimizer: 'adam', loss: 'binaryCrossentropy', metrics: ['accuracy'] });

  await model.fit(xs, ys, {
    epochs: 100,
    batchSize: 4,
    callbacks: tf.callbacks.earlyStopping({ monitor: 'loss', patience: 10 })
  });

  console.log('Training Complete');
  return model;
}

async function predict(model, text) {
  const vocabulary = ['urgent', 'money', 'transfer', 'immediate', 'payment', 'no', 'experience', 'needed', 'job', 'salary', 'benefits', 'interview', 'remote', 'weekly', 'stipend'];
  const inputTensor = preprocessText(text, vocabulary).reshape([1, vocabulary.length]);
  const prediction = model.predict(inputTensor);
  const result = (await prediction.data())[0];
  return result > 0.5 ? 'Phishing' : 'Legitimate';
}

document.addEventListener('DOMContentLoaded', async () => {
  const model = await trainModel();
  const inputField = document.getElementById('emailText');
  const resultDiv = document.getElementById('result');
  const predictButton = document.getElementById('predictBtn');

  predictButton.addEventListener('click', async () => {
    const text = inputField.value;
    if (text.trim() === '') {
      resultDiv.innerText = 'Please enter email text.';
      return;
    }
    const prediction = await predict(model, text);
    resultDiv.innerText = `Prediction: ${prediction}`;
  });
});

document.body.innerHTML = `
  <div style="text-align: center; font-family: Arial; margin-top: 50px;">
    <h2>Phishing Email Detector</h2>
    <textarea id="emailText" rows="4" cols="50" placeholder="Enter email text"></textarea><br><br>
    <button id="predictBtn">Check</button>
    <p id="result"></p>
  </div>
`;
