import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { get, readable } from "svelte/store";

import * as appStores from "$app/stores";

import ErrorPage from "../+error.svelte";

describe("Error page", () => {
  const storeWithoutError = {
    ...get(appStores.page),
    error: null,
    status: 200,
  };
  const baseOptions = { props: {}, target: document.body };

  afterEach(cleanup);

  it("should say a page wasn't found plainly, and lead home", () => {
    const pageStoreSpy = vi.spyOn(appStores, "page", "get").mockReturnValue(
      readable({
        ...storeWithoutError,
        error: new Error("Not Found"),
        status: 404,
      })
    );
    const { getByRole, queryByText } = render(ErrorPage, baseOptions);

    expect(getByRole("heading", { level: 1 })).toHaveTextContent(
      /^Page not found$/
    );
    expect(queryByText("Not Found")).toBeNull();
    expect(getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/some-base-path/"
    );
    pageStoreSpy.mockRestore();
  });
});
