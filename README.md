- npm install
- run db.sql in postgres database
- in server.js serach for connectionString & change the details to your postgres db details
- in data_processor.js search for "const pool" & change the details to your postgres db details
- run the applications in the following order in seperate terminals: 
    1. node server.js
    2. node client.js
    3. node data_processor.js

- Observe the results in the new file events_queue.json & the databases table users_revenue