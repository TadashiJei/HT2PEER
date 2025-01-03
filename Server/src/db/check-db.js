const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

console.log('Checking database file...');
console.log('Database path:', dbPath);

if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log('File exists');
    console.log('File size:', stats.size);
    console.log('File permissions:', stats.mode.toString(8));
    console.log('File owner:', stats.uid);
    console.log('File group:', stats.gid);
    
    // Try to open the file
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database:', err);
        } else {
            console.log('Successfully opened database');
            db.close();
        }
    });
} else {
    console.log('File does not exist');
}
