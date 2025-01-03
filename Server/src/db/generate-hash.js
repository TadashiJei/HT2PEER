const bcrypt = require('bcrypt');

async function generateHash() {
    const password = 'java69ers';
    const hash = await bcrypt.hash(password, 10);
    console.log('Password hash for "' + password + '":', hash);
}

generateHash();
