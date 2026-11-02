type MarketData = {
  /** The DUSK in circulation; not in data stored before it was read. */
  circulatingSupply?: number | null;
  currentPrice: Record<string, number>;
  marketCap: Record<string, number>;
  /** The price's change over 24 hours, in percent; as the supply. */
  priceChange24h?: number | null;
};

type MarketDataStorage = {
  data: MarketData;
  lastUpdate: Date;
};
