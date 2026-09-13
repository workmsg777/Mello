import {
  Account,
  AccountRole,
  AuthIdentity,
  Media,
  Partner,
  PartnerPhoto,
  PartnerUser,
  PlatformUser,
  Role,
  User,
  UserPhoto,
  UserSession,
} from './entities';

export function initializeAssociations(): void {
  Account.hasOne(User, {
    foreignKey: 'accountId',
    as: 'user',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  User.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });
  Account.hasOne(PartnerUser, {
    foreignKey: 'accountId',
    as: 'partnerUser',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  PartnerUser.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });
  Account.hasOne(PlatformUser, {
    foreignKey: 'accountId',
    as: 'platformUser',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  PlatformUser.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });

  Partner.hasMany(PartnerUser, {
    foreignKey: 'partnerId',
    as: 'staff',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  PartnerUser.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' });

  Account.hasMany(AuthIdentity, {
    foreignKey: 'accountId',
    as: 'authIdentities',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  AuthIdentity.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });
  Account.hasMany(UserSession, {
    foreignKey: 'accountId',
    as: 'sessions',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserSession.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });

  Account.belongsToMany(Role, {
    through: AccountRole,
    foreignKey: 'accountId',
    otherKey: 'roleId',
    as: 'roles',
  });
  Role.belongsToMany(Account, {
    through: AccountRole,
    foreignKey: 'roleId',
    otherKey: 'accountId',
    as: 'accounts',
  });
  AccountRole.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });
  AccountRole.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });

  Account.hasMany(Media, {
    foreignKey: 'uploadedByAccountId',
    as: 'uploadedMedia',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  });
  Media.belongsTo(Account, {
    foreignKey: 'uploadedByAccountId',
    as: 'uploader',
  });

  User.hasMany(UserPhoto, {
    foreignKey: 'userId',
    as: 'photos',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserPhoto.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Media.hasMany(UserPhoto, {
    foreignKey: 'mediaId',
    as: 'userPhotos',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  UserPhoto.belongsTo(Media, { foreignKey: 'mediaId', as: 'media' });

  Partner.hasMany(PartnerPhoto, {
    foreignKey: 'partnerId',
    as: 'photos',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  PartnerPhoto.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' });
  Media.hasMany(PartnerPhoto, {
    foreignKey: 'mediaId',
    as: 'partnerPhotos',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  PartnerPhoto.belongsTo(Media, { foreignKey: 'mediaId', as: 'media' });
}
