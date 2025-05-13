# Phishing Email Detector for Binghamton University Students  

### Created by Akhilan Jeyaraj, Caleb Lai, Dimitra Pando, and Zak Sujkovic
### Supported by Emma Topolovec and the [Binghamton University ACM Student Chapter Executive Board](https://binghamtonacm.org/)

---

### Introduction

Many Binghamton University students receive fraudulent phishing emails. To help these students, we developed a Chrome extension capable of detecting phishing emails with machine learning. The extension accesses the Gmail API to scan a user's emails and label them as malicious or benign. Emails are classified with a neural network made using TensorFlow.js.

### Usage

#### Download and Load the Extension:
 1. Download the repository as a ZIP
 2. Unzip the repository
 3. Open Google Chrome and visit [chrome://extensions](chrome://extensions)
 4. Turn on Developer Mode
 5. Click "Load unpacked"
 6. Select the unzipped repository

#### Using the Extension:

 1. Open the extension
 2. Select the number of emails to scan
 3. Click "Analyze Emails"
 4. Allow the extension to access your emails
 5. View the results at [mail.google.com](http://mail.google.com/)

![Image not found](https://github.com/EmmaTopolovec/PhishingEmailDetector/blob/9c74473cf56510691fd78ebc37ce2a8b3a98c59a/images/PopupScreenshot.png)

![Image not found](https://github.com/EmmaTopolovec/PhishingEmailDetector/blob/9c74473cf56510691fd78ebc37ce2a8b3a98c59a/images/ResultsScreenshot.png)

### Implementation

The extension consists of two major components: the extension popup and the trained neural network.

#### Popup

The popup was created using JavaScript, HTML, and CSS. It contains a title, dropdown box, and button. The dropdown box allows user to select the number of recent emails to scan. The button starts the scan. JavaScript code activates upon a button press and reads the value from the dropdown box. The script sends a request to the Gmail API to read the selected emails. TensorFlow.js is used to parse each email into features that are used by a pre-trained neural network to classify the emails as phishing or benign. The results are used to send requests to the Gmail API to add custom "Phishing" or "Safe" labels to each email.

#### Neural Network

The neural network trained on around 100 sample emails from Binghamton University students. This dataset was preprocessed and cleaned into a JSON file where each entry contained the email subject, email body, and a label. From this file, several binary features were extracted. Each feature represents if an email contains a certain suspicious word. The features were used to train a neural network with 3 dense layers. The trained model is included in the extension.

When a user scans new emails, our code extracts the features from the emails, loads the pre-trained model, then uses the model to classify each email. Emails with a prediction score of 90% phishing are classified as phishing, while all others are classified as safe.
