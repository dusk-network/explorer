/**
 * @typedef {{
 *   amount: { eligibility: string, locked: string, value: string } | null,
 *   faults: number,
 *   hard_faults: number,
 *   reward: string,
 * }} StakeData
 */

/**
 * A key's stake as the stake contract's `get_stake` gives it in JSON, or
 * `null` when the key has none. Amounts are in LUX, as exact integers: a
 * stake can pass what a JavaScript number holds exactly.
 *
 * @param {StakeData | null} data
 * @returns {AccountStake | null}
 */
const transformStake = (data) =>
  data
    ? {
        active: BigInt(data.amount?.value ?? 0),
        eligibility: Number(data.amount?.eligibility ?? 0),
        faults: data.faults,
        hardFaults: data.hard_faults,
        inactive: BigInt(data.amount?.locked ?? 0),
        reward: BigInt(data.reward),
      }
    : null;

export default transformStake;
