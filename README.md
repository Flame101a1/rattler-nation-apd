# Rattler Nation — Austin Police Department Portal

Internal information hub for the Rattler Nation private FiveM roleplay community. APD refers to the in-game Austin Police Department.

## Local use and hosting

Serve this folder with a static web server or upload it to GitHub Pages. The portal uses HTML, CSS, and JavaScript, with no build step.

## Community setup

- Add the new community's Firebase web configuration to portal-config.js. Until configured, data pages display a setup notice and staff controls are disabled.
- Configure Firebase Authentication, Firestore rules, and the initial owner account for the new community before enabling services. Do not import prior staff permissions or records without review.
- Arrest and search warrant templates are linked on warrantform.html, with copying, editing-access, and LEO Discord submission instructions.
- Officer complaints submit to the configured Google Form and open its confirmation page in a new tab. Suggestions submit to their configured Google Form with confirmation in a new tab. Site issue reports submit to their configured Google Form with confirmation in a new tab; screenshots are supplied as links.
- Configure Discord destinations in webhooks.js. Announcements Publish and Calendar Publish receive new posts only; their separate Logs destinations receive creation, editing (where supported), and deletion activity. Blank URLs disable delivery. No webhooks are configured by default. This file is public on static hosting; use a server-side relay to keep webhook URLs private.
- Add new APD community photos to images/gallery and the galleryImages array in gallery.js. The homepage hero uses images/hero1.png; additional community hero photos can be added later.
- Supplied Austin artwork: images/austin-police-patch.png is used for the main logo and page icons; images/austin-police-badge.png is used for page watermarks and the printed training header.
- Review department policies, radio codes, rank structure, and training references with command staff before treating them as approved community policy.

Created for internal community use. Unauthorized redistribution prohibited.

CID Discord destinations: cidPublish receives new-case notices; cidLogs receives case activity, including narrative additions. Messages contain only a generic notice or action, excluding identifiers, case content, and personnel details. Blank URLs disable delivery. Case editing and deletion are not currently exposed in the portal.
