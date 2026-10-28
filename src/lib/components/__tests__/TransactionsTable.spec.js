import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { mapWith, slice } from "lamb";

import { apiNodeInfo, gqlTransaction, gqlTransactions } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";
import { appStore } from "$lib/stores";

import { TransactionsTable } from "..";

describe("Transactions Table", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 30));

  const transformTransactions = mapWith(transformTransaction);
  const data = slice(
    transformTransactions(gqlTransactions.transactions),
    0,
    10
  );

  /** @type {import("svelte").ComponentProps<TransactionsTable>} */
  const baseProps = {
    data: data,
    mode: "full",
  };
  const baseOptions = {
    props: baseProps,
    target: document.body,
  };

  afterEach(cleanup);

  afterAll(() => {
    vi.useRealTimers();
  });

  it('should render the `TransactionsTable` component in "full" mode', () => {
    const { container } = render(TransactionsTable, baseOptions);

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it('should render the `TransactionsTable` component in "compact" mode', () => {
    /** @type {import("svelte").ComponentProps<TransactionsTable>} */
    const props = { ...baseProps, mode: "compact" };
    const { container } = render(TransactionsTable, { ...baseOptions, props });

    expect(container.firstElementChild).toMatchSnapshot();
  });

  describe("Columns", () => {
    const transfer = transformTransaction(gqlTransaction.tx);
    const call = {
      ...transfer,
      amount: 0,
      contract:
        "0200000000000000000000000000000000000000000000000000000000000000",
      deposit: 0,
      method: "withdraw",
      to: null,
      txerror: "Panic",
      txid: "f".repeat(64),
    };

    /** @param {HTMLElement} container */
    const getHeaders = (container) =>
      Array.from(container.querySelectorAll("th"), (th) =>
        th.textContent?.trim()
      );

    /** @param {HTMLElement} row */
    const getCells = (row) =>
      Array.from(row.querySelectorAll("td"), (td) =>
        td.textContent?.replace(/\s+/g, " ").trim()
      );

    it("should show who sent how much to whom, and leave gas to the transaction page", async () => {
      const { container, getAllByText, getByRole, getByText } = render(
        TransactionsTable,
        {
          props: { data: [transfer, call], mode: "full" },
        }
      );
      const rows = container.querySelectorAll("tbody tr");

      expect(getHeaders(container)).toStrictEqual([
        "ID",
        "From / To",
        "Amount (DUSK)",
        "Fee (DUSK)",
        "Status",
        "Type",
      ]);
      expect(
        getCells(/** @type {HTMLElement} */ (rows[0])).slice(1, 3)
      ).toStrictEqual([
        `From ${transfer.from?.slice(0, 6)}...${transfer.from?.slice(-6)} To ${transfer.to?.slice(0, 6)}...${transfer.to?.slice(-6)}`,
        "9,812.3789",
      ]);
      // Four decimals at most, as in the wallets, and every one on hover.
      expect(getByText("9,812.3789")).toHaveAttribute(
        "title",
        "9,812.378912731 DUSK"
      );
      expect(getAllByText("0.0003")[0]).toHaveAttribute(
        "title",
        "0.000290766 DUSK"
      );
      expect(
        getByRole("link", {
          name: `${transfer.to?.slice(0, 6)}...${transfer.to?.slice(-6)}`,
        })
      ).toHaveAttribute("href", `/some-base-path/accounts/?key=${transfer.to}`);
      await vi.waitFor(() =>
        expect(
          getCells(/** @type {HTMLElement} */ (rows[1])).slice(1, 3)
        ).toStrictEqual([
          `From ${transfer.from?.slice(0, 6)}...${transfer.from?.slice(-6)} To Stake contract`,
          "0",
        ])
      );
      expect(container.textContent).not.toMatch(/PRICE|LIMIT/);
    });

    it("should give each time in full on hover, in the viewer's zone, and IDs as six and six characters", () => {
      const { container } = render(TransactionsTable, {
        props: { data: [transfer], mode: "full" },
      });

      // The tests run in UTC.
      expect(container.querySelector("time")).toHaveAttribute(
        "data-tooltip-text",
        "Tue 16 Apr 2024, 06:39:09 UTC"
      );
      expect(container.querySelector(".transaction__link")).toHaveTextContent(
        `${transfer.txid.slice(0, 6)}...${transfer.txid.slice(-6)}`
      );
    });

    it("should show the DuskEVM address a deposit to DuskEVM pays, read from its call data", async () => {
      const bridge =
        "2257e5f8ff49cf7c9704a14ca35acbf48eb7ade11a079d98d5cd5655eea1b31d";
      const deposit = {
        ...transfer,
        amount: 0,
        contract: bridge,
        deposit: 500_000_000,
        method: "depositETHToWithValue",
        payload: /** @type {any} */ ({
          call: {
            // eslint-disable-next-line camelcase
            fn_args: "AGXNHQAAAABaPY4bfC9Ka54NHD9ae5wtTm+KAUANAwDg////AAAAAA==",
          },
        }),
        to: null,
      };

      appStore.setNodeInfo(apiNodeInfo);

      const { container } = render(TransactionsTable, {
        props: { data: [deposit], mode: "full" },
      });

      await vi.waitFor(() =>
        expect(
          container.querySelector(".transaction-party--evm")
        ).toHaveTextContent(/^0x5A3d\.\.\.8a01 on DuskEVM$/)
      );
      // The address and "on DuskEVM" each wrap whole.
      expect(
        Array.from(
          container.querySelectorAll(".transaction-party--evm > span"),
          (part) => part.textContent
        )
      ).toStrictEqual(["0x5A3d...8a01", "on DuskEVM"]);

      // eslint-disable-next-line camelcase
      appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined });
    });

    it("should fit the home page: no fee or status column, failures beside the time", () => {
      const { container } = render(TransactionsTable, {
        props: { data: [transfer, call], mode: "compact" },
      });
      const rows = container.querySelectorAll("tbody tr");

      expect(getHeaders(container)).toStrictEqual([
        "ID",
        "From / To",
        "Amount (DUSK)",
        "Type",
      ]);
      expect(getCells(/** @type {HTMLElement} */ (rows[0]))[0]).not.toContain(
        "Failed"
      );
      expect(getCells(/** @type {HTMLElement} */ (rows[1]))[0]).toMatch(
        / · Failed$/
      );
    });
  });

  it("should pass additional class names to the rendered element", () => {
    const props = { ...baseProps, className: "foo bar" };
    const { container } = render(TransactionsTable, { ...baseOptions, props });

    expect(container.firstElementChild).toMatchSnapshot();
  });
});
