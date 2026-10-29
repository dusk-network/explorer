import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { FullValue } from "..";

describe("FullValue", () => {
  const hash =
    "ac6b2f9b4148915244ca86ea08b398a96d4aaba111ad24a0e480fadb3416bc24";

  afterEach(cleanup);

  /** @param {HTMLElement} container */
  const endsOf = (container) =>
    Array.from(container.querySelectorAll(".full-value__end"), (end) =>
      end.textContent?.trim()
    );

  it("should give a value in full, its first and last six characters set apart", () => {
    const { container } = render(FullValue, { props: { value: hash } });

    expect(container.firstElementChild).toHaveTextContent(hash);
    expect(endsOf(container)).toStrictEqual(["ac6b2f", "16bc24"]);
    expect(container.querySelector(".full-value__middle")).toHaveTextContent(
      hash.slice(6, -6)
    );
  });

  it("should set apart an EVM address's or hash's ends as its short form keeps them: 0x and four, and the last four", () => {
    const address = "0xAB84EDFFd745aF9420Ac74feC73121fbEE9fC86F";
    const { container } = render(FullValue, {
      props: { evm: true, value: address },
    });

    expect(endsOf(container)).toStrictEqual(["0xAB84", "C86F"]);
    expect(container.firstElementChild).toHaveTextContent(address);
  });

  it("should keep a value too short to split whole", () => {
    const { container } = render(FullValue, {
      props: { value: "0x1234abcd" },
    });

    expect(container.firstElementChild).toHaveTextContent(/^0x1234abcd$/);
    expect(endsOf(container)).toStrictEqual(["", ""]);
  });
});
