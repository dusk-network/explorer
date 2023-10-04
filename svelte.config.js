import adapter from "@sveltejs/adapter-auto";

// eslint-disable-next-line import/no-unresolved
import { vitePreprocess } from "@sveltejs/kit/vite";

/** @type {import("@sveltejs/kit").Config} */
const config = {
	kit: {
		adapter: adapter()
	},
	preprocess: vitePreprocess()
};

export default config;
