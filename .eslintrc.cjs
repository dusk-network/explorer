module.exports = {
	"env": {
		"browser": true,
		"es2022": true,
		"node": true
	},
	"extends": [
		"@dusk-network/eslint-config/js",
		"@dusk-network/eslint-config/svelte"
	],
	"ignorePatterns": [
		"/*.*",
		"/**/__tests__/**",
		"/**/__mocks__/**"
	],
	"root": true,
	"settings": {
		"import/resolver": {
			"eslint-import-resolver-custom-alias": {
				"alias": {
					"$app": "node_modules/@sveltejs/kit/src/runtime/app",
					"$config": "./src/config",
					"$lib": "./src/lib",
					"@sveltejs/kit": "node_modules/@sveltejs/kit/src/exports/index.js",
					"@testing-library/svelte": "node_modules/@testing-library/svelte/src/index.js",
					"svelte/motion": "node_modules/svelte/src/runtime/motion/index.js",
					"svelte/store": "node_modules/svelte/src/runtime/store/index.js"
				},
				"extensions": [".cjs", ".js", ".json", ".svelte"]
			}
		}
	}
};
