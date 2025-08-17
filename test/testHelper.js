const { app, server, io } = require('../server');
const { db, query, dbReadyPromise } = require('../db');

// Global before and after hooks

before(async () => {
    // Ensure the database is ready before any tests run
    await dbReadyPromise;
    console.log('Test setup: Database is ready.');
});

after((done) => {
    console.log('Tearing down test environment...');
    db.close((err) => {
        if (err) {
            console.error('Error closing test database:', err.message);
        }
        server.close(() => {
            io.close(); // Close the socket.io server as well
            console.log('Test environment torn down.');
            done();
        });
    });
});

// Helper function to clean the database between test suites if needed
const cleanupDatabase = async () => {
    await db.query('DELETE FROM scores');
    await db.query('DELETE FROM messages');
    await db.query('DELETE FROM players');
    await db.query('DELETE FROM admins');
};

module.exports = {
    app,
    server,
    db,
    cleanupDatabase
};
