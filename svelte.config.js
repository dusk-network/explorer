import adapter from "@sveltejs/adapter-static";
import { loadEnv } from "vite";

const env = loadEnv("", process.cwd());

/** @type {import("@sveltejs/kit").Config} */
const config = {
  kit: {
    // A host serves it for a page that isn't there, and the app says so.
    adapter: adapter({ fallback: "404.html" }),

    paths: {
      base: /** @type {"" | `/${string}` | undefined} */ (env.VITE_BASE_PATH),
      relative: false,
    },
  },
};

export default config;
