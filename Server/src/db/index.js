const knex = require('knex');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const config = require('../../knexfile');

const environment = process.env.NODE_ENV || 'development';
const dbConfig = config[environment];

// Use absolute path
const dbPath = path.resolve(__dirname, 'database.sqlite');
const dbDir = path.dirname(dbPath);

console.log('Database configuration:', {
    path: dbPath,
    directory: dbDir,
    exists: fs.existsSync(dbPath)
});

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
    console.log('Creating database directory');
    fs.mkdirSync(dbDir, { recursive: true });
}

// Database state
let db = null;
let initialized = false;
let initializationPromise = null;

// Initialize database
const initialize = async () => {
    try {
        // Create database connection using the config from knexfile
        console.log('Initializing database connection');
        db = knex(dbConfig);

        // Test connection
        await db.raw('SELECT 1');
        console.log('Database connection successful');

        // Run migrations
        console.log('Running migrations');
        await db.migrate.latest();
        console.log('Database migrations completed');

        // Check if admin user exists
        const adminExists = await db('users')
            .where({ username: 'admin' })
            .first();

        if (!adminExists) {
            // Create admin user
            await db('users').insert({
                username: 'admin',
                password_hash: '$2b$10$s4XK4mBwMHAhJD0AD3/5H.RXh8ZZqcEK0cqSJY1yBhqYhPyXEBvyO', // password: admin
                is_admin: true
            });
            console.log('Admin user created');

            // Create default game modes
            await db('game_modes').insert([
                {
                    name: 'Classic',
                    description: 'Traditional peer-to-peer gameplay',
                    max_players: 2,
                    is_active: true
                },
                {
                    name: 'Team Battle',
                    description: 'Team-based gameplay with multiple peers',
                    max_players: 4,
                    is_active: true
                },
                {
                    name: 'Battle Royale',
                    description: 'Last peer standing wins',
                    max_players: 8,
                    is_active: true
                }
            ]);
            console.log('Default game modes created');
        }

        console.log('Database initialization completed');
        return db;
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    }
};

const getDb = () => {
    if (!initialized || !db) {
        throw new Error('Database not initialized');
    }
    return db;
};

// Run initialization
const init = async () => {
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = initialize()
        .then((database) => {
            db = database;
            initialized = true;
            console.log('Database fully initialized');
            return db;
        })
        .catch(error => {
            console.error('Fatal database error:', error);
            process.exit(1);
        });

    return initializationPromise;
};

module.exports = {
    getDb,
    init
};
