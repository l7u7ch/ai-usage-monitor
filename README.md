# AI Usage Monitor

## Dokploy deployment

Mount a persistent Dokploy volume at `/app/data`. The application stores all durable state there:

- `auth-v2.json`: dashboard login configuration and session signing key
- `accounts.json`: registered account index
- `profiles/<account-uuid>/`: Codex-managed ChatGPT authentication state

On the first visit, the application redirects to `/setup` to create the administrator ID and password. Complete setup on a trusted network before exposing the dashboard: the first visitor can claim the administrator account. Setup can only succeed once. Existing `auth.json` credentials and sessions are ignored; upgrading requires creating a new account, while registered Codex accounts remain in place.

## Dashboard login session

Dashboard sessions initially expire 12 hours after a successful login or initial setup. On the account and usage dashboards, genuine pointer, keyboard, wheel, or touch input renews the session to 12 hours after that interaction. Automatic polling, page mounting, focus changes, and synthetic events do not renew it. Renewal requests are limited to one every 30 seconds per mounted page, with a trailing request preserving the latest interaction time rather than extending from the later request time. Cookie expiry and signed token expiry use that same deadline.

The renewal endpoint requires a valid, unexpired session and a matching Origin, including behind a TLS-terminating proxy. Expired sessions cannot be revived; a renewal response of 401 redirects to `/login`. Activity timestamps must be within the preceding 60 seconds of the server clock, so keep client and server clocks synchronized. Network failures do not trigger automatic retries; later genuine input can try again while the session remains valid. Existing sessions retain their original expiry until a successful renewal. Codex account authorization is separate.

`data/` is intentionally excluded from Git. Do not set `CODEX_USAGE_DATA_DIR`; the application always uses `/app/data` when run from the application root.
