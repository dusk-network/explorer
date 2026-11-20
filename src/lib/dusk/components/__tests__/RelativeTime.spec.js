import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import RelativeTimeCustomContent from "./test-components/RelativeTimeCustomContent.svelte";

import { RelativeTime } from "..";

describe("RelativeTime", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 20, 15, 25, 30));

  const baseProps = {
    date: new Date(2024, 4, 20, 15, 25, 10),
  };

  const baseOptions = {
    props: baseProps,
    target: document.body,
  };

  afterEach(cleanup);

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should render the relative time of the given date and should not updated it by default", async () => {
    const { container } = render(RelativeTime, baseOptions);
    const textContent = container.firstElementChild?.textContent;

    expect(textContent).toMatchInlineSnapshot(`"20 s ago"`);

    await vi.advanceTimersByTimeAsync(10000);

    expect(container.firstElementChild?.textContent).toBe(textContent);
  });

  it("should update the relative time every second if the `autoRefresh` property is set to `true`", async () => {
    const props = { ...baseProps, autoRefresh: true };
    const { container } = render(RelativeTime, { ...baseOptions, props });

    expect(container.firstElementChild?.textContent).toMatchInlineSnapshot(
      `"30 s ago"`,
    );

    await vi.advanceTimersByTimeAsync(1000);

    expect(container.firstElementChild?.textContent).toMatchInlineSnapshot(
      `"31 s ago"`,
    );

    await vi.advanceTimersByTimeAsync(1000);

    expect(container.firstElementChild?.textContent).toMatchInlineSnapshot(
      `"32 s ago"`,
    );
  });

  it("should allow to put custom content in the default slot", async () => {
    const { container } = render(RelativeTimeCustomContent, {
      ...baseOptions,
      props: { date: baseProps.date },
    });

    expect(container.firstElementChild?.textContent).toMatchInlineSnapshot(
      `"The relative time now is 32 s ago"`,
    );

    await vi.advanceTimersByTimeAsync(1000);

    expect(container.firstElementChild?.textContent).toMatchInlineSnapshot(
      `"The relative time now is 33 s ago"`,
    );

    await vi.advanceTimersByTimeAsync(1000);

    expect(container.firstElementChild?.textContent).toMatchInlineSnapshot(
      `"The relative time now is 34 s ago"`,
    );
  });
});
