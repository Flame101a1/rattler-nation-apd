# Implementation status — 24 October 2026

## Verified live configuration
- Cloudflare CLI authenticated through official OAuth with credentials encrypted using Windows Credential Manager.
- Worker deployed: https://rattler-apd-discord.noahthornton53.workers.dev. Health endpoint responds and accurately reports that Discord credentials are still pending. Scheduled processing skips execution until credentials exist.
- No paid bindings or billing upgrades were introduced. Cloudflare billing subscription inspection returned 403 with the limited OAuth scope, so the account subscription itself is not independently verified. Workers Free is the required deployment plan; confirm it in the dashboard.
- Existing Firebase project rattler-nation-apd authenticated through its official CLI. Cloud Billing API reports billingEnabled=false. Email/password enabled, anonymous sign-in disabled, improved email privacy enabled, and flame101a1.github.io authorized.
- Existing Firestore rules and staff permissions backed up to an ignored local directory. The one existing owner account retains its flags. No existing department records deleted.
- Dedicated apd-discord-worker service identity granted roles/datastore.user. Its private key was transferred directly to Cloudflare secrets, without being printed or saved to a local file. This server identity bypasses Firestore rules and must remain protected.
- Implementation saved to the serverless-discord-integration GitHub branch. Its automated checks passed. The live GitHub Pages main branch remains unchanged.

## Local implementation
The existing design, navigation, Google Forms/documents, warrant templates, published roster resource, Firebase project, and Pages URL are retained. New code adds HTTP Discord interactions, one-time account linking, a trusted delivery queue, receipts/retries, role/channel setup, role synchronization, owner-only announcement publishing with plaintext APD mentions, drafts/scheduling/edits, attendance/results, private warrant/OIS submissions and reviews, CID status/assignment updates, support notifications, Firebase recovery/reauthentication, and the matching admin integration panel.

The admin panel includes channel/role discovery, destination mappings, permitted mentions, bounded reminders, heartbeat/counts, recent delivery results, failed-job retry, and searchable protected audit history. External Google Forms notifications require installation of the optional authenticated Apps Script bridge; no external document import is claimed.

Current-head public webhook URLs are removed locally. Old published copies and Git history remain compromised until the owner explicitly approves revocation and invalidation is verified.

## Validation
- 31 backend tests pass: authorization, mention restrictions, signed Discord requests, server restriction, safe URLs, immutable job identity, duplicate receipts, uncertain-send recovery, private CID destinations, account/server configuration guards, rank hierarchy, membership-role isolation, path traversal rejection, finalized training protection, and Austin daylight-saving conversion.
- 14 Firestore emulator tests pass against demo-rattler-apd: private reads, self-promotion denial, CID/editor separation, owner publishing, matched atomic log/jobs, protected links/receipts/status, code expiry, valid private warrant submission, recent authentication, immutable logs, and atomic announcement rollback.
- Source syntax, local HTML references, duplicate element IDs, and public webhook scan pass (42 application JavaScript files).
- Worker bundle deploys successfully; deployment startup measured at 1–2 ms. Full authenticated workflow CPU usage on Workers Free still requires live testing.
- Worker npm audit: zero known findings after patching the HTTP development dependency.
- Emulator toolchain updated to Firebase CLI 15.34.1 with compatible gRPC/UUID fixes. Three moderate transitive findings remain through @google-cloud/pubsub and @opentelemetry/core; no high/critical findings remain. These are local test tools, not deployed Worker runtime dependencies. No incompatible major override was applied merely to suppress the audit.
- Visual/accessibility browser QA and live Discord workflows are not yet verified.

## Deployment gates and remaining scope
Discord application creation, secure bot credential entry, bot installation, confirmed guild/layout approval, private-channel access tests, actual role pings, live slash/button/linking tests, and old webhook revocation are pending. Production Firestore replacement rules and frontend deployment are pending the coordinated migration. Review SERVERLESS-SETUP.md and DISCORD-SERVER-LAYOUT.md.

Not every requested enhancement is complete: full security-center diagnostics, all notification templates/options, exhaustive security/visual tests, and operational quota/load measurement remain. Existing Google documents are independent resources. Account linking is explicit; periodic membership reconciliation is delayed and disabled until its intent/permission checks are completed. No persistent computer hosting is required for the deployed integration; the loopback setup helper is temporary.

The temporary loopback Discord setup page was tested for password-field handling, no-store headers, origin restrictions, and CSRF rejection. It requires direct user confirmation of the actual guild and full proposed layout. Current local setup URL: http://127.0.0.1:64722 (expires after 30 minutes; restart worker/scripts/discord-setup.mjs if needed). No bot credentials have been received through chat.

Background work is explicitly paused through INTEGRATION_ENABLED=false until the Workers Free plan, bot installation, and private-permission configuration are confirmed. The signed Discord handshake remains available for Developer Portal endpoint verification. Announcement source/audit/delivery writes and deletions are now atomic; finalized training registrations and backend document paths have additional regression-tested guards.
