import { derived, get } from "svelte/store";

import { createPollingDataStore } from "$lib/dusk/svelte-stores";
import { MarketDataInfo } from "$lib/market-data";
import { isMainnet } from "$lib/network";
import { duskAPI } from "$lib/services";

import appStore from "./appStore";

const storeKey = "market-data";

/**
 * @param {"reading" | "storing"} action
 * @param {unknown} err
 */
const logStoreError = (action, err) =>
  /* eslint-disable-next-line no-console */
  console.error(`Error while ${action} market data: %s`, err);

/** @type {() => MarketDataStorage | null} */
function getStorage() {
  try {
    const storedData = localStorage.getItem(storeKey);

    return storedData ? MarketDataInfo.parse(storedData).toStorageData() : null;
  } catch (err) {
    logStoreError("reading", err);

    return null;
  }
}

/** @param {MarketDataInfo} info */
function setStorage(info) {
  try {
    localStorage.setItem(storeKey, info.toJSON());
  } catch (err) {
    logStoreError("storing", err);
  }
}

const fetchInterval = get(appStore).marketDataFetchInterval;
const pollingDataStore = createPollingDataStore(
  duskAPI.getMarketData,
  fetchInterval
);

/** @type {MarketDataStoreContent} */
const initialState = {
  ...get(pollingDataStore),
  lastUpdate: null,
  ...getStorage(),
};

const marketDataStore = derived(
  pollingDataStore,
  ($pollingDataStore, set) => {
    const current = get(marketDataStore);
    const isDataChanged = $pollingDataStore.data !== current.data;
    const hasNewData = $pollingDataStore.data && isDataChanged;
    const newStore = {
      data: $pollingDataStore.data ?? current.data,
      error: hasNewData ? null : ($pollingDataStore.error ?? current.error),
      isLoading: $pollingDataStore.isLoading,
      lastUpdate: hasNewData
        ? new Date()
        : current.data
          ? current.lastUpdate
          : null,
    };

    if (hasNewData) {
      setStorage(
        new MarketDataInfo(
          newStore.data,
          /** @type {Date}*/ (newStore.lastUpdate)
        )
      );
    }

    set(newStore);
  },
  initialState
);

function isDataStale() {
  const { error, isLoading, lastUpdate } = get(marketDataStore);

  return (
    !!lastUpdate &&
    (error !== null || (!isLoading && Date.now() > +lastUpdate + fetchInterval))
  );
}

function startPolling() {
  if (!initialState.lastUpdate || isDataStale()) {
    pollingDataStore.start();
  } else {
    setTimeout(
      pollingDataStore.start,
      +initialState.lastUpdate + fetchInterval - Date.now()
    );
  }
}

/** @type {MarketDataStoreContent} */
const noMarketData = {
  data: null,
  error: null,
  isLoading: false,
  lastUpdate: null,
};

/**
 * Test DUSK has no value: the store asks for market data, and gives what
 * it has, only once the node says it is on mainnet.
 */
const shownMarketData = derived(
  [marketDataStore, appStore],
  ([$marketDataStore, $appStore], set) => {
    set(isMainnet($appStore.nodeInfo) ? $marketDataStore : noMarketData);
  },
  noMarketData
);

let isPolling = false;

appStore.subscribe(({ nodeInfo }) => {
  if (!isPolling && isMainnet(nodeInfo)) {
    isPolling = true;
    startPolling();
  }
});

/** @type {MarketDataStore} */
export default {
  isDataStale,
  subscribe: shownMarketData.subscribe,
};
