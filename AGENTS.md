# AGENTS

- Agency (whitelabel) data lives in `agency_*` tables guarded by `is_agency_owner()`/`is_staff()`; only staff can set `clients.is_agency` — prevents self-promotion.
- Agency weekly fee math runs in `get_agency_week_summary` (Friday–Thursday week); AD SCALE share is charged on the agency's total spend — keeps billing server-side and consistent.
- Agencies never see Meta apps/tokens/BMs; they read only their own assigned ad accounts via existing client RLS — protects infrastructure secrecy.
- Agency demo data (demo.agencia@adscalehub.com) is simulated client-side in `src/components/agency/agency-accounts.ts`; never seed fake rows into meta_ad_accounts — keeps admin data clean.
