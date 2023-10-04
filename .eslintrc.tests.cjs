module.exports = {
	"env": {
		"node": true,
		"es6": true
	},
	"extends": [
		".eslintrc.cjs"
	],
	"ignorePatterns": [
		"!/*.*",
		"!/**/__tests__/**",
		"!/**/__mocks__/**"
	],
	"rules": {
		"brace-style": [
			"error",
			"1tbs",
			{ "allowSingleLine": true }
		],
		"jsdoc/require-jsdoc": 0,
		"max-len": [
			"error", {
				"code": 110,
				"comments": 110,
				"ignorePattern": "^\\s*it\\(",
				"ignoreUrls": true
			}
		],
		"max-nested-callbacks": [
			"error",
			5
		],
		"max-statements": 0,
		"max-statements-per-line": [
			"error", {
				"max": 2
			}
		],
		"object-curly-newline": 0,
		"quote-props": [
			"error",
			"consistent"
		],
		"sort-keys": 0
	}
};
