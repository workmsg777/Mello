# Partner admins, employees and café content

## User journey

1. The café owner opens Mello Partner and chooses **Register business**. They enter the business details and choose a city from the searchable selector. The state and country are filled automatically; they cannot enter an unrelated state. After verifying their own signup OTP, they become `PARTNER_ADMIN` for that café.
2. The admin opens **Your team**, enters an employee name and unused mobile number, selects **Partner support**, and chooses **Add employee**. No SMS is sent automatically. The employee is registered under that café with a `PENDING` account and an unverified phone identity.
3. The employee opens the same partner app, chooses **Partner login**, enters their registered number, and requests an OTP. Successful OTP verification activates the employee account and verifies that phone. A failed OTP leaves it pending. They do not register a second business.
4. The employee opens **Menus & experiences**, chooses **Add new**, selects Menu, Plan, Package or Event, enters the details and optional price, and adds device photos. Events require a start date/time; an optional end must be later. Save as a draft or publish.
5. Both admin and support can edit content for their own café, including content created by a colleague. Published content is visible in the dating app's café details only when the venue is published and active. Drafts stay in the partner workspace. Ended events stop appearing publicly.
6. The admin can disable a support employee in **Your team**. This suspends the account and revokes existing sessions immediately. Enabling access restores active/pending status as appropriate; old sessions remain revoked and the employee logs in again.

## Central enums and permissions

The source of truth is `backend/src/constants/partner.ts`: `PartnerRole`, `PartnerContentKind`, `PartnerCity`, `PartnerState`, `partnerCityStates` and the permission mapping. `/api/partner/catalog` exposes these values to both native and web clients, avoiding a second frontend location/permission list. The supported city list currently matches the 15 cities seeded for discovery; add new cities to the central mapping and the discovery catalog together.

| Capability | PARTNER_ADMIN | PARTNER_SUPPORT |
| --- | --- | --- |
| Business listing, address and publication | Yes | No |
| Add/disable support employees | Yes | No |
| Menus and menu photos | Yes | Yes |
| Plans, packages and events | Yes | Yes |
| Upload café content photos | Yes | Yes |
| Date request confirmation | Yes | No |

New business signup always creates an admin. The employee API only accepts the support enum and cannot create/promote an admin. A phone already registered to any account cannot be reassigned by an admin. Every protected operation checks current membership, account status and partner ownership on the backend; hidden buttons are not the authorization boundary.

Migration `20261030000100-partner-team-and-content.js` replaces the organizational staff-role enum. Existing OWNER/MANAGER become PARTNER_ADMIN, existing STAFF becomes PARTNER_SUPPORT. It does not alter platform RBAC roles. Existing cafés and dates remain intact.

## API

`GET /api/partner/catalog` is public, containing only supported roles, permissions and locations. All other partner endpoints require an active partner-user bearer session.

| Method | Route | Access / purpose |
| --- | --- | --- |
| GET | `/api/partner/workspace` | Current venue, role and permissions |
| GET | `/api/partner/team` | Admin: own café employees and phone numbers |
| POST | `/api/partner/team` | Admin: `{name,phone,role:"PARTNER_SUPPORT"}`; returns updated team |
| PATCH | `/api/partner/team/:id` | Admin: `{enabled:boolean}` for own support employee |
| GET | `/api/partner/content` | Admin/support: own café drafts and published content |
| POST | `/api/partner/content` | Admin/support: create content |
| PUT | `/api/partner/content/:id` | Admin/support: update own café content |
| DELETE | `/api/partner/content/:id` | Admin/support: soft-delete own café content |
| POST | `/api/partner/photos` | Admin/support: multipart `photo` file, max 10 MB; returns `{id,url}` |
| GET | `/api/discovery/venues/:partnerId/content` | Completed dating user: published content of an active published venue |

Content body: `{kind,title,description,priceInr,startsAt,endsAt,isPublished,photoIds}`. Dates use ISO 8601 with timezone. `kind` is MENU, PLAN, PACKAGE or EVENT. `priceInr` is a nullable whole rupee amount. Up to 10 unique asset IDs may be attached; each must belong to the same café. JPEG, PNG and WebP uploads are checked by their byte signatures and stored in the existing persistent uploads volume under `uploads/partner-photos/`. Public photo URLs deliberately serve published catalogue images without bearer headers; do not upload private documents here.

Menus and offers describe the café's offerings; this does not add payments, package checkout, event ticketing or capacity management. Date invitations continue to use the existing mutual-match and venue-confirmation flow.

## Browsing in the user app

From **Discover**, choose **Browse cafés & menus**, open a venue, then use **Menu & experiences**. Users can filter Menu, Packages, Plans and Events, read descriptions and prices, and open photos full screen with zoom controls. Browsing does not require a match. **Plan a date** is a separate tab and continues to require a mutual match.

This is a read-only catalogue: dating accounts cannot create, update, delete or publish café content. The response contains only offering details and photos, without partner editing metadata. Drafts, deleted entries and expired events are excluded; unpublished or inactive venues return no content. Partners publish changes in their workspace; users can refresh the catalogue to see them. Design-preview content is labelled as sample data and is never written to the database.

## Validation

The isolated PostgreSQL integration suite covers derived city/state validation, employee invitation and OTP activation, forbidden support operations, cross-café restrictions, photo upload/serving, content publishing and session revocation. OTP delivery is mocked in those tests; tests do not send messages to employees. Local schema validation also checks the migrated role enum and the inviter foreign key. Native UI and real SMS still need device/provider verification.
