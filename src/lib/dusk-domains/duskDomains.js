import { get } from "svelte/store";

import { duskAPI } from "$lib/services";
import { appStore } from "$lib/stores";
import { makeNodeUrl } from "$lib/url";

/** @typedef {typeof import("./dusk-domains-releases.json").mainnet} Release */

/** @type {Map<string, Promise<import("@duskdomains/sdk/lens-reader").LensReader>>} */
const readers = new Map();

const loadSdk = () => import("./sdk");

/**
 * @param {unknown} cause
 * @returns {never}
 */
const lookupFailed = (cause) => {
  throw new Error("The name could not be looked up. Please try again.", {
    cause,
  });
};

/**
 * The pinned Dusk Domains release for the network of the explorer's node.
 * There is none off mainnet and testnet.
 *
 * @returns {Promise<Release | undefined>}
 */
async function getRelease() {
  const chainId =
    get(appStore).nodeInfo.chain_id ?? (await duskAPI.getNodeInfo()).chain_id;
  const { default: releases } = await import("./dusk-domains-releases.json");

  return Object.values(releases).find(
    (release) => release.chainId === `dusk:${chainId}`
  );
}

/**
 * One lens reader per network, querying the explorer's node. Only the lens
 * driver loads, from the Dusk Domains site, and it must match the pinned
 * hashes. A reader that fails to load is dropped, so the next lookup retries.
 *
 * @param {Release} release
 */
function getReader(release) {
  let reader = readers.get(release.network);

  if (!reader) {
    reader = loadSdk().then(({ createLensReader }) =>
      createLensReader(release, {
        artifactBaseUrl: release.artifactBaseUrl,
        nodeUrl: makeNodeUrl("/").href,
      })
    );
    readers.set(release.network, reader);
    reader.catch(() => readers.delete(release.network));
  }

  return reader;
}

/**
 * Whether a search query is a `.dusk` name.
 *
 * @param {string} query
 * @returns {boolean}
 */
export const isDuskName = (query) => /\.dusk$/i.test(query.trim());

/**
 * Resolves a `.dusk` name to the Moonlight account in its
 * `moonlight_address` record. Rejects with a message for the user
 * when there is no such account or the lookup fails.
 *
 * @param {string} query
 * @returns {Promise<string>} The account in Base58
 */
export async function resolveDuskName(query) {
  const release = await getRelease().catch(lookupFailed);

  if (!release) {
    throw new Error(
      "Dusk Domains names are only available on mainnet and testnet."
    );
  }

  const sdk = await loadSdk().catch(lookupFailed);
  const validation = sdk.validateName(query);

  if (!validation.ok) {
    throw new Error("This is not a valid .dusk name.");
  }

  const { records, status, value } = await getReader(release)
    .then((reader) =>
      reader.resolve(validation.name.canonical, ["moonlight_address"])
    )
    .catch(lookupFailed);
  const account = records[0]?.value;

  if (typeof value !== "object" || !("Local" in value) || status === "Absent") {
    throw new Error("This name is not registered.");
  } else if (status !== "Active") {
    throw new Error("This name has expired.");
  } else if (account?.length !== 96) {
    throw new Error("This name has no Moonlight address.");
  }

  return sdk.encodeBase58(account);
}

/**
 * The verified primary name of a Moonlight account and its page on the
 * Dusk Domains site, or `null` if the account has none.
 *
 * @param {string} address
 * @returns {Promise<{ name: string, url: string } | null>}
 */
export async function getPrimaryName(address) {
  const release = await getRelease();

  if (!release) {
    return null;
  }

  const endpoint = (await loadSdk()).decodeBase58(address);

  if (endpoint?.length !== 96) {
    return null;
  }

  const primary = await getReader(release).then((reader) =>
    reader.verifyPrimary(endpoint)
  );
  const name = primary?.primary.spelling;

  return name
    ? { name, url: `${release.site}/name/${encodeURIComponent(name)}` }
    : null;
}
