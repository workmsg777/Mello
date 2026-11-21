'use strict';
require('dotenv/config');
const { QueryTypes } = require('sequelize');
const path = require('node:path');
const { sequelize } = require('../src/config/database.ts');
const { profilePhotoUploadDirectory } = require('../src/config/uploads.ts');

async function main() {
  const [operation, id] = process.argv.slice(2);
  if (operation === 'list' && !id) {
    const photos = await sequelize.query(
      `SELECT p.id,m.storage_key,p.moderation_assessment,p.moderation_attempts FROM user_photos p JOIN media m ON m.id=p.media_id
      WHERE p.deleted_at IS NULL AND m.deleted_at IS NULL AND p.moderation_status='PENDING'
      ORDER BY p.created_at,p.id LIMIT 50`,
      { type: QueryTypes.SELECT },
    );
    console.table(
      photos.map(({ storage_key, moderation_assessment, ...photo }) => ({
        ...photo,
        localFile: path.join(
          profilePhotoUploadDirectory,
          path.basename(storage_key),
        ),
        assessment: moderation_assessment?.kind ?? 'unscored',
        risk: moderation_assessment?.risk,
      })),
    );
    return;
  }
  if (
    !['approve', 'reject', 'retry'].includes(operation) ||
    !require('zod').z.string().uuid().safeParse(id).success
  )
    throw new Error(
      'Use list, approve <photo UUID>, reject <photo UUID>, or retry <photo UUID>',
    );
  if (operation === 'retry') {
    const result = await sequelize.query(
      `UPDATE user_photos SET moderation_claim=NULL,moderation_attempts=0,
        moderation_assessment=NULL,moderation_retry_at=now() WHERE id=:id
        AND deleted_at IS NULL AND moderation_status='PENDING'
        AND (moderation_claim IS NULL OR moderation_retry_at<=now()) RETURNING id`,
      { type: QueryTypes.SELECT, replacements: { id } },
    );
    if (!result.length) throw new Error('Photo is unavailable or processing');
    console.log('Review queued for', id);
    return;
  }
  const result = await sequelize.query(
    `UPDATE user_photos SET moderation_status=:status,updated_at=now()
    WHERE id=:id AND deleted_at IS NULL AND moderation_status='PENDING' RETURNING id`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        id,
        status: operation === 'approve' ? 'APPROVED' : 'REJECTED',
      },
    },
  );
  if (!result.length) throw new Error('This photo is no longer pending');
  console.log('Review saved for', id);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
