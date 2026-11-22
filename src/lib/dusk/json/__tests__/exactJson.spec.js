import { describe, expect, it } from "vitest";

import { formatJson, parseJson } from "..";

describe("parseJson", () => {
  it.each([
    "9007199254740992",
    "9007199254740993",
    "13102790940789547",
    "14927768807078791",
    "18446744073709551615",
    "-9007199254740993",
  ])("should read %s as a bigint of every digit", (digits) => {
    const value = BigInt(digits);

    expect(parseJson(digits)).toBe(value);
    expect(parseJson(`{"v":${digits}}`)).toStrictEqual({ v: value });
    expect(parseJson(`{ "v" : [ 1,${digits} ,2 ] }`)).toStrictEqual({
      v: [1, value, 2],
    });
    expect(parseJson(`{\n\t"v":\r\n${digits}\n}`)).toStrictEqual({ v: value });
  });

  it.each([
    "0",
    "-1",
    "9007199254740991",
    "-9007199254740991",
    "52.352",
    "-74.0247",
    "0.12345678901234567890",
    "1e21",
    "1.8446744073709551615E19",
    "true",
    "null",
  ])("should read %s as JSON.parse does", (text) => {
    expect(parseJson(`[${text}]`)).toStrictEqual(JSON.parse(`[${text}]`));
  });

  it.each([
    ["digits", "18446744073709551615"],
    ["digits after a quote", 'say "18446744073709551615'],
    ["what looks like JSON", '{"value":18446744073709551615}'],
    ["a backslash at the end", "18446744073709551615\\"],
    ["a backslash before a quote", '\\"18446744073709551615'],
    ["a new line and a colon", "a\n:18446744073709551615"],
    ["an escaped control character", "\u000018446744073709551615"],
    ["nothing", ""],
  ])("should leave a string of %s as it is", (_, value) => {
    const text = `{"s":${JSON.stringify(value)},"after":9007199254740993}`;

    expect(parseJson(text)).toStrictEqual({
      after: 9007199254740993n,
      s: value,
    });
  });

  it("should leave a key of digits as it is", () => {
    expect(parseJson('{"18446744073709551615":1}')).toStrictEqual({
      "18446744073709551615": 1,
    });
  });

  it("should read JSON inside JSON, as a transaction's payload is", () => {
    const inner = '{"value":14927768807078791}';
    const { json, gas } = parseJson(
      `{"json":${JSON.stringify(inner)},"gas":18446744073709551615}`,
    );

    expect(gas).toBe(18446744073709551615n);
    expect(json).toBe(inner);
    expect(parseJson(json)).toStrictEqual({ value: 14927768807078791n });
  });

  it("should read a string of millions of escapes", () => {
    // A long string a transaction chose mustn't fail a whole list's read.
    const value = '\\"'.repeat(2_000_000);

    expect(parseJson(JSON.stringify({ value })).value).toBe(value);
  });

  it.each(["", "{", '{"a":}', '"open', "[1 2]", "<html>502</html>"])(
    "should refuse %j",
    (text) => {
      expect(() => parseJson(text)).toThrow(SyntaxError);
    },
  );
});

describe("formatJson", () => {
  it("should write what was read as the node wrote it, indented", () => {
    const text =
      '{"value":14927768807078791,"max":18446744073709551615,"low":-9007199254740993,"nonce":7,"text":"18446744073709551615","list":[],"none":null}';

    expect(formatJson(parseJson(text))).toBe(`{
  "value": 14927768807078791,
  "max": 18446744073709551615,
  "low": -9007199254740993,
  "nonce": 7,
  "text": "18446744073709551615",
  "list": [],
  "none": null
}`);
  });

  it("should write what has no bigint as JSON.stringify does", () => {
    const value = { a: [1, 2.5, "3"], b: { c: true, d: null }, e: "é\n" };

    expect(formatJson(value)).toBe(JSON.stringify(value, null, 2));
  });
});
