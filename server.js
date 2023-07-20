const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = 8000;
let isFileLocked = false;

const dataFilePath = path.join(__dirname, 'events_queue.json');



const lockFile = async () => {
    return new Promise((resolve) => {
      const checkLock = () => {
        if (isFileLocked) {
          setTimeout(checkLock, 50);
        } else {
          isFileLocked = true;
          resolve();
        }
      };
      checkLock();
    });
  };
  
  const unlockFile = () => {
    isFileLocked = false;
  };
  


const saveToFile = async (eventsCollection) => {
  try {
    const fileContent = JSON.stringify(eventsCollection, null, 2);
    await fs.writeFile(dataFilePath, fileContent, { flag: 'w', encoding: 'utf8' });
  } catch (err) {
    console.log('UNABLE TO SAVE FILE', err);
    throw err;
  }
};

const addRevenueToFile = async (eventObject) => {
  try {
    let eventsQueue = [];
    try {
    await lockFile();
      const file_reuslt = await fs.readFile(dataFilePath, 'utf8');
      eventsQueue = JSON.parse(file_reuslt);
    } catch (err) {
      eventsQueue = [];
    }
    eventsQueue.push(eventObject);
    await saveToFile(eventsQueue);
  } catch (err) {
    console.log('err', err);
    throw err;
  }
  finally {
    unlockFile();
  }
};

const getUsersRevenueByUserId = async (userId) => {
  const connectionString =
    'postgresql://postgres:mysecretpassword@localhost:5432/postgres';
  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    const selectQuery = `
        SELECT user_id, revenue
        FROM users_revenue
        WHERE user_id = $1;`;

    const { rows } = await client.query(selectQuery, [userId]);
    if (!rows.length || rows.length <= 0) {
      throw new Error('NO DATA FOUND');
    }
    return rows[0];
  } catch (err) {
    throw new Error(err);
  } finally {
    await client.end();
  }
};

const authorizationMiddleware = (req, res, next) => {
  try {
    const errorMessage = 'UNAUTHORIZED';
    const { authorization } = req.headers;
    const secretKey = 'secret';

    if (!authorization) {
      throw new Error(errorMessage);
    }
    if (authorization !== secretKey) {
      throw new Error('AUTHORIZATION KEY NOT MATCH');
    }
    next();
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
};

app.use(bodyParser.json());
app.get('/liveEvent/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await getUsersRevenueByUserId(userId);
    if (!result) {
      throw new Error('RESULTS NOT EXISTS');
    }
    res.send(result);
  } catch (err) {
    res.status(400).json({
      message: `Unable to get event by user_id:, ${err.message}`,
    });
  }
});

app.post('/liveEvent', authorizationMiddleware, async (req, res) => {
  try {
    const { body } = req;
    console.log('request body', body);
    if (!body.userId || !body.value || !body.name) {
      throw new Error('INVALID REQUEST, user_id or revenue is missing');
    }
    await addRevenueToFile(body);

    res.send('This is a POST request endpoint with middleware.');
  } catch (err) {
    console.log(err);
    res
      .status(400)
      .json({ message: `Unable to add a new event:, ${err.message}` });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
