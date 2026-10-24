# Security findings and migration status

Six legacy webhook credentials were present in public frontend source and repository history. Current local webhooks.js has no live URLs and browser notifications now queue trusted delivery jobs. Previously published credentials remain compromised until explicitly approved revocation in Discord. No credentials have been revoked or rotated in this implementation session.

New rules default deny unknown collections, separate CID/editor/officer/reviewer permissions, restrict role documents to owners, prevent browser-created delivery receipts and identity links, constrain job creation to authenticated actors and immutable audit records, and restrict private submission reads. The Worker rechecks current permissions before privileged actions and verifies Discord request signatures and linking codes. Static client checks are not the authorization boundary.

Cloudflare secrets hold server credentials; the Firebase Admin SDK/service-account private key never belongs in GitHub Pages. Ordinary Firebase browser config is public by design. Account passwords remain managed by Firebase Authentication. No custom password database or paid MFA service has been introduced.

The CSP is an HTML meta policy because GitHub Pages cannot set arbitrary server response headers. It does not claim to provide unsupported frame-ancestors or HSTS settings. Existing third-party documents require their listed external origins.

Audit events do not include passwords or tokens. Discord uncertainty is surfaced for manual review rather than claimed exactly-once delivery. Service-account compromise bypasses Firestore rules, so least privilege, secret protection, and account recovery remain important operational controls.

Firebase billingEnabled=false, authorized domains, email privacy, and account-provider settings have been verified through authenticated APIs. Production replacement rules have not been deployed. Cloudflare subscription inspection returned 403 with the limited OAuth scope, and live Discord permission tests and comprehensive repository-setting verification remain pending. Source tests are not evidence that production rules are deployed. Preserve the existing website until the deployment gates in SERVERLESS-SETUP.md pass.
