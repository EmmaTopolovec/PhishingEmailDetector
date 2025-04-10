document.getElementById("readEmailButton").addEventListener("click", async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id || !tab.url.includes("mail.google.com")) {
        alert("Error: This extension only works on an open email within Gmail.");
        return;
    }

    chrome.scripting.executeScript({
        target: {tabId: tab.id},
        function: extractEmail
    }).then((results) => {
        if (results && results.length > 0 && results[0].result) {
            document.getElementById("emailContent").value = results[0].result;
        } else {
            document.getElementById("emailContent").value = "No email content found.";
        }
    }).catch(error => console.error("Error:", error));
});

function extractEmail() {
    let emailDiv = document.querySelectorAll(".gs");
    
    if (!emailDiv || emailDiv.length === 0) {
        alert("Error: Could not find a valid email on this page.");
        return;
    }

    let extractedText = Array.from(emailDiv).map(div => div.innerText.trim()).join("\n\n");

    return extractedText.length > 0 ? extractedText : "Error: No email found.";
}
