// A Dusk account's key in the raw form contracts that keep accounts in their
// arguments take it, as `PublicKey::to_raw_bytes` gives it: the point's
// coordinates uncompressed, each in Montgomery form as six little-endian
// u64 limbs (x.c0, x.c1, y.c0, y.c1), then the infinity flag. An address is
// the point compressed (96 bytes, big-endian, flags in its first byte), so
// its y is the square root the curve's equation gives for x, the one its
// sort flag picks. It reads nothing from the node and checks only what the
// encoding needs: a key that isn't a curve point gives `null`.

/** BLS12-381's base field modulus. */
const P = BigInt(
  "0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab"
);

/** The Montgomery radix, 2^384 mod P. */
const R = (1n << 384n) % P;

const HALF = (P - 1n) / 2n;

/** @typedef {[bigint, bigint]} Fp2 An element c0 + c1·u, where u² = −1. */

/** @param {bigint} a */
const mod = (a) => ((a % P) + P) % P;

/** @type {(a: Fp2, b: Fp2) => Fp2} */
const add = ([a0, a1], [b0, b1]) => [mod(a0 + b0), mod(a1 + b1)];

/** @type {(a: Fp2, b: Fp2) => Fp2} */
const mul = ([a0, a1], [b0, b1]) => [
  mod(a0 * b0 - a1 * b1),
  mod(a0 * b1 + a1 * b0),
];

/** @type {(a: Fp2, b: Fp2) => boolean} */
const equal = ([a0, a1], [b0, b1]) => a0 === b0 && a1 === b1;

/**
 * @param {Fp2} base
 * @param {bigint} exponent
 * @returns {Fp2}
 */
function pow(base, exponent) {
  /** @type {Fp2} */
  let result = [1n, 0n];

  for (let bit = exponent, square = base; bit > 0n; bit >>= 1n) {
    if (bit & 1n) {
      result = mul(result, square);
    }

    square = mul(square, square);
  }

  return result;
}

/**
 * A square root in Fp2, or `null` when there is none: Algorithm 9 of
 * https://eprint.iacr.org/2012/685.pdf, as bls12_381's `Fp2::sqrt`.
 *
 * @param {Fp2} a
 * @returns {Fp2 | null}
 */
function sqrt(a) {
  const a1 = pow(a, (P - 3n) / 4n);
  const alpha = mul(mul(a1, a1), a);
  const x0 = mul(a1, a);
  const root = equal(alpha, [P - 1n, 0n])
    ? mul(x0, [0n, 1n])
    : mul(pow(add(alpha, [1n, 0n]), HALF), x0);

  return equal(mul(root, root), a) ? root : null;
}

/** @param {Uint8Array} bytes Big-endian */
const toBigInt = (bytes) =>
  bytes.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n);

/**
 * @param {Uint8Array} out
 * @param {number} at
 * @param {bigint} value A field element, written in Montgomery form
 */
function writeMontgomery(out, at, value) {
  let limbs = mod(value * R);

  for (let i = 0; i < 48; i++) {
    out[at + i] = Number(limbs & 0xffn);
    limbs >>= 8n;
  }
}

/**
 * The point a compressed key stands for, or `null` when it stands for
 * none other than the identity: its x, and the y its sort flag picks.
 *
 * @param {Uint8Array} compressed
 * @returns {[Fp2, Fp2] | null}
 */
function decompress(compressed) {
  const flags = compressed[0];

  // Compressed, and not the identity.
  if (compressed.length !== 96 || !(flags & 0x80) || flags & 0x40) {
    return null;
  }

  const high = Uint8Array.from(compressed.subarray(0, 48));

  high[0] &= 0x1f;

  /** @type {Fp2} */
  const x = [toBigInt(compressed.subarray(48)), toBigInt(high)];

  // y² = x³ + 4(u + 1)
  const y =
    x[0] < P && x[1] < P ? sqrt(add(mul(mul(x, x), x), [4n, 4n])) : null;

  if (!y) {
    return null;
  }

  const largest = y[1] > HALF || (y[1] === 0n && y[0] > HALF);

  return [x, largest === !!(flags & 0x20) ? y : [mod(-y[0]), mod(-y[1])]];
}

/**
 * The raw form of a compressed key, or `null` when it doesn't decode to a
 * point other than the identity.
 *
 * @param {Uint8Array} compressed The 96 bytes of an address
 * @returns {Uint8Array | null} 193 bytes
 */
export function rawAccountKey(compressed) {
  const point = decompress(compressed);

  if (!point) {
    return null;
  }

  const [[x0, x1], [y0, y1]] = point;
  const raw = new Uint8Array(193);

  [x0, x1, y0, y1].forEach((value, i) => writeMontgomery(raw, i * 48, value));

  return raw;
}
