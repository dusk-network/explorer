import { describe, expect, it, vi } from "vitest";
import { encodeDepositArgs } from "@dusk-network/networks/duskevm";

import { findDepositArrival } from "..";

describe("findDepositArrival", () => {
  const recipient = "0x5A3d8e1B7c2f4A6b9e0D1C3f5A7b9C2D4e6F8a01";
  const arrival =
    "0x029e2c6ebfe60452800c97eaa2ac36f40039812679c9cee414ea6a8b1877d61b";

  const bridge =
    "2257e5f8ff49cf7c9704a14ca35acbf48eb7ade11a079d98d5cd5655eea1b31d";

  /**
   * A deposit to DuskEVM on testnet, in a block of 06:39:09 UTC, as the
   * explorer reads it from the node: its amount as a JavaScript number.
   *
   * @param {bigint} lux
   */
  const depositOf = (lux) =>
    /** @type {Transaction} */ (
      /** @type {unknown} */ ({
        amount: 0,
        contract: bridge,
        date: new Date("2024-04-16T06:39:09Z"),
        deposit: Number(lux),
        method: "depositETHToWithValue",
        payload: {
          call: {
            // eslint-disable-next-line camelcase
            fn_args: Buffer.from(
              encodeDepositArgs({
                amountLux: lux,
                minGasLimit: 200_000,
                to: recipient,
              })
            ).toString("base64"),
          },
        },
        txerror: "",
        txid: "ac6b2f9b4148915244ca86ea08b398a96d4aaba111ad24a0e480fadb3416bc24",
      })
    );

  // 0.5 DUSK.
  const deposit = depositOf(500_000_000n);

  /**
   * DuskEVM's explorer, answering one page: the L2 bridge's payment of the
   * deposit's amount 36 seconds after its block.
   *
   * @param {object | null} next Where the next page starts
   * @param {string} [wei] What it paid
   */
  const explorer = (next, wei = "500000000000000000") =>
    vi.fn(async () =>
      Response.json({
        items: [
          {
            from: { hash: "0x4200000000000000000000000000000000000010" },
            success: true,
            timestamp: "2024-04-16T06:39:45.000000Z",
            // eslint-disable-next-line camelcase
            transaction_hash: arrival,
            value: wei,
          },
        ],
        // eslint-disable-next-line camelcase
        next_page_params: next,
      })
    );

  it("should ask DuskEVM's explorer once, for its first page, however long ago the deposit was sent", async () => {
    // A year later.
    const now = deposit.date.getTime() + 365 * 86_400_000;
    const last = explorer(null);

    await expect(
      findDepositArrival(deposit, recipient, 2, { fetch: last, now })
    ).resolves.toBe(arrival);
    expect(last).toHaveBeenCalledOnce();

    // A first page that doesn't reach back to the deposit links nothing.
    // eslint-disable-next-line camelcase
    const more = explorer({ block_number: 1, index: 0, items_count: 50 });

    await expect(
      findDepositArrival(deposit, recipient, 2, { fetch: more, now })
    ).resolves.toBeNull();
    expect(more).toHaveBeenCalledOnce();
  });

  it("should find the payment of a deposit of more LUX than a JavaScript number holds exactly", async () => {
    // 10,000,000 DUSK: past Number.MAX_SAFE_INTEGER LUX.
    const lux = 10_000_000n * 1_000_000_000n;
    const fetch = explorer(null, String(lux * 1_000_000_000n));

    await expect(
      findDepositArrival(depositOf(lux), recipient, 2, { fetch })
    ).resolves.toBe(arrival);
  });
});
