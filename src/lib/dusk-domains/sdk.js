// The SDK parts the explorer uses, imported by name so the bundle leaves out
// the full client. Loaded on demand by `duskDomains.js`.
export { decodeBase58, encodeBase58, validateName } from "@duskdomains/sdk";
export { createLensReader } from "@duskdomains/sdk/lens-reader";
