import { derived, get } from "svelte/store";

import { createDataStore } from ".";

/**
 * A data store read again each time the chain has a new newest block,
 * rather than on a timer: once on `start`, then once for each new block
 * `head` gives, one read at a time, a block that comes during a read making
 * one more read after it. A read that fails stops it, until it is started
 * again, as a retry does.
 *
 * @param {(...args: any) => Promise<any>} dataRetriever
 * @param {import("svelte/store").Readable<{ head: { hash: string } | null }>} head
 * @returns {PollingDataStore}
 */
const createFollowingDataStore = (dataRetriever, head) => {
  const dataStore = createDataStore(dataRetriever);

  /** @type {Parameters<dataRetriever>} */
  let args = /** @type {any} */ ([]);

  /** @type {(() => void) | null} */
  let unsubscribe = null;

  /** Each start is a run of its own: a stopped one reads no more. */
  let run = 0;

  /** The run whose read is under way, if any. */
  let busy = -1;

  /** Whether a new block came during that read. */
  let again = false;

  async function read() {
    if (busy === run) {
      again = true;

      return;
    }

    const mine = run;

    busy = mine;

    do {
      again = false;

      const store = await dataStore.getData(...args);

      if (mine !== run) {
        break;
      }

      if (store.error !== null) {
        stop();
        break;
      }
    } while (again);

    if (busy === mine) {
      busy = -1;
    }
  }

  function stop() {
    run += 1;
    again = false;
    unsubscribe?.();
    unsubscribe = null;
  }

  /** @type {(...args: Parameters<dataRetriever>) => void} */
  function start(...startArgs) {
    stop();
    args = startArgs;

    /**
     * The newest block the reads cover. The first read covers the one
     * known as it begins; one heard while it is under way is read after it.
     *
     * @type {string | null}
     */
    let seen = null;
    let subscribing = true;

    unsubscribe = head.subscribe(({ head: newest }) => {
      if (!newest || newest.hash === seen) {
        return;
      }

      seen = newest.hash;

      if (!subscribing) {
        read();
      }
    });
    subscribing = false;
    read();
  }

  const reset = () => {
    stop();
    dataStore.reset();
  };

  const followingDataStore = derived(
    dataStore,
    ($dataStore, set) => {
      set($dataStore);
    },
    get(dataStore)
  );

  return {
    reset,
    start,
    stop,
    subscribe: followingDataStore.subscribe,
  };
};

export default createFollowingDataStore;
