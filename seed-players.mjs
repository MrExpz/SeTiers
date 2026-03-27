import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Sample players
const players = [
  { name: 'Notch', uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5' },
  { name: 'Herobrine', uuid: '61699b2e-d327-4a01-9f1e-0ea8c3f06bc6' },
  { name: 'Steve', uuid: '8667ba71-b85a-4004-af54-457a9734eed7' },
  { name: 'Alex', uuid: 'ec561538-f3fd-461d-aff5-086b22154bce' },
  { name: 'Enderman', uuid: 'e3aaab2d-2d1d-4e2e-8e2e-8e2e8e2e8e2e' },
];

// Insert players
for (const player of players) {
  await connection.execute(
    'INSERT IGNORE INTO players (name, uuid) VALUES (?, ?)',
    [player.name, player.uuid]
  );
}

// Get gamemode IDs
const [gamemodes] = await connection.execute('SELECT id, slug FROM gamemodes');

// Get player IDs
const [playerRows] = await connection.execute('SELECT id, name FROM players');

// Create rankings for each player in each gamemode
const tiers = ['HT1', 'HT2', 'HT3', 'HT4', 'HT5', 'LT1', 'LT2', 'LT3', 'LT4', 'LT5'];

for (let i = 0; i < playerRows.length; i++) {
  const player = playerRows[i];
  for (let j = 0; j < gamemodes.length; j++) {
    const gamemode = gamemodes[j];
    const tierIndex = (i + j) % tiers.length;
    const tier = tiers[tierIndex];
    const position = (i * gamemodes.length + j) % 100;

    await connection.execute(
      'INSERT IGNORE INTO playerGamemodes (playerId, gamemodeId, tier, position) VALUES (?, ?, ?, ?)',
      [player.id, gamemode.id, tier, position]
    );
  }
}

console.log('Players and rankings seeded successfully');
await connection.end();
