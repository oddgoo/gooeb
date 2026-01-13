import * as server from '../entries/pages/(app)/_layout.server.ts.js';

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/(app)/_layout.svelte.js')).default;
export { server };
export const server_id = "src/routes/(app)/+layout.server.ts";
export const imports = ["_app/immutable/nodes/2.BdvakUbV.js","_app/immutable/chunks/Cko0Jhl8.js","_app/immutable/chunks/DegCGQ1Z.js","_app/immutable/chunks/CuCRXMTx.js","_app/immutable/chunks/C7rRSh41.js","_app/immutable/chunks/DrufDc8I.js","_app/immutable/chunks/BxTElWW6.js","_app/immutable/chunks/Drfw0f0-.js","_app/immutable/chunks/DfYRUnQj.js","_app/immutable/chunks/B1kuv8vc.js","_app/immutable/chunks/B772OGqW.js"];
export const stylesheets = [];
export const fonts = [];
