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
 * `null` when the key has none. Amounts are in LUX.
 *
 * @param {StakeData | null} data
 * @returns {AccountStake | null}
 */
const transformStake = (data) =>
  data
    ? {
        active: Number(data.amount?.value ?? 0),
        eligibility: Number(data.amount?.eligibility ?? 0),
        faults: data.faults,
        hardFaults: data.hard_faults,
        inactive: Number(data.amount?.locked ?? 0),
        reward: Number(data.reward),
      }
    : null;

export default transformStake;
