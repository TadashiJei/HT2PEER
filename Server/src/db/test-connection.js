const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const dbDir = path.dirname(dbPath);

console.log('Testing SQLite connection...');
console.log('Database path:', dbPath);
console.log('Database directory:', dbDir);

// Ensure directory exists
if (!fs.existsSync(dbDir)) {
    console.log('Creating database directory...');
    fs.mkdirSync(dbDir, { recursive: true });
}

// Remove existing database if it exists
if (fs.existsSync(dbPath)) {
    console.log('Removing existing database...');
    fs.unlinkSync(dbPath);
}

// Create a new database
console.log('Creating new database...');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
    }
    console.log('Database created successfully');
    
    // Test creating a table
    db.run(`CREATE TABLE test (
        id INTEGER PRIMARY KEY,
        name TEXT
    )`, (err) => {
        if (err) {
            console.error('Error creating table:', err);
            process.exit(1);
        }
        console.log('Test table created successfully');
        
        // Insert test data
        db.run(`INSERT INTO test (name) VALUES (?)`, ['test'], (err) => {
            if (err) {
                console.error('Error inserting data:', err);
                process.exit(1);
            }
            console.log('Test data inserted successfully');
            
            // Query test data
            db.get(`SELECT * FROM test`, (err, row) => {
                if (err) {
                    console.error('Error querying data:', err);
                    process.exit(1);
                }
                console.log('Test data retrieved successfully:', row);
                
                // Close database
                db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                        process.exit(1);
                    }
                    console.log('Database test completed successfully');
                    process.exit(0);
                });
            });
        });
    });
});
