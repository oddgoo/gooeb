export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.Ap7fSsbK.js",app:"_app/immutable/entry/app.BMFI5_Oi.js",imports:["_app/immutable/entry/start.Ap7fSsbK.js","_app/immutable/chunks/B772OGqW.js","_app/immutable/chunks/DegCGQ1Z.js","_app/immutable/chunks/DfYRUnQj.js","_app/immutable/entry/app.BMFI5_Oi.js","_app/immutable/chunks/DegCGQ1Z.js","_app/immutable/chunks/DrufDc8I.js","_app/immutable/chunks/Cko0Jhl8.js","_app/immutable/chunks/DfYRUnQj.js","_app/immutable/chunks/BJVJ6_jv.js","_app/immutable/chunks/C7rRSh41.js","_app/immutable/chunks/CPK4a2qT.js","_app/immutable/chunks/Drfw0f0-.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('../output/server/nodes/0.js')),
			__memo(() => import('../output/server/nodes/1.js')),
			__memo(() => import('../output/server/nodes/2.js')),
			__memo(() => import('../output/server/nodes/3.js')),
			__memo(() => import('../output/server/nodes/4.js')),
			__memo(() => import('../output/server/nodes/5.js')),
			__memo(() => import('../output/server/nodes/6.js')),
			__memo(() => import('../output/server/nodes/7.js')),
			__memo(() => import('../output/server/nodes/8.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/api/register",
				pattern: /^\/api\/register\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('../output/server/entries/endpoints/api/register/_server.ts.js'))
			},
			{
				id: "/(app)/bond",
				pattern: /^\/bond\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/join/[code]",
				pattern: /^\/join\/([^/]+?)\/?$/,
				params: [{"name":"code","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/(app)/me",
				pattern: /^\/me\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/register",
				pattern: /^\/register\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/(app)/web",
				pattern: /^\/web\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 6 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
