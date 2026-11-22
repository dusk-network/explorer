import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { encodeDepositArgs } from "@dusk-network/networks/duskevm";

import { calculateStats } from "$lib/chain-info";
import { bridgeDepositRecipient } from "$lib/contracts";
import { formatDuskExact } from "$lib/dusk/currency";
import { duskAPI } from "$lib/services";

import {
  BlockDetails,
  BlocksList,
  BlocksTable,
  DuskAmount,
  ProvisionersCard,
  TransactionDetails,
  TransactionsList,
  TransactionsTable,
} from "..";

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getPrimaryName: vi.fn().mockResolvedValue(null),
}));

/*
 * What is shown as exact is exact, from the node's raw answer on: it writes
 * u64s as bare numbers, and past 2^53 a JavaScript number can't hold each.
 */

// The two largest stakes on mainnet, 2^53 + 1 and the largest u64: as
// text, since a literal of any would be rounded here too.
const STAKE = "14927768807078791";
const STAKE_2 = "13102790940789547";
const PAST = "9007199254740993";
const MAX = "18446744073709551615";

const IN_DUSK = {
  [STAKE]: "14,927,768.807078791",
  [STAKE_2]: "13,102,790.940789547",
  [PAST]: "9,007,199.254740993",
  [MAX]: "18,446,744,073.709551615",
};

const CASES = Object.entries(IN_DUSK);

const account =
  "kT5BamV2Xq6JpnoCq9ux7EmYRShdg4W1sLzyGFUqicmZTqxeMWLiTGpBWNhpjiPtKqvWFFmdxVBAjts3oEnZgPfuiyTRwDdASJQjTSy7wNhHdCeKtzExREcXZsmmMRLwKbXj";
const hash = "3c6e4018cfa86723e50644e33d3990bc27fc794f6b49fbf6290e4d308e07bd2d";

/**
 * A provisioner, as the node writes it.
 *
 * @param {{ key: string, amount?: string, locked?: string, reward?: string, eligibility?: number }} fields
 */
const provisionerJson = ({
  key,
  amount = "0",
  locked = "0",
  reward = "0",
  eligibility = 2160,
}) =>
  `{"amount":${amount},"eligibility":${eligibility},"faults":0,"hard_faults":0,"key":"${key}","locked_amt":${locked},"owner":{"Account":"${key}"},"reward":${reward}}`;

/**
 * A transaction's payload, as the node writes it inside its answer.
 *
 * @param {{ value?: string, deposit?: string, nonce?: string, call?: string }} fields
 */
const payloadJson = ({
  value = "0",
  deposit = "0",
  nonce = "1",
  call = "null",
}) =>
  `{"type":"moonlight","sender":"${account}","receiver":null,"value":${value},"nonce":${nonce},"deposit":${deposit},"call":${call},"memo":null}`;

/**
 * A spent transaction, as the node's GraphQL writes it.
 *
 * @param {{ payload: string, callData?: string, gasSpent?: string, gasPrice?: string, gasLimit?: string }} fields
 */
const transactionJson = ({
  payload,
  callData = "null",
  gasSpent = "290766",
  gasPrice = "1",
  gasLimit = "2500000",
}) =>
  `{"blockHash":"${hash}","blockHeight":487166,"blockTimestamp":1713249549,"err":null,"gasSpent":${gasSpent},"id":"${hash}","tx":{"blobHashes":null,"callData":${callData},"gasLimit":${gasLimit},"gasPrice":${gasPrice},"id":"${hash}","isDeploy":false,"memo":"","txType":"Moonlight","json":${JSON.stringify(payload)}}}`;

/**
 * A block with no transactions, as the node's GraphQL writes it.
 *
 * @param {{ reward: string, fees: string }} fields
 */
const blockJson = ({ reward, fees }) =>
  `{"fees":${fees},"gasSpent":290766,"header":{"gasLimit":3000000000,"generatorBlsPubkey":"${account}","hash":"${hash}","height":487166,"prevBlockHash":"${hash}","seed":"00","stateHash":"${hash}","timestamp":1713249549},"reward":${reward},"transactions":[]}`;

describe("exact amounts", () => {
  const fetchSpy = vi.spyOn(global, "fetch");

  /** @param {string} text The node's next answer, as it comes */
  const answer = (text) =>
    fetchSpy.mockResolvedValueOnce(new Response(text, { status: 200 }));

  /** @param {HTMLElement} container */
  const titlesIn = (container) =>
    Array.from(container.querySelectorAll("[title]"), (element) =>
      element.getAttribute("title"),
    );

  /**
   * A row's value, found by the name of its field.
   *
   * @param {HTMLElement} container
   * @param {RegExp} field
   */
  const valueOf = (container, field) =>
    Array.from(container.querySelectorAll("dt"))
      .find((term) => field.test(term.textContent?.trim() ?? ""))
      ?.nextElementSibling?.textContent?.replace(/\s+/g, " ")
      .trim();

  afterEach(() => {
    cleanup();
    fetchSpy.mockReset();
  });

  afterAll(() => {
    fetchSpy.mockRestore();
    vi.doUnmock("$lib/dusk-domains");
  });

  it.each(CASES)(
    "should keep a stake, inactive stake and reward of %s LUX exact, in the table and on a phone",
    async (lux, dusk) => {
      for (const isSmallScreen of [false, true]) {
        answer(
          `[${provisionerJson({ amount: lux, key: "a", locked: lux, reward: lux })}]`,
        );

        const { container, unmount } = render(ProvisionersCard, {
          props: {
            error: null,
            isSmallScreen,
            loading: false,
            provisioners: await duskAPI.getProvisioners(),
          },
        });

        expect(titlesIn(container)).toStrictEqual([
          `${dusk} DUSK`,
          `${dusk} DUSK`,
          `${dusk} DUSK`,
        ]);
        unmount();
      }
    },
  );

  it.each(CASES)(
    "should keep an account's balance of %s LUX exact",
    async (lux, dusk) => {
      answer(`{"balance":${lux},"next_nonce":2,"nonce":1}`);

      const { balance } = await duskAPI.getAccountStatus(account);
      const { container } = render(DuskAmount, { props: { lux: balance } });

      expect(container.querySelector(".dusk-amount")).toHaveAttribute(
        "data-tooltip-text",
        `${dusk} DUSK`,
      );
    },
  );

  it("should rank and sort stakes and rewards a single LUX apart, past 2^53", async () => {
    // A number rounds both of each pair to one: the node's order stayed.
    answer(
      `[${provisionerJson({ amount: "9007199254740992", key: "less", reward: "18446744073709551615" })},${provisionerJson({ amount: PAST, key: "more", reward: "18446744073709551614" })}]`,
    );

    const { container } = render(ProvisionersCard, {
      props: {
        error: null,
        isSmallScreen: false,
        loading: false,
        provisioners: await duskAPI.getProvisioners(),
      },
    });
    const rows = () =>
      Array.from(container.querySelectorAll("tbody tr"), (row) => [
        row.querySelector(".provisioners-table__rank")?.textContent,
        row.querySelector("a")?.getAttribute("href")?.split("key=")[1],
      ]);
    const [, , , stake, reward] = container.querySelectorAll("th button");

    expect(rows()).toStrictEqual([
      ["1", "more"],
      ["2", "less"],
    ]);

    await fireEvent.click(stake);

    expect(rows()).toStrictEqual([
      ["2", "less"],
      ["1", "more"],
    ]);

    await fireEvent.click(reward);

    expect(rows()).toStrictEqual([
      ["2", "less"],
      ["1", "more"],
    ]);

    await fireEvent.click(reward);

    expect(rows()).toStrictEqual([
      ["1", "more"],
      ["2", "less"],
    ]);
  });

  it("should put the most rewards first among those with no stake, to the LUX", async () => {
    answer(
      `[${provisionerJson({ eligibility: 0, key: "less", reward: "9007199254740992" })},${provisionerJson({ eligibility: 0, key: "more", reward: PAST })}]`,
    );

    const { container, getByRole } = render(ProvisionersCard, {
      props: {
        error: null,
        isSmallScreen: true,
        loading: false,
        provisioners: await duskAPI.getProvisioners(),
      },
    });

    await fireEvent.click(getByRole("switch"));

    expect(
      Array.from(
        container.querySelectorAll("a"),
        (link) => link.getAttribute("href")?.split("key=")[1],
      ),
    ).toStrictEqual(["more", "less"]);
  });

  it("should total the active and the waiting stake exactly", async () => {
    // Stakes past 2^53 LUX and one of 1,000 DUSK, which a number holds.
    answer(
      `[${[STAKE, STAKE_2, PAST, "1000000000000"]
        .map((amount, n) => provisionerJson({ amount, key: `active${n}` }))
        .join(
          ",",
        )},${provisionerJson({ amount: MAX, eligibility: 9000, key: "waiting" })}]`,
    );

    const { activeStake, waitingStake } = calculateStats(
      await duskAPI.getProvisioners(),
      4320,
    );

    expect(formatDuskExact(activeStake)).toBe("37,038,759.002609331");
    expect(formatDuskExact(waitingStake)).toBe("18,446,744,073.709551615");
  });

  it.each(CASES)(
    "should keep a transfer of %s LUX exact on its page, with its gas, nonce and payload",
    async (lux, dusk) => {
      answer(
        `{"tx":${transactionJson({
          gasLimit: MAX,
          gasPrice: PAST,
          gasSpent: "1",
          payload: payloadJson({ deposit: lux, nonce: MAX, value: lux }),
        })}}`,
      );

      const { container } = render(TransactionDetails, {
        props: {
          data: /** @type {Transaction} */ (await duskAPI.getTransaction(hash)),
          error: null,
          loading: false,
          market: null,
        },
      });

      await vi.waitFor(() =>
        expect(
          container.querySelector(".transaction-details__summary-text span"),
        ).toHaveTextContent(`${dusk} DUSK`, { normalizeWhitespace: true }),
      );
      expect(valueOf(container, /^amount$/i)).toBe(`${dusk} DUSK`);
      expect(valueOf(container, /deposit$/i)).toBe(`${dusk} DUSK`);
      expect(valueOf(container, /fee$/i)).toBe("9,007,199.254740993 DUSK");
      expect(valueOf(container, /gas used/i)).toBe(
        "1 of 18,446,744,073,709,551,615",
      );
      expect(valueOf(container, /gas price/i)).toBe(
        "9,007,199,254,740,993 LUX",
      );
      expect(valueOf(container, /nonce/i)).toBe(MAX);

      await fireEvent.click(
        /** @type {HTMLElement} */ (
          container.querySelector(".transaction-details__payload-switch")
        ),
      );

      const lines = container
        .querySelector("pre")
        ?.textContent?.split("\n")
        .map((line) => line.trim().replace(/,$/, ""));

      expect(lines).toContain(`"value": ${lux}`);
      expect(lines).toContain(`"deposit": ${lux}`);
      expect(lines).toContain(`"nonce": ${MAX}`);
    },
  );

  it("should give a fee exactly where gas times price passes 2^53", async () => {
    // 2,999,999,999 × 3,002,403 LUX: each a safe number, their product odd.
    answer(
      `{"transactions":[${transactionJson({
        gasPrice: "3002403",
        gasSpent: "2999999999",
        payload: payloadJson({}),
      })}]}`,
    );

    const [{ feepaid }] = await duskAPI.getTransactions(1);

    expect(formatDuskExact(feepaid)).toBe("9,007,208.996997597");
  });

  it.each(CASES)(
    "should keep an amount and a fee of %s LUX exact in the lists of transactions",
    async (lux, dusk) => {
      answer(
        `{"transactions":[${transactionJson({
          gasPrice: lux,
          gasSpent: "1",
          payload: payloadJson({ value: lux }),
        })}]}`,
      );

      const [transaction] = await duskAPI.getTransactions(1);
      const table = render(TransactionsTable, {
        props: { data: [transaction], mode: "full" },
      });

      expect(titlesIn(table.container)).toStrictEqual([
        `${dusk} DUSK`,
        `${dusk} DUSK`,
      ]);
      table.unmount();

      const list = render(TransactionsList, { props: { data: transaction } });

      expect(titlesIn(list.container)).toStrictEqual([`${dusk} DUSK`]);
    },
  );

  it.each(CASES)(
    "should keep a block's reward and fees of %s LUX exact, in its lists and on its page",
    async (lux, dusk) => {
      answer(`{"blocks":[${blockJson({ fees: lux, reward: lux })}]}`);

      const [block] = await duskAPI.getBlocks(1);
      const table = render(BlocksTable, { props: { data: [block] } });

      expect(
        titlesIn(table.container).filter((title) => title?.endsWith("DUSK")),
      ).toStrictEqual([`${dusk} DUSK`, `${dusk} DUSK`]);
      table.unmount();

      const list = render(BlocksList, { props: { data: block } });

      expect(titlesIn(list.container)).toStrictEqual([`${dusk} DUSK`]);
      list.unmount();

      answer(
        `{"block":{"header":{"json":${JSON.stringify(
          `{"height":487166,"prev_block_cert":{"validation":{"bitset":${lux}}}}`,
        )}}}}`,
      );

      const { container } = render(BlockDetails, {
        props: {
          data: block,
          error: null,
          loading: false,
          payload: await duskAPI.getBlockDetails(hash),
        },
      });

      expect(valueOf(container, /reward$/i)).toBe(`${dusk} DUSK`);
      expect(valueOf(container, /^fees$/i)).toBe(`${dusk} DUSK`);

      await fireEvent.click(
        /** @type {HTMLElement} */ (
          container.querySelector(".block-details__payload-switch")
        ),
      );

      expect(
        container
          .querySelector("pre")
          ?.textContent?.split("\n")
          .map((line) => line.trim()),
      ).toContain(`"bitset": ${lux}`);
    },
  );

  it("should keep whom a deposit to DuskEVM pays, past 2^53 LUX", async () => {
    // The amount its call names is compared with the DUSK it sent.
    const recipient = "0x5A3d8e1B7c2f4A6b9e0D1C3f5A7b9C2D4e6F8a01";
    const bridge =
      "2257e5f8ff49cf7c9704a14ca35acbf48eb7ade11a079d98d5cd5655eea1b31d";
    const args = Buffer.from(
      encodeDepositArgs({
        amountLux: BigInt(STAKE),
        minGasLimit: 200_000,
        to: recipient,
      }),
    ).toString("base64");

    answer(
      `{"tx":${transactionJson({
        callData: `{"contractId":"${bridge}","fnName":"depositETHToWithValue"}`,
        payload: payloadJson({
          call: `{"fn_args":"${args}","fn_name":"depositETHToWithValue"}`,
          deposit: STAKE,
        }),
      })}}`,
    );

    const transaction = /** @type {Transaction} */ (
      await duskAPI.getTransaction(hash)
    );

    expect(bridgeDepositRecipient(transaction, 2)).toBe(recipient);
  });
});
