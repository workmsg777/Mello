import Errors from '../errors';

export enum PartnerRole {
  ADMIN = 'PARTNER_ADMIN',
  SUPPORT = 'PARTNER_SUPPORT',
}
export enum PartnerContentKind {
  MENU = 'MENU',
  PLAN = 'PLAN',
  PACKAGE = 'PACKAGE',
  EVENT = 'EVENT',
}
export enum PartnerState {
  CHANDIGARH = 'Chandigarh',
  DELHI = 'Delhi',
  MAHARASHTRA = 'Maharashtra',
  KARNATAKA = 'Karnataka',
  TELANGANA = 'Telangana',
  TAMIL_NADU = 'Tamil Nadu',
  WEST_BENGAL = 'West Bengal',
  RAJASTHAN = 'Rajasthan',
  UTTAR_PRADESH = 'Uttar Pradesh',
  MADHYA_PRADESH = 'Madhya Pradesh',
  KERALA = 'Kerala',
  PUNJAB = 'Punjab',
  UTTARAKHAND = 'Uttarakhand',
}
export enum PartnerCity {
  CHANDIGARH = 'Chandigarh',
  DELHI = 'Delhi',
  MUMBAI = 'Mumbai',
  BENGALURU = 'Bengaluru',
  HYDERABAD = 'Hyderabad',
  CHENNAI = 'Chennai',
  KOLKATA = 'Kolkata',
  PUNE = 'Pune',
  JAIPUR = 'Jaipur',
  LUCKNOW = 'Lucknow',
  INDORE = 'Indore',
  KOCHI = 'Kochi',
  LUDHIANA = 'Ludhiana',
  DEHRADUN = 'Dehradun',
  MYSURU = 'Mysuru',
}
export const partnerCityStates: Record<PartnerCity, PartnerState> = {
  [PartnerCity.CHANDIGARH]: PartnerState.CHANDIGARH,
  [PartnerCity.DELHI]: PartnerState.DELHI,
  [PartnerCity.MUMBAI]: PartnerState.MAHARASHTRA,
  [PartnerCity.PUNE]: PartnerState.MAHARASHTRA,
  [PartnerCity.BENGALURU]: PartnerState.KARNATAKA,
  [PartnerCity.MYSURU]: PartnerState.KARNATAKA,
  [PartnerCity.HYDERABAD]: PartnerState.TELANGANA,
  [PartnerCity.CHENNAI]: PartnerState.TAMIL_NADU,
  [PartnerCity.KOLKATA]: PartnerState.WEST_BENGAL,
  [PartnerCity.JAIPUR]: PartnerState.RAJASTHAN,
  [PartnerCity.LUCKNOW]: PartnerState.UTTAR_PRADESH,
  [PartnerCity.INDORE]: PartnerState.MADHYA_PRADESH,
  [PartnerCity.KOCHI]: PartnerState.KERALA,
  [PartnerCity.LUDHIANA]: PartnerState.PUNJAB,
  [PartnerCity.DEHRADUN]: PartnerState.UTTARAKHAND,
};
export function partnerLocation(
  city: string,
  state?: string,
  countryCode = 'IN',
) {
  const canonical = Object.values(PartnerCity).find(
    (value) => value.toLowerCase() === city.trim().toLowerCase(),
  );
  if (!canonical || countryCode !== 'IN')
    throw new Errors.BadRequestError(
      'Select a supported Indian city from the list',
    );
  const mapped = partnerCityStates[canonical];
  if (state?.trim() && state.trim().toLowerCase() !== mapped.toLowerCase())
    throw new Errors.BadRequestError('The state must match the selected city');
  return { city: canonical, state: mapped, countryCode: 'IN' };
}
export function partnerPermissions(role: PartnerRole) {
  return {
    manageTeam: role === PartnerRole.ADMIN,
    manageListing: role === PartnerRole.ADMIN,
    manageRequests: role === PartnerRole.ADMIN,
    manageContent: role === PartnerRole.ADMIN || role === PartnerRole.SUPPORT,
  };
}
export function partnerCatalog() {
  return {
    roles: Object.values(PartnerRole).map((code) => ({
      code,
      label: code === PartnerRole.ADMIN ? 'Partner admin' : 'Partner support',
      assignable: code === PartnerRole.SUPPORT,
      permissions: partnerPermissions(code),
    })),
    contentKinds: Object.values(PartnerContentKind),
    states: Object.values(PartnerState),
    cities: Object.values(PartnerCity).map((city) => ({
      value: city,
      label: city,
      state: partnerCityStates[city],
      countryCode: 'IN',
    })),
  };
}
