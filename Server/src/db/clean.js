const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('Database file deleted');
} else {
    console.log('Database file does not exist');
}
