import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { z } from 'zod';
import { sequelize } from '../config/database';
import Errors from '../errors';
import { rows } from '../repositories/discovery.repository';
import { PartnerContentKind } from '../constants/partner';
import { PartnerService } from './partner.service';

export const partnerContentSchema = z
  .object({
    kind: z.enum(PartnerContentKind),
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(5000).default(''),
    priceInr: z.number().int().min(0).max(1000000).nullable().default(null),
    startsAt: z.string().datetime({ offset: true }).nullable().default(null),
    endsAt: z.string().datetime({ offset: true }).nullable().default(null),
    isPublished: z.boolean().default(false),
    photoIds: z.array(z.string().uuid()).max(10).default([]),
  })
  .refine(
    (value) => value.kind !== PartnerContentKind.EVENT || !!value.startsAt,
    'Events require a start date and time',
  )
  .refine(
    (value) =>
      !value.endsAt ||
      (!!value.startsAt && new Date(value.endsAt) > new Date(value.startsAt)),
    'End time must be after start time',
  )
  .refine(
    (value) => new Set(value.photoIds).size === value.photoIds.length,
    'Photo IDs must be unique',
  );

const photoColumns = `COALESCE((SELECT json_agg(json_build_object('id',a.id,'url',a.url) ORDER BY p.position) FROM jsonb_array_elements_text(c.photo_ids) WITH ORDINALITY p(id,position) JOIN partner_assets a ON a.id=CAST(p.id AS uuid) AND a.partner_id=c.partner_id),'[]'::json) AS photos`;
const publicColumns = `c.id,c.kind,c.title,c.description,c.price_inr AS "priceInr",c.starts_at AS "startsAt",c.ends_at AS "endsAt",${photoColumns}`;
const contentColumns = `${publicColumns},c.is_published AS "isPublished",c.photo_ids AS "photoIds",c.updated_at AS "updatedAt"`;
export class PartnerContentService {
  private readonly partners = new PartnerService();
  async list(accountId: string) {
    const staff = await this.partners.authorize(accountId, 'manageContent');
    return rows(
      `SELECT ${contentColumns} FROM partner_content c WHERE c.partner_id=:partnerId AND c.deleted_at IS NULL ORDER BY c.updated_at DESC LIMIT 200`,
      staff,
    );
  }
  async published(partnerId: string) {
    return rows(
      `SELECT ${publicColumns} FROM partner_content c JOIN partners p ON p.id=c.partner_id AND p.status='ACTIVE' AND p.deleted_at IS NULL JOIN partner_listings l ON l.partner_id=p.id AND l.is_published WHERE c.partner_id=:partnerId AND c.deleted_at IS NULL AND c.is_published AND (c.kind<>'EVENT' OR COALESCE(c.ends_at,c.starts_at)>now()) ORDER BY c.updated_at DESC LIMIT 100`,
      { partnerId },
    );
  }
  async save(
    accountId: string,
    input: z.infer<typeof partnerContentSchema>,
    contentId?: string,
  ) {
    await sequelize.transaction(async (transaction) => {
      const staff = await this.partners.authorize(
        accountId,
        'manageContent',
        transaction,
      );
      if (input.photoIds.length) {
        const assets = await rows(
          'SELECT id FROM partner_assets WHERE partner_id=:partnerId AND id IN (:ids)',
          { partnerId: staff.partnerId, ids: input.photoIds },
          transaction,
        );
        if (assets.length !== input.photoIds.length)
          throw new Errors.BadRequestError(
            'Use only photos uploaded to this café',
          );
      }
      const params = {
        ...input,
        photos: JSON.stringify(input.photoIds),
        accountId,
        partnerId: staff.partnerId,
        id: contentId ?? randomUUID(),
      };
      const changed = await rows(
        contentId
          ? `UPDATE partner_content SET kind=:kind,title=:title,description=:description,price_inr=:priceInr,starts_at=:startsAt,ends_at=:endsAt,is_published=:isPublished,photo_ids=CAST(:photos AS jsonb),updated_by_account_id=:accountId,updated_at=now() WHERE id=:id AND partner_id=:partnerId AND deleted_at IS NULL RETURNING id`
          : `INSERT INTO partner_content (id,partner_id,kind,title,description,price_inr,starts_at,ends_at,is_published,photo_ids,created_by_account_id,updated_by_account_id) VALUES (:id,:partnerId,:kind,:title,:description,:priceInr,:startsAt,:endsAt,:isPublished,CAST(:photos AS jsonb),:accountId,:accountId) RETURNING id`,
        params,
        transaction,
      );
      if (!changed.length) throw new Errors.NotFoundError('Content not found');
    });
    return this.list(accountId);
  }
  async remove(accountId: string, id: string) {
    const staff = await this.partners.authorize(accountId, 'manageContent');
    const changed = await rows(
      'UPDATE partner_content SET deleted_at=now(),updated_at=now(),updated_by_account_id=:accountId WHERE id=:id AND partner_id=:partnerId AND deleted_at IS NULL RETURNING id',
      { ...staff, accountId, id },
    );
    if (!changed.length) throw new Errors.NotFoundError('Content not found');
  }
  async upload(accountId: string, file: Express.Multer.File | undefined) {
    const staff = await this.partners.authorize(accountId, 'manageContent');
    if (!file || !file.buffer.length)
      throw new Errors.BadRequestError('Photo file is required');
    const bytes = file.buffer;
    const extension =
      bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
        ? '.png'
        : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          ? '.jpg'
          : bytes.toString('ascii', 0, 4) === 'RIFF' &&
              bytes.toString('ascii', 8, 12) === 'WEBP'
            ? '.webp'
            : null;
    if (!extension)
      throw new Errors.BadRequestError(
        'Upload a valid JPEG, PNG or WebP image',
      );
    const mimeType =
      extension === '.png'
        ? 'image/png'
        : extension === '.jpg'
          ? 'image/jpeg'
          : 'image/webp';
    const id = randomUUID(),
      directory = path.resolve('uploads/partner-photos'),
      filename = `${id}${extension}`,
      target = path.join(directory, filename),
      url = `/uploads/partner-photos/${filename}`;
    await mkdir(directory, { recursive: true });
    await writeFile(target, bytes);
    try {
      await rows(
        'INSERT INTO partner_assets (id,partner_id,uploaded_by_account_id,url,mime_type,size_bytes) VALUES (:id,:partnerId,:accountId,:url,:mimeType,:size) RETURNING id',
        { id, ...staff, accountId, url, mimeType, size: bytes.length },
      );
    } catch (error) {
      await unlink(target).catch(() => undefined);
      throw error;
    }
    return { id, url };
  }
}
