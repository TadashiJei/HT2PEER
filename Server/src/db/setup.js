const knex = require('knex');
const path = require('path');
const fs = require('fs');
const config = require('../../knexfile');

async function setupDatabase() {
    const dbConfig = config.development;
    const dbPath = path.resolve(dbConfig.connection.filename);
    const dbDir = path.dirname(dbPath);

    console.log('Setting up database...');
    console.log('Database path:', dbPath);
    console.log('Database directory:', dbDir);

    // Ensure database directory exists
    if (!fs.existsSync(dbDir)) {
        console.log('Creating database directory...');
        fs.mkdirSync(dbDir, { recursive: true });
    }

    // Delete existing database if it exists
    if (fs.existsSync(dbPath)) {
        console.log('Removing existing database...');
        fs.unlinkSync(dbPath);
    }

    try {
        // Initialize database
        console.log('Initializing database...');
        const db = knex(dbConfig);

        // Run migrations
        console.log('Running migrations...');
        await db.migrate.latest();
        console.log('Migrations completed successfully');

        // Create admin user
        console.log('Creating admin user...');
        await db('users').insert({
            username: 'admin',
            email: 'admin@example.com',
            password_hash: '$2b$10$s4XK4mBwMHAhJD0AD3/5H.RXh8ZZqcEK0cqSJY1yBhqYhPyXEBvyO', // password: admin
            is_admin: true
        });
        console.log('Admin user created');

        // Create default game modes
        console.log('Creating default game modes...');
        await db('game_modes').insert([
            {
                name: 'Classic',
                settings: JSON.stringify({
                    maxPlayers: 2,
                    timeLimit: 300,
                    scoreToWin: 10
                }),
                is_active: true
            },
            {
                name: 'Team',
                settings: JSON.stringify({
                    maxPlayers: 4,
                    timeLimit: 600,
                    scoreToWin: 20,
                    teamSize: 2
                }),
                is_active: true
            }
        ]);
        console.log('Default game modes created');

        await db.destroy();
        console.log('Database setup completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error setting up database:', error);
        process.exit(1);
    }
}

setupDatabase();
