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
  const base64 = encodedData.replace(/-/g, "+").replace(/_/g, "/");
  const decodedStr = atob(base64);
  return decodedStr;
}
window.onload = function () {
  document.querySelector("button").addEventListener("click", function () {
    chrome.identity.getAuthToken({ interactive: true }, async function (token) {
      console.log("token =", token);
      const list = await getEmailListByIds(token);

      for (let i = 0; i < list.length; i++) {
        const current = list[i];
        const snippet = current.snippet;
        const sender = current.payload.headers.find(
          (header) => header.name === "From"
        ).value;
        const receiver = current.payload.headers.find(
          (header) => header.name === "Delivered-To"
        ).value;
        const body = decodeEmailBody(current.payload.parts[0].body.data || "");

        const div = document.createElement("div");
        const pSnippet = document.createElement("p");
        pSnippet.textContent = snippet;
        div.appendChild(pSnippet);
        const pSender = document.createElement("p");
        pSender.textContent = sender;
        div.appendChild(pSender);
        const pReceiver = document.createElement("p");
        pReceiver.textContent = receiver;
        div.appendChild(pReceiver);
        const pBody = document.createElement("p");
        pBody.textContent = body;
        div.appendChild(pBody);
        emailsList.appendChild(div);
      }

      console.log(`
        ***************************
        ***************************
        ***************************
        ***************************
      `);
    });
  });
};

/**
 *     
 *  
 *  [a, a, a, b, c, d, e, a, a, d, b]
              L  R 
 *  [c, b, d]
 */
