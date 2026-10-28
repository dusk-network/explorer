import { get } from "svelte/store";

import { duskAPI } from "$lib/services";
import { appStore } from "$lib/stores";
import { makeNodeUrl } from "$lib/url";

/** @typedef {typeof import("./dusk-domains-releases.json").mainnet} Release */

/** @typedef {{ name: string, url: string }} PrimaryName */

/** @typedef {import("@duskdomains/sdk/lens-reader").LensReader} LensReader */

/**
 * The lens reader of each network, whose reads in one task go through
 * Multicall for Dusk, and one reading one query at a time, for a lookup the
 * lens refused for want of gas in a batch.
 *
 * @type {Record<"batched" | "direct", Map<string, Promise<LensReader>>>}
 */
const readers = { batched: new Map(), direct: new Map() };

/**
 * Verified primary names, kept for the session; a failed lookup isn't kept.
 *
 * @type {Map<string, Promise<PrimaryName | null>>}
 */
const primaryNames = new Map();

/**
 * The gas a lens read takes inside a multicall, as the SDK's client gives it
 * (client.ts, LENS_READS and lensGas): the lens shares its gas among every
 * read it may make, and refuses (GasBudget) when a share is short.
 *
 * @type {Map<string, number>}
 */
const LENS_READS = new Map([
  ["resolve", 90],
  ["reverse", 203],
]);

/**
 * The reply a lens read is planned for in a multicall until one is seen:
 * twice the largest seen on testnet (784 bytes for a verified name).
 */
const LENS_REPLY_ESTIMATE = 1536;

const loadSdk = () => import("./sdk");

// The multicall batching, loaded with the reader that uses it.
const loadMulticallFetch = () => import("./multicallFetch");

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
 * A lens reader for the network, querying the explorer's node. Only the lens
 * driver loads, from the Dusk Domains site, and it must match the pinned
 * hashes. A reader that fails to load is dropped, so the next lookup retries.
 *
 * The batched reader sends the lens reads made in one task as one Multicall
 * for Dusk query, at most 32 of them, each with the gas cap the SDK gives it,
 * and checks every reply as a read sent alone; a read alone in its task goes
 * as it is. The direct reader sends each read as its own query.
 *
 * @param {Release} release
 * @param {"batched" | "direct"} [kind]
 * @returns {Promise<LensReader>}
 */
function getReader(release, kind = "batched") {
  const cache = readers[kind];
  let reader = cache.get(release.network);

  if (!reader) {
    const nodeUrl = makeNodeUrl("/").href;
    const isLens = (/** @type {string} */ contractId) =>
      contractId === release.lens.contractId;

    reader = Promise.all([
      loadSdk(),
      kind === "batched" ? loadMulticallFetch() : null,
    ]).then(([{ createLensReader }, batching]) =>
      createLensReader(release, {
        artifactBaseUrl: release.artifactBaseUrl,
        nodeUrl,
        ...(batching
          ? {
              fetch: batching.createMulticallFetch({
                gasFor: (contractId, fnName) => {
                  const reads = LENS_READS.get(fnName);

                  return isLens(contractId) && reads
                    ? BigInt(reads) * 4_000_000n + 30_000_000n
                    : 0n;
                },
                nodeUrl,
                replyEstimate: (contractId, fnName) =>
                  isLens(contractId) && LENS_READS.has(fnName)
                    ? LENS_REPLY_ESTIMATE
                    : undefined,
              }),
            }
          : {}),
      })
    );
    cache.set(release.network, reader);
    reader.catch(() => cache.delete(release.network));
  }

  return reader;
}

/**
 * Whether a lookup failed for want of gas in a multicall, which a query of
 * its own does not run into: the SDK's client then reads again alone.
 *
 * @param {unknown} error
 */
const isShortOfGas = (error) => {
  const { reason, refusal } =
    /** @type {{ reason?: string, refusal?: { cause?: string | null, code?: string } }} */ (
      error ?? {}
    );

  return (
    reason === "refused" &&
    (refusal?.code === "GasBudget" ||
      refusal?.code === "ReadFailed" ||
      refusal?.cause === "GasBudget")
  );
};

/**
 * A read through the batched reader, made again alone through the direct
 * one when the lens refused it for want of gas in the batch. Any other
 * failure stays a failure.
 *
 * @template T
 * @param {Release} release
 * @param {(reader: LensReader) => Promise<T>} read
 * @returns {Promise<T>}
 */
const readLens = (release, read) =>
  getReader(release)
    .then(read)
    .catch((error) =>
      isShortOfGas(error)
        ? getReader(release, "direct").then(read)
        : Promise.reject(error)
    );

/**
 * Whether a contract belongs to Dusk Domains on mainnet or testnet, by the
 * contract IDs of the pinned releases. It reads nothing from the node.
 *
 * @param {string} contractId
 * @returns {Promise<boolean>}
 */
export async function isDuskDomainsContract(contractId) {
  const { default: releases } = await import("./dusk-domains-releases.json");

  return Object.values(releases).some(
    (release) =>
      release.lens.contractId === contractId ||
      release.contracts.some((contract) => contract.contractId === contractId)
  );
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
    throw new Error(
      validation.issues.includes("label")
        ? "This is not a valid .dusk name. Names use a–z, 0–9 and hyphens, and don't start or end with a hyphen."
        : "This is not a valid .dusk name."
    );
  }

  const { records, status, value } = await readLens(release, (reader) =>
    reader.resolve(validation.name.canonical, ["moonlight_address"])
  ).catch(lookupFailed);
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
 * Dusk Domains site, or `null` if the account has none. An account is
 * looked up once a session; a failed lookup isn't kept.
 *
 * @param {string} address
 * @returns {Promise<PrimaryName | null>}
 */
export async function getPrimaryName(address) {
  const release = await getRelease();

  if (!release) {
    return null;
  }

  const key = `${release.network}:${address}`;
  let name = primaryNames.get(key);

  if (!name) {
    const lookup = lookUpPrimaryName(release, address);

    primaryNames.set(key, lookup);
    lookup.catch(() => {
      if (primaryNames.get(key) === lookup) {
        primaryNames.delete(key);
      }
    });
    name = lookup;
  }

  return name;
}

/**
 * The verified primary names of many accounts, as a list shows them. Each
 * account is looked up once a session, and the lookups start together, so
 * one Multicall for Dusk query carries up to 32 of them. An account whose
 * lookup failed is left out.
 *
 * @param {Array<string | null | undefined>} addresses
 * @returns {Promise<Map<string, PrimaryName | null>>}
 */
export async function getPrimaryNames(addresses) {
  const unique = [
    ...new Set(
      addresses.filter(
        /** @returns {address is string} */
        (address) => typeof address === "string" && address !== ""
      )
    ),
  ];

  if (!unique.length) {
    return new Map();
  }

  const lookups = await Promise.allSettled(unique.map(getPrimaryName));

  /** @type {Map<string, PrimaryName | null>} */
  const names = new Map();

  lookups.forEach((lookup, i) => {
    if (lookup.status === "fulfilled") {
      names.set(unique[i], lookup.value);
    }
  });

  return names;
}

/**
 * The `.dusk` name someone searched for to reach an account, to show on
 * the account's page: the name in canonical form and its page on the Dusk
 * Domains site, when it resolves to that account and isn't already its
 * primary name, or `null`. A name in a link proves nothing until it is
 * resolved.
 *
 * @param {string | null} name
 * @param {string} address
 * @returns {Promise<PrimaryName | null>}
 */
export async function getSearchedName(name, address) {
  if (!name || !isDuskName(name)) {
    return null;
  }

  const canonical = name.trim().toLowerCase();
  const [account, primary, release] = await Promise.all([
    resolveDuskName(canonical).catch(() => null),
    getPrimaryName(address).catch(() => null),
    getRelease().catch(() => undefined),
  ]);

  return release &&
    account === address &&
    primary?.name.toLowerCase() !== canonical
    ? { name: canonical, url: nameUrl(release, canonical) }
    : null;
}

/**
 * A name's page on the release's Dusk Domains site.
 *
 * @param {Release} release
 * @param {string} name
 */
const nameUrl = (release, name) =>
  `${release.site}/name/${encodeURIComponent(name)}`;

/**
 * @param {Release} release
 * @param {string} address
 * @returns {Promise<PrimaryName | null>}
 */
async function lookUpPrimaryName(release, address) {
  const endpoint = (await loadSdk()).decodeBase58(address);

  if (endpoint?.length !== 96) {
    return null;
  }

  const primary = await readLens(release, (reader) =>
    reader.verifyPrimary(endpoint)
  );
  const name = primary?.primary.spelling;

  return name ? { name, url: nameUrl(release, name) } : null;
}
