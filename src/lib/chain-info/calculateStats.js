import { filterWith, partition } from "lamb";

/**
 * We take into account only provisioners with
 * the minimum stake amount of 1000 Dusk (1e12 Lux).
 *
 * @type {(provisioners: HostProvisioner[]) => HostProvisioner[]}
 */
const getValidProvisioners = filterWith((p) => p.amount >= 1e12);

/**
 * Sums the provisioners' amounts, exactly: added as numbers, a total past
 * 2^53 LUX loses digits. Zero if there are none.
 *
 * @param {HostProvisioner[]} provisioners
 * @returns {bigint}
 */
const sumByAmount = (provisioners) =>
  provisioners.reduce((total, p) => total + BigInt(p.amount), 0n);

/**
 * @param {HostProvisioner[]} provisioners
 * @param {number} lastHeight
 * @returns {Stats}
 */
function calculateStats(provisioners, lastHeight) {
  const [activeProvisioners, waitingProvisioners] = partition(
    getValidProvisioners(provisioners),
    (p) => p.eligibility <= lastHeight,
  );

  return {
    activeProvisioners: activeProvisioners.length,
    activeStake: sumByAmount(activeProvisioners),
    lastBlock: lastHeight,
    waitingProvisioners: waitingProvisioners.length,
    waitingStake: sumByAmount(waitingProvisioners),
  };
}

export default calculateStats;
