import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Delete all player data
await connection.execute('DELETE FROM tierHistory');
await connection.execute('DELETE FROM playerGamemodes');
await connection.execute('DELETE FROM players');

// Delete Overall gamemode
await connection.execute('DELETE FROM gamemodes WHERE slug = ?', ['overall']);

console.log('All player data cleared and Overall gamemode removed');
await connection.end();
