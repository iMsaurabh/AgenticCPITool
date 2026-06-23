// runtimeCredentials stores CPI credentials supplied by the admin UI
// at runtime, without touching the .env file or restarting the server.
//
// Credentials live in process memory only — never written to disk.
// Falls back to process.env values if no runtime credentials have been set.

let store = {
    cpiBaseUrl: null,
    tokenUrl: null,
    clientId: null,
    clientSecret: null,
};

let populated = false;

function setCredentials({ cpiBaseUrl, tokenUrl, clientId, clientSecret }) {
    if (cpiBaseUrl)    store.cpiBaseUrl    = cpiBaseUrl;
    if (tokenUrl)      store.tokenUrl      = tokenUrl;
    if (clientId)      store.clientId      = clientId;
    if (clientSecret)  store.clientSecret  = clientSecret;
    populated = true;
}

function getCredentials() {
    return {
        cpiBaseUrl:    store.cpiBaseUrl    || process.env.CPI_BASE_URL,
        tokenUrl:      store.tokenUrl      || process.env.CPI_TOKEN_URL,
        clientId:      store.clientId      || process.env.CPI_CLIENT_ID,
        clientSecret:  store.clientSecret  || process.env.CPI_CLIENT_SECRET,
    };
}

function isPopulated() {
    return populated;
}

module.exports = { setCredentials, getCredentials, isPopulated };
