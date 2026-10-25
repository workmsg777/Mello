import { type Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import Errors from '../errors';
import { rows } from '../repositories/discovery.repository';

export interface ListingInput {
  name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  kind: 'CAFE' | 'RESTAURANT' | 'ACTIVITY';
  headline: string;
  imageUrl: string | null;
  priceForTwoInr: number | null;
  durationMinutes: number;
  tags: string[];
  isPublished: boolean;
  latitude: number | null;
  longitude: number | null;
}
export class PartnerService {
  private async workspace(accountId: string, transaction?: Transaction) {
    const [staff] = await rows<{ partnerId: string; staffRole: string }>(
      `SELECT pu.partner_id AS "partnerId",pu.staff_role AS "staffRole" FROM partner_users pu JOIN partners p ON p.id=pu.partner_id AND p.deleted_at IS NULL WHERE pu.account_id=:accountId AND pu.deleted_at IS NULL`,
      { accountId },
      transaction,
    );
    if (!staff) throw new Errors.ForbiddenError('Partner workspace not found');
    return staff;
  }
  async get(accountId: string) {
    const staff = await this.workspace(accountId);
    const [venue] = await rows(
      `SELECT p.id,p.name,p.description,p.address_line_1 AS "address",p.city,p.state,p.postal_code AS "postalCode",p.latitude::float,p.longitude::float,l.kind,l.headline,l.image_url AS "imageUrl",l.price_for_two_inr AS "priceForTwoInr",l.duration_minutes AS "durationMinutes",l.tags,COALESCE(l.is_published,false) AS "isPublished" FROM partners p LEFT JOIN partner_listings l ON l.partner_id=p.id WHERE p.id=:partnerId`,
      { partnerId: staff.partnerId },
    );
    return { venue, staffRole: staff.staffRole };
  }
  async save(accountId: string, input: ListingInput) {
    await sequelize.transaction(async (transaction) => {
      const staff = await this.workspace(accountId, transaction);
      if (staff.staffRole === 'STAFF')
        throw new Errors.ForbiddenError(
          'Only owners and managers can edit listings',
        );
      await rows(
        `UPDATE partners SET name=:name,description=:description,address_line_1=:address,city=:city,state=:state,postal_code=:postalCode,latitude=:latitude,longitude=:longitude,updated_at=now() WHERE id=:partnerId RETURNING id`,
        { ...input, partnerId: staff.partnerId },
        transaction,
      );
      await rows(
        `INSERT INTO partner_listings (partner_id,kind,headline,image_url,price_for_two_inr,duration_minutes,tags,is_published) VALUES (:partnerId,:kind,:headline,:imageUrl,:priceForTwoInr,:durationMinutes,CAST(:tagsJson AS jsonb),:isPublished)
        ON CONFLICT (partner_id) DO UPDATE SET kind=EXCLUDED.kind,headline=EXCLUDED.headline,image_url=EXCLUDED.image_url,price_for_two_inr=EXCLUDED.price_for_two_inr,duration_minutes=EXCLUDED.duration_minutes,tags=EXCLUDED.tags,is_published=EXCLUDED.is_published,updated_at=now() RETURNING partner_id`,
        {
          ...input,
          tagsJson: JSON.stringify(input.tags),
          partnerId: staff.partnerId,
        },
        transaction,
      );
    });
    return this.get(accountId);
  }
  async requests(accountId: string) {
    const staff = await this.workspace(accountId);
    return rows(
      `SELECT d.id,d.proposed_at AS "proposedAt",d.status,d.partner_status AS "partnerStatus",d.created_at AS "createdAt",'Table / activity for two' AS title
      FROM date_plans d WHERE d.partner_id=:partnerId AND d.status IN ('ACCEPTED','CANCELLED') ORDER BY d.proposed_at DESC LIMIT 100`,
      { partnerId: staff.partnerId },
    );
  }
  async respond(accountId: string, planId: string, status: string) {
    const staff = await this.workspace(accountId);
    const changed = await rows(
      `UPDATE date_plans SET partner_status=:status,updated_at=now() WHERE id=:planId AND partner_id=:partnerId AND status='ACCEPTED' AND partner_status='PENDING' AND proposed_at>now() RETURNING id`,
      { status, planId, partnerId: staff.partnerId },
    );
    if (!changed.length)
      throw new Errors.ConflictError(
        'This request is unavailable or has already been answered',
      );
  }
}
