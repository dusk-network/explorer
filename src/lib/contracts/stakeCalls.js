import { STAKE_CONTRACT } from "$lib/network";

/**
 * @typedef {{
 *   done: string,
 *   label: string,
 *   staked: boolean,
 *   tried: string,
 * }} StakeCall
 */

/** @type {StakeCall} */
const stake = {
  done: "staked",
  label: "Stake",
  staked: true,
  tried: "tried to stake",
};

/** @type {StakeCall} */
const unstake = {
  done: "unstaked",
  label: "Unstake",
  staked: false,
  tried: "tried to unstake",
};

/** @type {StakeCall} */
const claim = {
  done: "claimed rewards",
  label: "Claim rewards",
  staked: false,
  tried: "tried to claim rewards",
};

/**
 * The stake contract's calls in plain words, as the Dusk wallets name
 * them: the type that pages and lists give, and what a transaction's
 * sentence says it did, or only tried to do when it failed. A stake says
 * how much it staked; an unstake and a reward claim send no DUSK. A
 * contract staking for itself reads the same.
 *
 * @type {Map<string, StakeCall>}
 */
const stakeCalls = new Map([
  ["stake", stake],
  ["stake_from_contract", stake],
  ["unstake", unstake],
  ["unstake_from_contract", unstake],
  ["withdraw", claim],
  ["withdraw_from_contract", claim],
]);

/** The stake contract's calls' types, by function. */
export const stakeCallLabels = new Map(
  Array.from(stakeCalls, ([method, { label }]) => [method, label])
);

/**
 * A call's plain words when it went to the stake contract, or `null`.
 *
 * @param {string | null | undefined} contract
 * @param {string} method
 * @returns {StakeCall | null}
 */
export const stakeCallOf = (contract, method) =>
  contract === STAKE_CONTRACT ? (stakeCalls.get(method) ?? null) : null;
