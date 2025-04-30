async function getEmailListByIds(accessToken) {
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages",
    {
      headers: {
        "Content-type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const toJson = await res.json();
  console.log("toJson =", toJson);
  const pageEmalIds = toJson.messages.slice(0, 5).map((message) => message.id);

  const emails = [];

  for (let i = 0; i < pageEmalIds.length; i++) {
    const getMessage = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${pageEmalIds[i]}`,
      {
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const emailJson = await getMessage.json();
    emails.push(emailJson);
  }

  return emails;
}

function decodeEmailBody(encodedData) {
  if (!encodedData) return "";
  const base64 = encodedData.replace(/-/g, "+").replace(/_/g, "/");
  const decodedStr = atob(base64);
  return decodedStr;
}
//const vocabulary = ['urgent', 'money', 'transfer', 'immediate', 'payment', 'no', 'experience', 'needed', 'job', 'salary', 'benefits', 'interview', 'remote', 'weekly', 'stipend'];
const vocabulary = [
    "urgent",
    "money",
    "immediate",
    "job",
    "salary",
    "interview",
    "remote",
    "remotely",
    "weekly",
    "stipend",
    "research",
    "application",
    "internship",
    "financial",
    "apply",
    "limited",
    "soon",
    "first-come",
    "pay",
    "flexible",
    "sa",
    "button",
		  "today",
		  "research",
		  "event",
	  	"bengaged",
	  	"deadline",
	  	"unsubscribe"
		
    
				];

function preprocessText(text, vocabulary) {
  const words = text.toLowerCase().split(/\s+/);
  const tensor = tf.tensor1d(
    vocabulary.map((word) => (words.includes(word) ? 1 : 0))
  );
  return tensor;
}

async function loadDataset() {
  const response = await fetch("./job_offers.json");
  const data = await response.json();

  const trainingData = data
    .map((entry) => ({
      text: entry.Text,
      label: Number(entry.Spam),
    }))
    .filter((d) => d.text && !isNaN(d.label));

  return trainingData;
}
async function trainModel() {
  const dataset = await loadDataset();

  const xs = tf.stack(dataset.map((d) => preprocessText(d.text, vocabulary)));
  const ys = tf.tensor2d(
    dataset.map((d) => [d.label]),
    [dataset.length, 1]
  );

  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      units: 16,
      inputShape: [vocabulary.length],
      activation: "relu",
    })
  );
  model.add(
    tf.layers.dense({ units: 16, inputShape: [12], activation: "relu" })
  );
  model.add(tf.layers.dense({ units: 8, activation: "relu" }));
  model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));

  model.compile({
    optimizer: "adam",
    loss: "binaryCrossentropy",
    metrics: ["accuracy"],
  });

  await model.fit(xs, ys, {
    epochs: 100,
    batchSize: 4,
    callbacks: tf.callbacks.earlyStopping({ monitor: "loss", patience: 10 }),
  });

  console.log("done w da training");
  return model;
}

async function predict(model, text) {
  const preprocessed = preprocessText(text, vocabulary);
  const inputTensor = tf.reshape(preprocessed, [1, vocabulary.length]);
  const prediction = model.predict(inputTensor);
  const result = (await prediction.data())[0];
  return result;
}

window.onload = async function () {
		await tf.setBackend("cpu");
  await tf.ready();
  console.log("We got da backend");
  document.body.innerHTML = `
    <div style="text-align: center; font-family: Arial; margin-top: 20px;">
      <h2>Gmail Phishing Detector</h2>
      <button id="fetchEmails">Get Emails</button>
      <div id="emailsList" style="margin-top: 20px;"></div>
    </div>
  `;

  const emailsListDiv = document.getElementById("emailsList");
  const fetchButton = document.getElementById("fetchEmails");

  console.log("Training model...");
  const model = await trainModel();
  console.log("Model training complete");

  fetchButton.addEventListener("click", async function () {
    fetchButton.disabled = true;
    fetchButton.textContent = "Loading...";
    emailsListDiv.innerHTML = "<p>Loading emails...</p>";

    chrome.identity.getAuthToken({ interactive: true }, async function (token) {
      console.log("token =", token);
      try {
        const list = await getEmailListByIds(token);
        emailsListDiv.innerHTML = "";

        for (let i = 0; i < list.length; i++) {
          const current = list[i];
          const snippet = current.snippet || "";
          const sender =
            current.payload.headers.find((header) => header.name === "From")
              ?.value || "Unknown";
          const receiver =
            current.payload.headers.find(
              (header) => header.name === "Delivered-To"
            )?.value || "Unknown";
          let body = "";
          if (
            current.payload.parts &&
            current.payload.parts[0] &&
            current.payload.parts[0].body
          ) {
              body = decodeEmailBody(current.payload.parts[0].body.data || "");
          } else if (current.payload.body && current.payload.body.data) {
            body = decodeEmailBody(current.payload.body.data);
          }
          const emailContent = `${snippet} ${body}`;
          const predictionVal = await predict(model, emailContent);
										prediction = (predictionVal > 0.5) ? "Phishing" : "Innocent";
	    
          const div = document.createElement("div");
          div.style.border = (prediction === "Phishing") ? "2px solid red" : "2px solid green";
          div.style.padding = "10px";
          div.style.margin = "10px 0";
          div.style.borderRadius = "5px";

          const pPrediction = document.createElement("p");
          pPrediction.innerHTML = `<strong>Prediction: ${predictionVal}</strong>`;
          pPrediction.style.color = prediction === "Phishing" ? "red" : "green";
          div.appendChild(pPrediction);

          const pSender = document.createElement("p");
          pSender.innerHTML = `<strong>From:</strong> ${sender}`;
          div.appendChild(pSender);

          const pReceiver = document.createElement("p");
          pReceiver.innerHTML = `<strong>To:</strong> ${receiver}`;
          div.appendChild(pReceiver);

          const pSnippet = document.createElement("p");
          pSnippet.innerHTML = `<strong>Preview:</strong> ${snippet}`;
          div.appendChild(pSnippet);

          const pBody = document.createElement("details");
          const summary = document.createElement("summary");
          summary.textContent = "Email Body";
          pBody.appendChild(summary);
          const bodyContent = document.createElement("div");
          bodyContent.style.whiteSpace = "pre-wrap";
          bodyContent.textContent = body;
          pBody.appendChild(bodyContent);
          div.appendChild(pBody);

          emailsListDiv.appendChild(div);
        }
      } catch (error) {
        console.error("Error fetching emails:", error);
        emailsListDiv.innerHTML = `<p style="color: red">Error fetching emails: ${error.message}</p>`;
      } finally {
        fetchButton.disabled = false;
        fetchButton.textContent = "Fetch and Analyze Emails";
      }
    });
  });
};
