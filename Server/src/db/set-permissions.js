const fs = require('fs');
const path = require('path');

const dbDir = __dirname;
const dbPath = path.join(dbDir, 'database.sqlite');

console.log('Setting permissions...');
console.log('Database directory:', dbDir);
console.log('Database path:', dbPath);

// Ensure directory exists with full permissions
if (!fs.existsSync(dbDir)) {
    console.log('Creating database directory...');
    fs.mkdirSync(dbDir, { recursive: true, mode: 0o777 });
} else {
    console.log('Setting directory permissions...');
    fs.chmodSync(dbDir, 0o777);
}

// Create empty database file with full permissions if it doesn't exist
if (!fs.existsSync(dbPath)) {
    console.log('Creating database file...');
    fs.writeFileSync(dbPath, '', { mode: 0o666 });
} else {
    console.log('Setting file permissions...');
    fs.chmodSync(dbPath, 0o666);
}

console.log('Permissions set successfully');
