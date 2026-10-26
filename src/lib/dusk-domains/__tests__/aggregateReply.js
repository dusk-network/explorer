/**
 * An `aggregate` reply as Multicall for Dusk writes it (rkyv 0.7): each Ok
 * result's bytes, then one 16-byte slot per result, then the root. For tests.
 *
 * @param {Array<{ Ok: Uint8Array } | { Err: "OutOfGas" }>} results
 * @param {bigint} [height]
 */
export function aggregateReply(results, height = 7n) {
  /** @type {(n: number, to: number) => number} */
  const align = (n, to) => Math.ceil(n / to) * to;
  const data = results.reduce((n, r) => n + ("Ok" in r ? r.Ok.length : 0), 0);
  const slots = align(data, 4);
  const root = align(slots + 16 * results.length, 8);
  const out = new Uint8Array(root + 16);
  const view = new DataView(out.buffer);
  let at = 0;

  results.forEach((r, i) => {
    const slot = slots + 16 * i;

    if ("Ok" in r) {
      out.set(r.Ok, at);
      view.setInt32(slot + 4, at - (slot + 4), true);
      view.setUint32(slot + 8, r.Ok.length, true);
      at += r.Ok.length;
    } else {
      out[slot] = 1;
      out[slot + 4] = 1; // OutOfGas
    }
  });
  view.setBigUint64(root, height, true);
  view.setInt32(root + 8, slots - (root + 8), true);
  view.setUint32(root + 12, results.length, true);

  return out;
}

/**
 * How many calls an `aggregate` envelope carries: its root's length field.
 *
 * @param {BodyInit | null | undefined} body
 */
export function countCalls(body) {
  const u8 = new Uint8Array(/** @type {Uint8Array} */ (body));

  return new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(
    u8.length - 4,
    true
  );
}
