# Enable CID case deletion

The Firebase rules provided during setup deny case and narrative deletion. Update both rules in Firebase Console → Firestore Database → Rules, then Publish.

Within match /cidCases/{caseId}, replace:

    allow delete: if false;

with:

    allow delete: if isEditor();

Within its nested match /narratives/{narrativeId}, replace:

    allow update, delete: if false;

with:

    allow update: if false;
    allow delete: if isEditor();

Keep the existing create/read/update rules and the isEditor helper unchanged. These changes apply only to the CID case and narrative blocks, not portal logs or other records.

Authorized CID editors can open a case and click Delete Case. A confirmation names the case and explains that deletion is permanent. The case and up to 499 narratives are removed in one atomic batch. Larger cases display an error and remain intact. Evidence links stored in the case are removed; externally hosted files are not deleted.

Successful deletion sends activity to CID Logs only. No publish notice is sent.
