const fs = require('fs').promises;
const axios = require("axios");
const path = 'events.json';

const sendRequest = async (eventData) => {
    const clientSecretKey = "secret";
    const url_path = "http://localhost:8000/liveEvent"
    try {
        const headers = {"Authorization": clientSecretKey}; 
        console.log("Sending REQUEST TO THE SERVER", eventData)
        await axios.post(url_path, eventData, {headers});
    }
    catch(err) {
        throw new Error(`Unable to send request to the server: ${err}`);
    }
}

const sendEventsToServer = (events) => {
    events.forEach(async (e) => {
        try {
            await sendRequest(e);
        }
        catch(err) {
            console.error("Unable to send the request.", {event: e, err});
        }
    });
}

const getDataFromFile = async (filePath) => {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        if(data) {
            const eventsCollection = JSON.parse(data);
            if(Array.isArray(eventsCollection)) {
                sendEventsToServer(eventsCollection);
            }
        }
    }
    catch(err) {
     console.log("Error to get data from file", err);   
    }
}

getDataFromFile(path);