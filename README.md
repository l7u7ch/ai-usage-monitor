# AI Usage Monitor

## Dokploy deployment

Mount a persistent Dokploy volume at `/app/data`. The application stores all durable state there:

- `auth-v2.json`: dashboard login configuration and session signing key
- `accounts.json`: registered account index
- `profiles/<account-uuid>/`: Codex-managed ChatGPT authentication state

On the first visit, the application redirects to `/setup` to create the administrator ID and password. Complete setup on a trusted network before exposing the dashboard: the first visitor can claim the administrator account. Setup can only succeed once. Existing `auth.json` credentials and sessions are ignored; upgrading requires creating a new account, while registered Codex accounts remain in place.

## Dashboard login session

Dashboard sessions have no application-level inactivity timeout. Login and initial setup issue non-expiring signed tokens in persistent cookies that survive browser restarts. Browser storage lasts up to 400 days and genuine pointer, keyboard, wheel, or touch input refreshes that deadline. Automatic polling, page mounting, focus changes, and synthetic events do not refresh it. Requests are limited to one every 30 seconds per mounted page. Manual logout clears the cookie; clearing browser data also ends the local login.

The renewal endpoint requires a valid signed session and a matching Origin, including behind a TLS-terminating proxy. Legacy sessions retain their original expiry until upgraded by activity or a new login; expired legacy sessions cannot be revived. A renewal response of 401 redirects to `/login`. Activity timestamps must be within the preceding 60 seconds of the server clock, so keep client and server clocks synchronized. Network failures do not trigger automatic retries. Codex account authorization is separate. Browser cookie eviction or more than 400 days without activity may require logging in again.

`data/` is intentionally excluded from Git. Do not set `CODEX_USAGE_DATA_DIR`; the application always uses `/app/data` when run from the application root.
