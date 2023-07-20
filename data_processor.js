const { default: axios } = require('axios');
const { Pool } = require('pg');
const fs = require('fs').promises;

const dataFilePath = 'events_queue.json';

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'mysecretpassword',
  port: 5432,
});

const dataLockName = 'users_revenue_lock';

async function lockTable() {
  const client = await pool.connect();
  try {
    const lockQuery = QueryLocks.Lock.create(dataLockName, 'ACCESS EXCLUSIVE');
    await client.query(lockQuery);
  } catch (error) {
  } finally {
    client.release();
  }
}

async function releaseLock() {
  const client = await pool.connect();
  try {
    const unlockQuery = QueryLocks.Lock.release(dataLockName);
    await client.query(unlockQuery);
  } catch (error) {
  } finally {
    client.release();
  }
}

const calculateUserRevenue = (eventName, userRevenue, eventValue) => {
  switch (eventName) {
    case 'add_revenue':
      userRevenue += eventValue;
      break;
    case 'subtract_revenue':
      userRevenue -= eventValue;
      break;
    default:
      throw new Error('INVALID USER EVENT');
  }
  return userRevenue;
};

const receiveEventsCollectionFromFile = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    if (data) {
      const eventsCollection = JSON.parse(data);
      if (Array.isArray(eventsCollection)) {
        for (const event of eventsCollection) {
          await updateUserEvent(event);
        }
        // Clear the events queue by writing an empty array to the file
        await fs.writeFile(filePath, '[]');
      }
    }
  } catch (err) {
    console.error('Error reading data from file', err);
  }
};

const updateUserEvent = async (eventObject) => {
  const client = await pool.connect();
  const transaction = await client.query('BEGIN');

  try {
    await lockTable();

    const selectQuery = `
      SELECT user_id, revenue
      FROM users_revenue
      WHERE user_id = $1
      FOR UPDATE NOWAIT;`;

    const { rows } = await client.query(selectQuery, [eventObject.userId]);

    let userRevenue = { user_id: eventObject.userId, revenue: 0 };

    if (rows.length > 0) {
      userRevenue = { ...rows[0] };
    }

    userRevenue.revenue = calculateUserRevenue(
      eventObject.name,
      Number(userRevenue.revenue),
      Number(eventObject.value)
    );

    const insertUpdateQuery = `
      INSERT INTO users_revenue (user_id, revenue)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET revenue = $2;`;

    await client.query(insertUpdateQuery, [userRevenue.user_id, userRevenue.revenue]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating data:', error.message);
  } finally {
    await releaseLock();
    client.release();
  }
};

const processUserEvents = async () => {
  await receiveEventsCollectionFromFile(dataFilePath);
};

setInterval(processUserEvents, 10000);