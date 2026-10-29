import { describe, expect, it, vi } from "vitest";

import { findDepositArrival } from "..";

describe("findDepositArrival", () => {
  const recipient = "0x5A3d8e1B7c2f4A6b9e0D1C3f5A7b9C2D4e6F8a01";
  const l2Bridge = "0x4200000000000000000000000000000000000010";
  const arrival =
    "0x029e2c6ebfe60452800c97eaa2ac36f40039812679c9cee414ea6a8b1877d61b";

  // A 0.5 DUSK deposit to DuskEVM, in a block of 06:39:09 UTC.
  const deposit = /** @type {Transaction} */ (
    /** @type {unknown} */ ({
      date: new Date("2024-04-16T06:39:09Z"),
      deposit: 500_000_000,
      txerror: "",
    })
  );

  /**
   * An incoming call as DuskEVM's explorer lists it.
   *
   * @param {string} hash
   * @param {string} timestamp
   * @param {{ from?: string, success?: boolean, value?: string }} [call]
   */
  const call = (
    hash,
    timestamp,
    { from = l2Bridge, success = true, value = "500000000000000000" } = {}
  ) => ({
    from: { hash: from },
    success,
    timestamp,
    // eslint-disable-next-line camelcase
    transaction_hash: hash,
    value,
  });

  /**
   * DuskEVM's explorer, answering one page of calls.
   *
   * @param {object[]} items Newest first
   * @param {object | null} [next] Where the next page starts
   */
  const explorer = (items, next = null) =>
    vi.fn(async () =>
      // eslint-disable-next-line camelcase
      Response.json({ items, next_page_params: next })
    );

  /** @param {number} n */
  const hash = (n) => `0x${String(n).repeat(64)}`;

  it("should find the L2 bridge's first payment of the deposit's amount from its block on, with one request", async () => {
    const fetch = explorer(
      [
        // Another deposit's, later.
        call(hash(1), "2024-04-16T06:52:00.000000Z"),
        call(arrival, "2024-04-16T06:39:45.000000Z"),
        call(hash(2), "2024-04-16T06:39:40.000000Z", {
          from: "0x5a3d8e1b7c2f4a6b9e0d1c3f5a7b9c2d4e6f8a02",
        }),
        call(hash(3), "2024-04-16T06:39:35.000000Z", {
          value: "100000000000000000",
        }),
        call(hash(4), "2024-04-16T06:39:30.000000Z", { success: false }),
        // From before the deposit.
        call(hash(5), "2024-04-16T06:30:00.000000Z"),
      ],
      // eslint-disable-next-line camelcase
      { block_number: 1, index: 0, items_count: 50 }
    );

    await expect(
      findDepositArrival(deposit, recipient, 2, { fetch })
    ).resolves.toBe(arrival);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]).toStrictEqual([
      `https://explorer.testnet.evm.dusk.network/api/v2/addresses/${recipient.toLowerCase()}/internal-transactions?filter=to`,
      { headers: { Accept: "application/json" } },
    ]);
  });

  it("should find none on a first page that doesn't reach back to the deposit, nor when the explorer can't say", async () => {
    const newer = [call(arrival, "2024-04-16T06:39:45.000000Z")];

    await expect(
      findDepositArrival(deposit, recipient, 2, {
        // eslint-disable-next-line camelcase
        fetch: explorer(newer, { block_number: 1, index: 0, items_count: 50 }),
      })
    ).resolves.toBeNull();

    // The last page reaches back to the start.
    await expect(
      findDepositArrival(deposit, recipient, 2, { fetch: explorer(newer) })
    ).resolves.toBe(arrival);

    await expect(
      findDepositArrival(deposit, recipient, 2, {
        fetch: vi.fn(async () => new Response("", { status: 502 })),
      })
    ).resolves.toBeNull();
  });

  it("should ask nothing for a deposit that failed, or on a network with no DuskEVM", async () => {
    const fetch = explorer([call(arrival, "2024-04-16T06:39:45.000000Z")]);

    await expect(
      findDepositArrival({ ...deposit, txerror: "Panic" }, recipient, 2, {
        fetch,
      })
    ).resolves.toBeNull();
    await expect(
      findDepositArrival(deposit, recipient, 1, { fetch })
    ).resolves.toBeNull();
    await expect(
      findDepositArrival(deposit, recipient, undefined, { fetch })
    ).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
