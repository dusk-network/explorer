import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { skip, updatePathIn } from "lamb";

import * as mockData from "$lib/mock-data";

import {
  addCountAndUnique,
  transformBlock,
  transformSearchResult,
  transformTransaction,
} from "$lib/chain-info";

import { duskAPI } from "..";

describe("duskAPI", () => {
  const fetchSpy = vi.spyOn(global, "fetch");
  const node = new URL(import.meta.env.VITE_NODE_URL, import.meta.url);
  const fakeID = "some-id";
  const apiGetOptions = {
    headers: {
      Accept: "application/json",
      "Accept-Charset": "utf-8",
      Connection: "Keep-Alive",
    },
    method: "GET",
  };

  /** @type {URL} */
  const gqlExpectedURL = new URL("/on/graphql/query", node);

  /** @type {(data: Record<string | number, any> | number) => Response} */
  const makeOKResponse = (data) =>
    new Response(JSON.stringify(data), { status: 200 });

  afterEach(() => {
    fetchSpy.mockClear();
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  it("should expose a method to retrieve a single block", async () => {
    const getByHeightSpy = vi.spyOn(duskAPI, "getBlockHashByHeight");

    fetchSpy
      .mockResolvedValueOnce(
        makeOKResponse(
          updatePathIn(
            mockData.gqlBlock,
            "block.header",
            skip(["nextBlockHash"])
          )
        )
      )
      .mockResolvedValueOnce(
        makeOKResponse({
          block: {
            header: {
              hash: mockData.gqlBlock.block.header.nextBlockHash,
            },
          },
        })
      );

    await expect(duskAPI.getBlock(fakeID)).resolves.toStrictEqual(
      transformBlock(mockData.gqlBlock.block)
    );
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0][0]).toStrictEqual(gqlExpectedURL);
    expect(fetchSpy.mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "body": "fragment TransactionInfo on SpentTransaction { blockHash, blockHeight, blockTimestamp, err, gasSpent, id, tx { blobHashes, callData { contractId, data, fnName }, gasLimit, gasPrice, id, isDeploy, memo, txType, json } } fragment BlockInfo on Block { header { hash, gasLimit, height, prevBlockHash, seed, stateHash, timestamp, version }, fees, gasSpent, reward, transactions {...TransactionInfo} } query { block(hash: "some-id") {...BlockInfo} }",
        "headers": {
          "Content-Type": "text/plain",
        },
        "method": "POST",
      }
    `);
    expect(fetchSpy.mock.calls[1][0]).toStrictEqual(gqlExpectedURL);
    expect(fetchSpy.mock.calls[1][1]).toMatchInlineSnapshot(`
      {
        "body": "query { block(height: 495869) { header { hash } } }",
        "headers": {
          "Content-Type": "text/plain",
        },
        "method": "POST",
      }
    `);
    expect(getByHeightSpy).toHaveBeenCalledTimes(1);
    expect(getByHeightSpy).toHaveBeenCalledWith(
      mockData.gqlBlock.block.header.height + 1
    );

    getByHeightSpy.mockRestore();
  });

  it("should expose a method to retrieve a block hash by its height", async () => {
    const expectedHash = mockData.gqlBlock.block.header.nextBlockHash;

    fetchSpy
      .mockResolvedValueOnce(
        makeOKResponse({
          block: {
            header: {
              hash: expectedHash,
            },
          },
        })
      )
      .mockResolvedValueOnce(
        makeOKResponse({
          block: null,
        })
      );

    await expect(duskAPI.getBlockHashByHeight(11)).resolves.toBe(expectedHash);
    await expect(duskAPI.getBlockHashByHeight(11)).resolves.toBe("");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0][0]).toStrictEqual(gqlExpectedURL);
    expect(fetchSpy.mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "body": "query { block(height: 11) { header { hash } } }",
        "headers": {
          "Content-Type": "text/plain",
        },
        "method": "POST",
      }
    `);
    // expect(fetchSpy.mock.calls[1][0]).toStrictEqual(gqlExpectedURL);
    expect(fetchSpy.mock.calls[1][1]).toMatchInlineSnapshot(`
      {
        "body": "query { block(height: 11) { header { hash } } }",
        "headers": {
          "Content-Type": "text/plain",
        },
        "method": "POST",
      }
    `);
  });

  it("should expose a method to retrieve the details of a single block", async () => {
    fetchSpy.mockResolvedValueOnce(makeOKResponse(mockData.gqlBlockDetails));

    await expect(duskAPI.getBlockDetails(fakeID)).resolves.toBe(
      mockData.gqlBlockDetails.block.header.json
    );
    expect(fetchSpy.mock.calls[0][0]).toStrictEqual(gqlExpectedURL);
    expect(fetchSpy.mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "body": "query { block(hash: "some-id") { header { json } } }",
        "headers": {
          "Content-Type": "text/plain",
        },
        "method": "POST",
      }
    `);
  });

  it("should expose a method to retrieve the list of blocks", async () => {
    fetchSpy.mockResolvedValueOnce(makeOKResponse(mockData.gqlBlocks));

    await expect(duskAPI.getBlocks(100)).resolves.toStrictEqual(
      mockData.gqlBlocks.blocks.map(transformBlock)
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toStrictEqual(gqlExpectedURL);
    expect(fetchSpy.mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "body": "fragment TransactionInfo on SpentTransaction { blockHash, blockHeight, blockTimestamp, err, gasSpent, id, tx { blobHashes, callData { contractId, data, fnName }, gasLimit, gasPrice, id, isDeploy, memo, txType, json } } fragment BlockInfo on Block { header { hash, gasLimit, height, prevBlockHash, seed, stateHash, timestamp, version }, fees, gasSpent, reward, transactions {...TransactionInfo} } query { blocks(last: 100) {...BlockInfo} }",
        "headers": {
          "Content-Type": "text/plain",
        },
        "method": "POST",
      }
    `);
  });

  it("should expose a method to retrieve the latest chain info", async () => {
    fetchSpy.mockResolvedValueOnce(makeOKResponse(mockData.gqlLatestChainInfo));

    await expect(duskAPI.getLatestChainInfo(15)).resolves.toStrictEqual({
      blocks: mockData.gqlLatestChainInfo.blocks.map(transformBlock),
      transactions:
        mockData.gqlLatestChainInfo.transactions.map(transformTransaction),
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toStrictEqual(gqlExpectedURL);
    expect(fetchSpy.mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "body": "fragment TransactionInfo on SpentTransaction { blockHash, blockHeight, blockTimestamp, err, gasSpent, id, tx { blobHashes, callData { contractId, data, fnName }, gasLimit, gasPrice, id, isDeploy, memo, txType, json } } fragment BlockInfo on Block { header { hash, gasLimit, height, prevBlockHash, seed, stateHash, timestamp, version }, fees, gasSpent, reward, transactions {...TransactionInfo} } query { blocks(last: 15) {...BlockInfo}, transactions(last: 15) {...TransactionInfo} }",
        "headers": {
          "Content-Type": "text/plain",
        },
        "method": "POST",
      }
    `);
  });

  it("should expose a method to retrieve the market data", async () => {
    const mockSupply = "456000000";

    fetchSpy
      .mockResolvedValueOnce(makeOKResponse(mockData.apiMarketData))
      .mockResolvedValueOnce(new Response(mockSupply, { status: 200 }));

    /** @type {Record<string, number>} */
    const expectedMarketCap = {};
    Object.keys(mockData.apiMarketData.market_data.current_price).forEach(
      (currency) => {
        expectedMarketCap[currency] =
          parseFloat(mockSupply) *
          /** @type {Record<string, number>} */ (
            mockData.apiMarketData.market_data.current_price
          )[currency];
      }
    );

    await expect(duskAPI.getMarketData()).resolves.toStrictEqual({
      currentPrice: mockData.apiMarketData.market_data.current_price,
      marketCap: expectedMarketCap,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      new URL(
        "https://api.coingecko.com/api/v3/coins/dusk-network?community_data=false&developer_data=false&localization=false&market_data=true&sparkline=false&tickers=false"
      ),
      apiGetOptions
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(2, "https://supply.dusk.network/");
  });

  it("should fallback to CoinGecko market cap when supply endpoint fails", async () => {
    fetchSpy
      .mockResolvedValueOnce(makeOKResponse(mockData.apiMarketData))
      .mockRejectedValueOnce(new Error("Supply endpoint unavailable"));

    await expect(duskAPI.getMarketData()).resolves.toStrictEqual({
      currentPrice: mockData.apiMarketData.market_data.current_price,
      marketCap: mockData.apiMarketData.market_data.market_cap,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      new URL(
        "https://api.coingecko.com/api/v3/coins/dusk-network?community_data=false&developer_data=false&localization=false&market_data=true&sparkline=false&tickers=false"
      ),
      apiGetOptions
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(2, "https://supply.dusk.network/");
  });

  it("should expose a method to retrieve the node locations", async () => {
    fetchSpy.mockResolvedValueOnce(makeOKResponse(mockData.apiNodeLocations));

    await expect(duskAPI.getNodeLocations()).resolves.toStrictEqual(
      addCountAndUnique(mockData.apiNodeLocations)
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("should expose a method to retrieve the host provisioners", async () => {
    fetchSpy.mockResolvedValueOnce(makeOKResponse(mockData.hostProvisioners));

    await expect(duskAPI.getProvisioners()).resolves.toStrictEqual(
      mockData.hostProvisioners
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("should expose a method to retrieve the node info", async () => {
    fetchSpy.mockResolvedValueOnce(makeOKResponse(mockData.apiNodeInfo));

    await expect(duskAPI.getNodeInfo()).resolves.toStrictEqual(
      mockData.apiNodeInfo
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("should share one node info request between callers at the same time", async () => {
    fetchSpy
      .mockResolvedValueOnce(makeOKResponse(mockData.apiNodeInfo))
      .mockResolvedValueOnce(makeOKResponse(mockData.apiNodeInfo));

    const [first, second] = await Promise.all([
      duskAPI.getNodeInfo(),
      duskAPI.getNodeInfo(),
    ]);

    expect(first).toStrictEqual(mockData.apiNodeInfo);
    expect(second).toBe(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // A later call asks the node again.
    await duskAPI.getNodeInfo();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("should read the last block's height, hash and time, and how many transactions it holds, in one query", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeOKResponse({
        block: {
          header: { hash: "abc", height: 4692520, timestamp: 1793032599 },
          transactions: [{ id: "a1" }, { id: "b2" }],
        },
      })
    );

    await expect(duskAPI.getChainTip()).resolves.toStrictEqual({
      date: new Date(1793032599 * 1000),
      hash: "abc",
      height: 4692520,
      transactions: 2,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toStrictEqual(gqlExpectedURL);
    expect(fetchSpy.mock.calls[0][1]?.body).toBe(
      "query { block(height: -1) { header { hash height timestamp } transactions { id } } }"
    );
  });

  it("should share one request for the last block between callers at the same time", async () => {
    fetchSpy.mockImplementation(async () =>
      makeOKResponse({
        block: {
          header: { hash: "abc", height: 4692520, timestamp: 1793032599 },
          transactions: [],
        },
      })
    );

    const [first, second] = await Promise.all([
      duskAPI.getChainTip(),
      duskAPI.getChainTip(),
    ]);

    expect(second).toBe(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // A later call asks the node again.
    await duskAPI.getChainTip();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    fetchSpy.mockReset();
  });

  it("should send each GraphQL query as plain text, its values written in and no other header, so a browser asks the node nothing first", async () => {
    const queries = [
      () => duskAPI.getBlock(fakeID),
      () => duskAPI.getBlockDetails(fakeID),
      () => duskAPI.getBlockHashByHeight(11),
      () => duskAPI.getBlocks(100),
      () => duskAPI.getBlocksAfter(10, 25),
      () => duskAPI.getChainTip(),
      () => duskAPI.getLatestChainInfo(15),
      () => duskAPI.getTransaction(fakeID),
      () => duskAPI.getTransactions(25),
      () => duskAPI.getTransactionsAfter(10, 25),
      () => duskAPI.getTransactionsById([fakeID]),
      () => duskAPI.getTransactionsIn([[10, 25]]),
      () => duskAPI.search("1".repeat(64)),
      () => duskAPI.search("123456"),
    ];

    // Each answer a 500, as the requests are all that is looked at.
    fetchSpy.mockImplementation(async () => new Response("", { status: 500 }));

    for (const query of queries) {
      await query().catch(() => {});
    }

    const gql = fetchSpy.mock.calls.filter(
      ([url]) => String(url) === gqlExpectedURL.href
    );

    expect(gql).toHaveLength(queries.length);

    for (const [, init] of gql) {
      // A "simple request": a POST of text, with no header of its own.
      expect(init).toStrictEqual({
        body: expect.any(String),
        headers: { "Content-Type": "text/plain" },
        method: "POST",
      });
      expect(init?.body).not.toMatch(/\$\w/);
    }

    fetchSpy.mockReset();
  });

  it("should write a searched text into its query as a string, whatever it holds", async () => {
    const tricky = `${"a".repeat(30)}") { id } evil: tx(hash: "${"b".repeat(8)}`;

    expect(tricky).toHaveLength(64);
    fetchSpy.mockResolvedValueOnce(makeOKResponse({ block: null, tx: null }));

    await duskAPI.search(tricky);

    expect(fetchSpy.mock.calls[0][1]?.body).toBe(
      `query { block(hash: ${JSON.stringify(tricky)}) { header { hash } }, tx(hash: ${JSON.stringify(tricky)}) { id } }`
    );
  });

  it("should read the transactions of ranges of blocks in one query, newest block first and in a block in its order", async () => {
    const [a, b, c] = mockData.gqlTransactions.transactions;

    fetchSpy.mockResolvedValueOnce(
      makeOKResponse({
        r0: [
          { ...a, blockHeight: 300 },
          { ...b, blockHeight: 399 },
          { ...c, blockHeight: 399 },
        ],
        r1: [],
      })
    );

    await expect(
      duskAPI.getTransactionsIn([
        [200, 399],
        [0, 199],
      ])
    ).resolves.toStrictEqual(
      [
        { ...b, blockHeight: 399 },
        { ...c, blockHeight: 399 },
        { ...a, blockHeight: 300 },
      ].map(transformTransaction)
    );
    expect(fetchSpy.mock.calls[0][1]?.body).toContain(
      "r0: blockTxs(range: [200, 399]) {...TransactionInfo} r1: blockTxs(range: [0, 199]) {...TransactionInfo}"
    );
  });

  it("should read transactions by their IDs in one query, in their order, leaving out those the node doesn't have", async () => {
    const [first, second] = mockData.gqlTransactions.transactions;

    fetchSpy.mockResolvedValueOnce(
      makeOKResponse({ tx0: second, tx1: null, tx2: first })
    );

    await expect(
      duskAPI.getTransactionsById([second.id, "unknown", first.id])
    ).resolves.toStrictEqual([second, first].map(transformTransaction));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1]?.body).toContain(
      `tx0: tx(hash: "${second.id}") { ...TransactionInfo } tx1: tx(hash: "unknown") { ...TransactionInfo } tx2: tx(hash: "${first.id}") { ...TransactionInfo }`
    );
    await expect(duskAPI.getTransactionsById([])).resolves.toStrictEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("should read the blocks after a height, and that height's hash, in one query, newest first", async () => {
    const oldestFirst = [...mockData.gqlBlocks.blocks.slice(0, 3)].reverse();

    fetchSpy.mockResolvedValueOnce(
      makeOKResponse({
        anchor: { header: { hash: "abc" } },
        blocks: oldestFirst,
      })
    );

    await expect(duskAPI.getBlocksAfter(10, 25)).resolves.toStrictEqual({
      anchor: "abc",
      blocks: mockData.gqlBlocks.blocks.slice(0, 3).map(transformBlock),
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toStrictEqual(gqlExpectedURL);
    expect(fetchSpy.mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "body": "fragment TransactionInfo on SpentTransaction { blockHash, blockHeight, blockTimestamp, err, gasSpent, id, tx { blobHashes, callData { contractId, data, fnName }, gasLimit, gasPrice, id, isDeploy, memo, txType, json } } fragment BlockInfo on Block { header { hash, gasLimit, height, prevBlockHash, seed, stateHash, timestamp, version }, fees, gasSpent, reward, transactions {...TransactionInfo} } query { anchor: block(height: 10) { header { hash } }, blocks(range: [11, 25]) {...BlockInfo} }",
        "headers": {
          "Content-Type": "text/plain",
        },
        "method": "POST",
      }
    `);
  });

  it("should read the transactions of the blocks after a height, with those blocks and that height's hash, in one query, newest first", async () => {
    const [newer, older] = mockData.gqlBlocks.blocks.filter(
      (block) => block.transactions.length
    );

    fetchSpy.mockResolvedValueOnce(
      makeOKResponse({
        anchor: null,
        blocks: [
          { header: older.header, transactions: older.transactions },
          { header: newer.header, transactions: newer.transactions },
        ],
      })
    );

    await expect(
      duskAPI.getTransactionsAfter(older.header.height - 1, newer.header.height)
    ).resolves.toStrictEqual({
      anchor: null,
      blocks: [newer, older].map(({ header }) => ({
        hash: header.hash,
        height: header.height,
        prevblockhash: header.prevBlockHash,
      })),
      transactions: [...newer.transactions, ...older.transactions].map(
        transformTransaction
      ),
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "body": "fragment TransactionInfo on SpentTransaction { blockHash, blockHeight, blockTimestamp, err, gasSpent, id, tx { blobHashes, callData { contractId, data, fnName }, gasLimit, gasPrice, id, isDeploy, memo, txType, json } } query { anchor: block(height: 1365376) { header { hash } }, blocks(range: [1365377, 1365383]) { header { hash, height, prevBlockHash }, transactions {...TransactionInfo} } }",
        "headers": {
          "Content-Type": "text/plain",
        },
        "method": "POST",
      }
    `);
  });

  it("should read an account's stake from the stake contract in one JSON query", async () => {
    const address = mockData.hostProvisioners[0].key;

    fetchSpy.mockResolvedValueOnce(
      makeOKResponse({
        amount: {
          eligibility: "123120",
          locked: "999637120000000",
          value: "362880000000",
        },
        faults: 10,
        // eslint-disable-next-line camelcase
        hard_faults: 0,
        reward: "31027186",
      })
    );

    await expect(duskAPI.getStake(address)).resolves.toStrictEqual({
      active: 362880000000n,
      eligibility: 123120,
      faults: 10,
      hardFaults: 0,
      inactive: 999637120000000n,
      reward: 31027186n,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0];

    expect(String(url)).toBe(
      new URL(
        "/on/contracts:0200000000000000000000000000000000000000000000000000000000000000/get_stake",
        node
      ).href
    );
    expect(init).toMatchObject({
      body: JSON.stringify(address),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  });

  it("should keep stake amounts exact, past what a number holds", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeOKResponse({
        amount: {
          eligibility: "3086640",
          locked: "1048434300000001",
          value: "13102790940789549",
        },
        faults: 0,
        // eslint-disable-next-line camelcase
        hard_faults: 0,
        reward: "9007199254740993",
      })
    );

    await expect(
      duskAPI.getStake(mockData.hostProvisioners[0].key)
    ).resolves.toMatchObject({
      active: 13102790940789549n,
      inactive: 1048434300000001n,
      reward: 9007199254740993n,
    });
  });

  it("should give no stake for a key the stake contract doesn't know", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("null", { status: 200 }));

    await expect(
      duskAPI.getStake(mockData.hostProvisioners[0].key)
    ).resolves.toBeNull();
  });

  it("should expose a method to retrieve a single transaction", async () => {
    fetchSpy.mockResolvedValueOnce(makeOKResponse(mockData.gqlTransaction));

    await expect(duskAPI.getTransaction(fakeID)).resolves.toStrictEqual(
      transformTransaction(mockData.gqlTransaction.tx)
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toStrictEqual(gqlExpectedURL);
    expect(fetchSpy.mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "body": "fragment TransactionInfo on SpentTransaction { blockHash, blockHeight, blockTimestamp, err, gasSpent, id, tx { blobHashes, callData { contractId, data, fnName }, gasLimit, gasPrice, id, isDeploy, memo, txType, json } } query { tx(hash: "some-id") { ...TransactionInfo tx { json } } }",
        "headers": {
          "Content-Type": "text/plain",
        },
        "method": "POST",
      }
    `);
  });

  it("should expose a method to retrieve the list of transactions", async () => {
    fetchSpy.mockResolvedValueOnce(makeOKResponse(mockData.gqlTransactions));

    await expect(duskAPI.getTransactions(100)).resolves.toStrictEqual(
      mockData.gqlTransactions.transactions.map(transformTransaction)
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toStrictEqual(gqlExpectedURL);
    expect(fetchSpy.mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "body": "fragment TransactionInfo on SpentTransaction { blockHash, blockHeight, blockTimestamp, err, gasSpent, id, tx { blobHashes, callData { contractId, data, fnName }, gasLimit, gasPrice, id, isDeploy, memo, txType, json } } query { transactions(last: 100) {...TransactionInfo} }",
        "headers": {
          "Content-Type": "text/plain",
        },
        "method": "POST",
      }
    `);
  });

  it("should return a rejected promise, with the original Response in the error's `cause` property, for a 4xx error", async () => {
    const apiMethods = Object.keys(duskAPI).filter(
      (k) => typeof k === "function"
    );

    for (const apiMethod of apiMethods) {
      const notFoundResponse = new Response("", { status: 404 });

      fetchSpy.mockResolvedValueOnce(notFoundResponse);

      await expect(() =>
        // @ts-expect-error we don't care of the parameters we pass as the call to fetch is mocked
        duskAPI[apiMethod]("foo/bar", "some-id")
      ).rejects.toThrow(
        expect.objectContaining({
          cause: notFoundResponse,
        })
      );
    }
  });

  it("should be able to make the correct request whether the endpoint in env vars ends with a trailing slash or not", () => {
    const expectedURL = new URL(
      "https://nodes.dusk.network/on/network/peers_location"
    );

    fetchSpy
      .mockResolvedValueOnce(makeOKResponse(mockData.apiNodeLocations))
      .mockResolvedValueOnce(makeOKResponse(mockData.apiNodeLocations));

    duskAPI.getNodeLocations();
    duskAPI.getNodeLocations();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(1, expectedURL, {
      headers: {
        Accept: "application/json",
        "Accept-Charset": "utf-8",
        Connection: "Keep-Alive",
      },
      method: "POST",
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(2, expectedURL, {
      headers: {
        Accept: "application/json",
        "Accept-Charset": "utf-8",
        Connection: "Keep-Alive",
      },
      method: "POST",
    });

    vi.unstubAllEnvs();
  });

  it("should expose a method to search for blocks and transactions", async () => {
    const fakeHash1 = Array(64).fill(1).join("");
    const fakeHash2 = Array(64).fill(2).join("");
    const hashResult = {
      block: {
        header: {
          hash: fakeHash1,
        },
      },
    };
    const heightResult = {
      block: {
        header: {
          hash: fakeHash2,
        },
      },
    };

    fetchSpy
      .mockResolvedValueOnce(makeOKResponse(hashResult))
      .mockResolvedValueOnce(makeOKResponse(heightResult));

    await expect(duskAPI.search(fakeHash1)).resolves.toStrictEqual(
      transformSearchResult(hashResult)
    );

    await expect(duskAPI.search(fakeHash2)).resolves.toStrictEqual(
      transformSearchResult(heightResult)
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0][0]).toStrictEqual(gqlExpectedURL);
    expect(fetchSpy.mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "body": "query { block(hash: "1111111111111111111111111111111111111111111111111111111111111111") { header { hash } }, tx(hash: "1111111111111111111111111111111111111111111111111111111111111111") { id } }",
        "headers": {
          "Content-Type": "text/plain",
        },
        "method": "POST",
      }
    `);
    expect(fetchSpy.mock.calls[1][0]).toStrictEqual(gqlExpectedURL);
    expect(fetchSpy.mock.calls[1][1]).toMatchInlineSnapshot(`
      {
        "body": "query { block(hash: "2222222222222222222222222222222222222222222222222222222222222222") { header { hash } }, tx(hash: "2222222222222222222222222222222222222222222222222222222222222222") { id } }",
        "headers": {
          "Content-Type": "text/plain",
        },
        "method": "POST",
      }
    `);
  });

  it("should not perform the height search if the query string doesn't contain only numbers", async () => {
    const entryHash =
      "fda46b4e06cc78542db9c780adbaee83a27fdf917de653e8ac34294cf924dd63";

    fetchSpy.mockResolvedValueOnce(
      makeOKResponse(mockData.gqlSearchPossibleResults[0])
    );

    await expect(duskAPI.search(entryHash)).resolves.toStrictEqual(
      transformSearchResult(mockData.gqlSearchPossibleResults[0])
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toStrictEqual(gqlExpectedURL);
    expect(fetchSpy.mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "body": "query { block(hash: "fda46b4e06cc78542db9c780adbaee83a27fdf917de653e8ac34294cf924dd63") { header { hash } }, tx(hash: "fda46b4e06cc78542db9c780adbaee83a27fdf917de653e8ac34294cf924dd63") { id } }",
        "headers": {
          "Content-Type": "text/plain",
        },
        "method": "POST",
      }
    `);
  });

  it("should not perform the hash search if the query string isn't of 64 characters", async () => {
    const entryHeight = "123456";

    fetchSpy.mockResolvedValueOnce(
      makeOKResponse(mockData.gqlSearchPossibleResults[0])
    );

    await expect(duskAPI.search(entryHeight)).resolves.toStrictEqual(
      transformSearchResult(mockData.gqlSearchPossibleResults[0])
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toStrictEqual(gqlExpectedURL);
    expect(fetchSpy.mock.calls[0][1]).toMatchInlineSnapshot(`
      {
        "body": "query { block(height: 123456) { header { hash } } }",
        "headers": {
          "Content-Type": "text/plain",
        },
        "method": "POST",
      }
    `);
  });

  it("should not perform any search at all if the query string doesn't satisfy criteria for both hash and height", async () => {
    await expect(duskAPI.search("abc")).resolves.toStrictEqual(null);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should return a mempool message if the transaction is in the mempool", async () => {
    fetchSpy
      .mockResolvedValueOnce(makeOKResponse({ tx: null }))
      .mockResolvedValueOnce(makeOKResponse({ mempoolTx: true }));

    await expect(duskAPI.getTransaction(fakeID)).resolves.toBe(
      "This transaction is currently in the mempool and has not yet been confirmed. The transaction details will be displayed after confirmation."
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0][0]).toStrictEqual(gqlExpectedURL);
    expect(fetchSpy.mock.calls[1][0]).toStrictEqual(gqlExpectedURL);
  });

  it("should throw an error if the transaction is not found", async () => {
    fetchSpy
      .mockResolvedValueOnce(makeOKResponse({ tx: null }))
      .mockResolvedValueOnce(makeOKResponse({ mempoolTx: null }));

    await expect(duskAPI.getTransaction(fakeID)).rejects.toThrow(
      "Transaction not found"
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0][0]).toStrictEqual(gqlExpectedURL);
    expect(fetchSpy.mock.calls[1][0]).toStrictEqual(gqlExpectedURL);
  });
});
