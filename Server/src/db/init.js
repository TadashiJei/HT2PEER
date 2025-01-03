const fs = require('fs');
const path = require('path');
const db = require('./index');

// Ensure the database directory exists
const dbDir = path.dirname(path.resolve(__dirname, 'database.sqlite'));
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize the database
async function initDb() {
    try {
        // Run migrations
        await db.migrate.latest();
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
}

initDb();
