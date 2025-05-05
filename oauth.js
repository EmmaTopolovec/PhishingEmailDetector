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

async function createLabelsIfNeeded(accessToken) {
  try {
    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/labels",
      {
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const labelsData = await response.json();

    if (labelsData.error) {
      console.error("Error fetching labels:", labelsData.error);
      return {};
    }

    const existingLabels = labelsData.labels || [];

    const labelsToCreate = [
      {
        name: "Phishing!",
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
        color: {
          backgroundColor: "#822111",
          textColor: "#ffffff",
        },
      },
      {
        name: "SUS!",
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
        color: {
          backgroundColor: "#a46a21",
          textColor: "#ffffff",
        },
      },
      {
        name: "Safe!",
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
        color: {
          backgroundColor: "#076239",
          textColor: "#ffffff",
        },
      },
    ];
    const labelIds = {};

    for (const labelToCreate of labelsToCreate) {
      try {
        const existingLabel = existingLabels.find(
          (label) => label.name === labelToCreate.name
        );

        if (existingLabel) {
          console.log(
            `Label ${labelToCreate.name} already exists with ID: ${existingLabel.id}`
          );
          labelIds[labelToCreate.name] = existingLabel.id;
        } else {
          // create
          const createResponse = await fetch(
            "https://gmail.googleapis.com/gmail/v1/users/me/labels",
            {
              method: "POST",
              headers: {
                "Content-type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(labelToCreate),
            }
          );

          const newLabel = await createResponse.json();

          if (newLabel.error) {
            console.error(
              `Error creating label ${labelToCreate.name}:`,
              newLabel.error
            );
            continue;
          }

          console.log(
            `Created new label: ${newLabel.name} with ID: ${newLabel.id}`
          );
          labelIds[labelToCreate.name] = newLabel.id;
        }
      } catch (labelError) {
        console.error(
          `Error processing label ${labelToCreate.name}:`,
          labelError
        );
      }
    }

    return labelIds;
  } catch (error) {
    console.error("Error in createLabelsIfNeeded:", error);
    return {};
  }
}

async function applyLabelToEmail(accessToken, emailId, labelId) {
  try {
    if (!labelId) {
      console.warn(
        `Skipping label application for email ${emailId} - no valid label ID provided`
      );
      return { success: false, error: "No valid label ID" };
    }

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/modify`,
      {
        method: "POST",
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          addLabelIds: [labelId],
        }),
      }
    );

    const result = await response.json();

    if (result.error) {
      console.error(`Error applying label to email ${emailId}:`, result.error);
      return { success: false, error: result.error };
    }

    return { success: true, result };
  } catch (error) {
    console.error(`Error in applyLabelToEmail for ${emailId}:`, error);
    return { success: false, error: error.message };
  }
}

function decodeEmailBody(encodedData) {
  if (!encodedData) return "";
  const base64 = encodedData.replace(/-/g, "+").replace(/_/g, "/");
  const decodedStr = atob(base64);
  return decodedStr;
}

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
  "unsubscribe",
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
  try {
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
    model.add(tf.layers.dense({ units: 16, activation: "relu" }));
    model.add(tf.layers.dense({ units: 8, activation: "relu" }));
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));

    model.compile({
      optimizer: "adam",
      loss: "binaryCrossentropy",
      metrics: ["accuracy"],
    });

    await model.fit(xs, ys, {
      epochs: 25,
      batchSize: 4,
      callbacks: tf.callbacks.earlyStopping({ monitor: "loss", patience: 3 }),
    });

    console.log("done w da training");
    return model;
  } catch (error) {
    console.error("Error training model:", error);
  }
}

async function predict(model, text) {
  const preprocessed = preprocessText(text, vocabulary);
  const inputTensor = tf.reshape(preprocessed, [1, vocabulary.length]);
  const prediction = model.predict(inputTensor);
  const result = (await prediction.data())[0];
  return result;
}

function getPredictionCategory(score) {
  if (score > 0.9) {
    return {
      category: "Phishing",
      labelName: "Phishing!",
      color: "#DB4437",
    };
  } else if (score > 0.7) {
    return {
      category: "Suspicious",
      labelName: "SUS!",
      color: "#F4B400",
    };
  } else {
    return {
      category: "Safe",
      labelName: "Safe!",
      color: "#0F9D58",
    };
  }
}

window.onload = async function () {
  await tf.setBackend("cpu");
  await tf.ready();
  console.log("We got da backend");
  document.body.innerHTML = `
    <div style="text-align: center; font-family: Arial; margin-top: 20px;">
      <h2>Gmail Phishing Detector</h2>
      <div style="margin: 20px 0;">
        <button id="analyzeEmails">Analyze Emails</button>
      </div>
      <div id="statusMessage" style="margin: 10px 0; font-weight: bold;"></div>
      <div id="emailsList" style="margin-top: 20px;"></div>
    </div>
  `;

  const emailsListDiv = document.getElementById("emailsList");
  const analyzeButton = document.getElementById("analyzeEmails");
  const statusMessage = document.getElementById("statusMessage");

  let labelIds = {};

  console.log("Training model...");
  const model = await trainModel();
  console.log("Model training complete");

  analyzeButton.addEventListener("click", async function () {
    analyzeButton.disabled = true;
    analyzeButton.textContent = "Processing...";
    emailsListDiv.innerHTML = "";
    statusMessage.textContent = "Setting up labels...";
    statusMessage.style.color = "blue";

    chrome.identity.getAuthToken(
      {
        interactive: true,
        scopes: [
          "https://www.googleapis.com/auth/gmail.labels",
          "https://www.googleapis.com/auth/gmail.modify",
          "https://www.googleapis.com/auth/gmail.readonly",
        ],
      },
      async function (token) {
        if (chrome.runtime.lastError) {
          statusMessage.textContent = `Auth Error: ${chrome.runtime.lastError.message}`;
          statusMessage.style.color = "red";
          analyzeButton.disabled = false;
          analyzeButton.textContent = "Analyze Emails";
          return;
        }

        console.log("token =", token);

        try {
          statusMessage.textContent = "Creating Gmail labels...";
          labelIds = await createLabelsIfNeeded(token);
          console.log("Label IDs created:", labelIds);

          if (Object.keys(labelIds).length === 0) {
            statusMessage.textContent = "Failed to create labels.";
            statusMessage.style.color = "red";
            analyzeButton.disabled = false;
            analyzeButton.textContent = "Analyze Emails";
            return;
          }
          statusMessage.textContent = "Loading emails...";
          const list = await getEmailListByIds(token);

          if (!list || !list.length) {
            statusMessage.textContent =
              "No emails found or error retrieving emails";
            statusMessage.style.color = "orange";
            analyzeButton.disabled = false;
            analyzeButton.textContent = "Analyze Emails";
            return;
          }

          statusMessage.textContent = `Analyzing ${list.length} emails...`;

          for (let i = 0; i < list.length; i++) {
            const current = list[i];
            const emailId = current.id;
            const snippet = current.snippet || "";
            const sender =
              current.payload.headers.find((header) => header.name === "From")
                ?.value || "Unknown";
            const subject =
              current.payload.headers.find(
                (header) => header.name === "Subject"
              )?.value || "No Subject";
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

            const emailContent = `${subject} ${snippet} ${body}`;
            const predictionScore = await predict(model, emailContent);
            const predictionInfo = getPredictionCategory(predictionScore);
            let labelStatus = "Not labeled";

            if (labelIds[predictionInfo.labelName]) {
              const labelResult = await applyLabelToEmail(
                token,
                emailId,
                labelIds[predictionInfo.labelName]
              );

              labelStatus = labelResult.success
                ? `Label "${predictionInfo.labelName}" applied`
                : `Label application failed: ${
                    labelResult.error?.message ||
                    JSON.stringify(labelResult.error)
                  }`;

              console.log(`Label status for ${emailId}:`, labelStatus);
            } else {
              console.warn(
                `Label ID for ${predictionInfo.labelName} not found.`
              );
              labelStatus = "Label not found";
            }

            const div = document.createElement("div");
            div.style.border = `2px solid ${predictionInfo.color}`;
            div.style.padding = "10px";
            div.style.margin = "10px 0";
            div.style.borderRadius = "5px";

            const pPrediction = document.createElement("p");
            pPrediction.innerHTML = `<strong>Detection: ${
              predictionInfo.category
            }</strong> (Score: ${predictionScore.toFixed(3)})`;
            pPrediction.style.color = predictionInfo.color;
            div.appendChild(pPrediction);

            const pLabel = document.createElement("p");
            pLabel.innerHTML = `<strong>Label Status:</strong> ${labelStatus}`;
            div.appendChild(pLabel);

            const pSender = document.createElement("p");
            pSender.innerHTML = `<strong>From:</strong> ${sender}`;
            div.appendChild(pSender);

            const pSubject = document.createElement("p");
            pSubject.innerHTML = `<strong>Subject:</strong> ${subject}`;
            div.appendChild(pSubject);

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

          statusMessage.textContent = `Analysis complete for ${list.length} emails`;
          statusMessage.style.color = "green";
        } catch (error) {
          console.error("Error processing:", error);
          statusMessage.textContent = `Error: ${error.message}`;
          statusMessage.style.color = "red";
          emailsListDiv.innerHTML = `<p style="color: red">Error: ${error.message}</p>`;
        } finally {
          analyzeButton.disabled = false;
          analyzeButton.textContent = "Analyze Emails";
        }
      }
    );
  });
};
