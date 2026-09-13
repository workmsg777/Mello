import { Account } from './mainDb/account';
import { AuthIdentity } from './mainDb/authIdentity';
import { Media } from './mainDb/media';
import { OtpChallenge } from './mainDb/otpChallenge';
import { Partner } from './mainDb/partner';
import { PartnerUser } from './mainDb/partnerUser';
import { PlatformUser } from './mainDb/platformUser';
import { Role } from './mainDb/role';
import { User } from './mainDb/user';
import { UserSession } from './mainDb/userSession';
import { AccountRole } from './mainDb/throughTables/accountRole';
import { PartnerPhoto } from './mainDb/throughTables/partnerPhoto';
import { UserPhoto } from './mainDb/throughTables/userPhoto';

/**
 * Single source of truth for model initialization order.
 * Mello currently uses one database, so every model belongs to mainDb.
 */
export const melloModelConfig = [
  Account,
  User,
  Partner,
  PartnerUser,
  PlatformUser,
  Role,
  AccountRole,
  AuthIdentity,
  OtpChallenge,
  UserSession,
  Media,
  UserPhoto,
  PartnerPhoto,
] as const;
