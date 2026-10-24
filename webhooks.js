// Discord credentials are now stored only on the self-hosted bot computer.
// Legacy public webhook delivery has been replaced by Firestore delivery jobs.
export const webhooks = {};
export function discordDestinations(){ return []; }
