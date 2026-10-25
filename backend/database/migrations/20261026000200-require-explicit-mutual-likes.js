'use strict';

const { createHash } = require('node:crypto');
const fixtureNames = [
  'Anaya',
  'Ishita',
  'Meera',
  'Kavya',
  'Riya',
  'Tara',
  'Diya',
  'Sana',
  'Naina',
  'Aditi',
  'Aarav',
  'Rohan',
  'Kabir',
  'Arjun',
  'Vivaan',
  'Ishaan',
  'Dev',
  'Kunal',
  'Aditya',
  'Nikhil',
  'Reyansh',
  'Neil',
];
function fixtureUserId(name) {
  const hex = createHash('sha256')
    .update(`mello:demo:v1:user:${name}`)
    .digest('hex')
    .slice(0, 32)
    .split('');
  hex[12] = '5';
  hex[16] = 'a';
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
}
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        ALTER TABLE discovery_actions ADD COLUMN source varchar(4) NOT NULL DEFAULT 'USER' CHECK (source IN ('USER','DEMO'));
        CREATE INDEX discovery_incoming_likes_idx ON discovery_actions(target_id,created_at DESC,actor_id) WHERE action='LIKE' AND source='USER';
      `,
        { transaction },
      );
      // The original seed gave every phone-less fixture a LIKE toward every real user.
      // Preserve those rows for audit, but exclude them from user consent and matching.
      await queryInterface.sequelize.query(
        `
        UPDATE discovery_actions d SET source='DEMO'
        FROM users u WHERE u.id=d.actor_id AND d.actor_id IN (:fixtureIds)
          AND d.target_id NOT IN (:fixtureIds) AND d.action='LIKE'
          AND NOT EXISTS (SELECT 1 FROM auth_identities ai WHERE ai.account_id=u.account_id)
      `,
        {
          replacements: { fixtureIds: fixtureNames.map(fixtureUserId) },
          transaction,
        },
      );
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        'DROP INDEX discovery_incoming_likes_idx; ALTER TABLE discovery_actions DROP COLUMN source;',
        { transaction },
      );
    });
  },
};
