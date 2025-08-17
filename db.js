const { Pool, types } = require('pg');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

// Override the default timestamp parser to return timestamps as strings
// This prevents node-postgres from converting them to local time
types.setTypeParser(1114, (stringValue) => {
    return stringValue; // Return as is
});

const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
    database: process.env.PG_DATABASE,
});

// Optional: Add an error listener to the pool
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

async function initializeDatabase() {
    let client;
    try {
        client = await pool.connect();
        console.log(`Connected to PostgreSQL database: ${client.database}`);

        // Create tables
        await client.query(`
            CREATE TABLE IF NOT EXISTS players (
                id VARCHAR(255) PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                country VARCHAR(255) NOT NULL,
                avatarUrl VARCHAR(255) DEFAULT 'assets/logo.jpg',
                createdAt TIMESTAMP NOT NULL,
                level INTEGER DEFAULT 0
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_players_country ON players (country);`);

        // Ensure level column exists (idempotent)
        const levelColumnCheck = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='players' AND column_name='level';
        `);
        if (levelColumnCheck.rowCount === 0) {
            await client.query(`ALTER TABLE players ADD COLUMN level INTEGER DEFAULT 0`);
            console.log('Added level column to players table.');
        }

        await client.query(`
            CREATE TABLE IF NOT EXISTS scores (
                id VARCHAR(255) PRIMARY KEY,
                playerId VARCHAR(255) NOT NULL,
                score INTEGER NOT NULL,
                mode VARCHAR(255) NOT NULL,
                memoryTime DOUBLE PRECISION,
                matchingTime DOUBLE PRECISION,
                timestamp TIMESTAMP NOT NULL,
                FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_scores_playerid_score_timestamp ON scores (playerId, score DESC, timestamp DESC);`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id VARCHAR(255) PRIMARY KEY,
                senderId VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                message TEXT,
                type VARCHAR(255) NOT NULL DEFAULT 'text',
                timestamp TIMESTAMP NOT NULL,
                room VARCHAR(255) NOT NULL DEFAULT 'Global',
                imageUrl VARCHAR(255),
                FOREIGN KEY (senderId) REFERENCES players(id) ON DELETE CASCADE
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id VARCHAR(255) PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                createdAt TIMESTAMP NOT NULL
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key VARCHAR(255) PRIMARY KEY,
                value TEXT
            );
        `);

        // Insert default settings if they don't exist
        await client.query(`INSERT INTO settings (key, value) VALUES ('siteTitle', 'CIPHER Game') ON CONFLICT (key) DO NOTHING`);
        await client.query(`INSERT INTO settings (key, value) VALUES ('welcomeMessage', 'Welcome to CIPHER!') ON CONFLICT (key) DO NOTHING`);
        await client.query(`INSERT INTO settings (key, value) VALUES ('chatMessageCooldown', '2000') ON CONFLICT (key) DO NOTHING`);
        await client.query(`INSERT INTO settings (key, value) VALUES ('defaultAvatarUrl', 'assets/logo.jpg') ON CONFLICT (key) DO NOTHING`);

        // Check if admin user exists, if not, create one
        const { rows } = await client.query(`SELECT 1 FROM admins LIMIT 1`);
        if (rows.length === 0) {
            const defaultAdminUsername = process.env.ADMIN_USERNAME || 'admin';
            const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'adminpass';
            const hashedAdminPassword = await bcrypt.hash(defaultAdminPassword, 10);
            const adminId = `admin_${Date.now()}`;
            const createdAt = new Date().toISOString();
            await client.query(`INSERT INTO admins (id, username, password, createdAt) VALUES ($1, $2, $3, $4)`,
                [adminId, defaultAdminUsername, hashedAdminPassword, createdAt]);
            console.log('Default admin user created.');
        }
        
        console.log('Database is ready.');

    } catch (err) {
        console.error('Database initialization failed!', err);
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
    }
}

// This function will be called from server.js to ensure DB is ready
async function connect() {
    await initializeDatabase();
}

module.exports = {
    connect,
    // The query function now directly uses the main pool
    query: (text, params) => pool.query(text, params),
    // The getClient function for transactions also uses the main pool
    getClient: () => pool.connect(),
    // Export the pool itself if needed elsewhere (e.g., for graceful shutdown)
    pool, 
};
