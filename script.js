const CLIENT_ID = '504947030599-jio88c027qr11moemj0eees7l6eblmj7.apps.googleusercontent.com';
const API_KEY = 'AIzaSyBN8PhB3GkZbvge3pLjeyKvEm_tIVQmHBs';

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

document.getElementById('authorize_button').style.visibility = 'hidden';
document.getElementById('signout_button').style.visibility = 'hidden';

/**
 * Callback after api.js is loaded.
 */
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

/**
 * Callback after the API client is loaded. Loads the
 * discovery doc to initialize the API.
 */
async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableButtons();
}

/**
 * Callback after Google Identity Services are loaded.
 */
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
    });
    gisInited = true;
    maybeEnableButtons();
}

/**
 * Enables user interaction after all libraries are loaded.
 */
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById('authorize_button').style.visibility = 'visible';
    }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        document.getElementById('signout_button').style.visibility = 'visible';
        document.getElementById('authorize_button').innerText = 'Refresh';
	//await listLabels();
        //await listMessages();
	await getRecentMessage();
    };

    if (gapi.client.getToken() === null) {
        // Prompt the user to select a Google Account and ask for consent to share their data
        // when establishing a new session.
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        // Skip display of account chooser and consent dialog for an existing session.
        tokenClient.requestAccessToken({prompt: ''});
    }
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        document.getElementById('content').innerText = '';
        document.getElementById('authorize_button').innerText = 'Authorize';
        document.getElementById('signout_button').style.visibility = 'hidden';
    }
}

/**
 * Print all Labels in the authorized user's inbox. If no labels
 * are found an appropriate message is printed.
 */
async function listLabels() {
    let response;
    try {
        response = await gapi.client.gmail.users.labels.list({
	    'userId': 'me',
        });
    } catch (err) {
        document.getElementById('content').innerText = err.message;
        return;
    }
    const labels = response.result.labels;
    if (!labels || labels.length == 0) {
        document.getElementById('content').innerText = 'No labels found.';
        return;
    }
    // Flatten to string to display
    const output = labels.reduce(
        (str, label) => `${str}${label.name}\n`,
        'Labels:\n');
    document.getElementById('content').innerText = output;
}

async function listMessages() {
    let messageHeaders = await getMessages(30);
    
    // Flatten to string to display
    console.log(messageHeaders)
    for(let i = 0; i < messageHeaders.length; i++){
	messageHeaders[i] = messageHeaders[i].headers.find((element) => element.name == "Subject");
    }
    const output = messageHeaders.reduce(
        (str, header) => `${str}${header.value}\n`,
        'Messages:\n');
    document.getElementById('content').innerText = output;
}

async function getMessages(numMessages = 100){
    let response;
    try {
        response = await gapi.client.gmail.users.messages.list({
	    'userId': 'me',
	    'maxResults': numMessages,
        });
    } catch (err) {
        document.getElementById('content').innerText = err.message;
        return;
    }
    const messages = response.result.messages;
    if (!messages || messages.length == 0) {
        document.getElementById('content').innerText = 'No messages found.';
    }
    console.log(messages)
    let out = new Array(messages.length);
    for(let i = 0; i < messages.length; i++){
	let message = await gapi.client.gmail.users.messages.get({
	    'userId': 'me',
	    'id': messages[i].id,
        });
	
	out[i] = message.result.payload;
    }
    return out;
}

async function getRecentMessage(){
    let message = await getMessages(1);
    console.log(message);
    let email = message[0].headers.find((element) => element.name == "From").value.match(/<.*>$/i);
    if(email == null){
	console.log("Email not found");
	email = "None";
    }
    else{
	email = email[0].substring(1, email[0].length - 1);
	console.log(email);
    }
    
    let body = message[0].parts[0].body.data;
    console.log(body);
    let decodedBody = atob(decode(body));
    console.log(decodedBody);

    let subject = message[0].headers.find((element) => element.name == "Subject").value;
    
    let out = {
	sender: email,
	body: decodedBody,
	subject: subject
    }
    console.log(out);
    return out;
}


function decode(input) {
 // Replace non-url compatible chars with base64 standard chars
    input = input.replace(/-/g, '+').replace(/_/g, '/');

    // Pad out with standard base64 required padding characters
    var pad = input.length % 4;
    if(pad) {
        if(pad === 1) {
            throw new Error('InvalidLengthError: Input base64url string is the wrong length to determine padding');
        }
        input += new Array(5-pad).join('=');
    }

    return input;
}










































