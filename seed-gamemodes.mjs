import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const gamemodes = [
  { name: 'Overall', slug: 'overall' },
  { name: 'Vanilla', slug: 'vanilla' },
  { name: 'UHC', slug: 'uhc' },
  { name: 'Pot', slug: 'pot' },
  { name: 'NethPot', slug: 'nethpot' },
  { name: 'SMP', slug: 'smp' },
  { name: 'Sword', slug: 'sword' },
  { name: 'Axe', slug: 'axe' },
  { name: 'Mace', slug: 'mace' },
  { name: 'Crystal', slug: 'crystal' },
];

for (const gm of gamemodes) {
  await connection.execute(
    'INSERT IGNORE INTO gamemodes (name, slug) VALUES (?, ?)',
    [gm.name, gm.slug]
  );
}

console.log('Gamemodes seeded successfully');
await connection.end();
