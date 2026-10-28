<svelte:options immutable={true} />

<script>
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
  } from "$lib/components/table";
  import { AppAnchor } from "$lib/components";
  import { CopyButton } from "$lib/dusk/components";
  import { formatDusk, formatDuskExact } from "$lib/dusk/currency";
  import { makeClassName, middleEllipsis } from "$lib/dusk/string";
  import { createValueFormatter } from "$lib/dusk/value";

  import "./ProvisionersTable.css";

  /** @type {string | undefined} */
  export let className = undefined;

  /**
   * @typedef {HostProvisioner & {
   *   rank: number;
   *   ownerType: string;
   *   ownerAddress: string;
   *   hasSeparateOwner: boolean;
   * }} EnrichedProvisioner
   */

  /** @type {EnrichedProvisioner[]} */
  export let data;

  /** Lists show an address as its first and last six characters. */
  const HASH_CHARS_LENGTH = 6;

  const numberFormatter = createValueFormatter("en");

  /** @typedef {"asc" | "desc"} SortDirection */

  const SortColumn = {
    OWNER: "owner",
    REWARD: "reward",
    SLASHES: "slashes",
    STAKE: "stake",
    STAKING_ADDRESS: "stakingAddress",
  };

  /** @type {{ column: string, direction: SortDirection }} */
  let sort = {
    column: SortColumn.STAKE,
    direction: "desc", // highest stake first
  };

  /** @param {SortDirection} direction @returns {SortDirection} */
  const flipDirection = (direction) => (direction === "asc" ? "desc" : "asc");

  /**
   * @param {string} column
   */
  function toggleSort(column) {
    sort = {
      column,
      direction:
        sort.column === column ? flipDirection(sort.direction) : "desc",
    };
  }

  /** @param {EnrichedProvisioner} p @returns {number} */
  const slashes = (p) => (p.faults ?? 0) + (p.hard_faults ?? 0);

  /**
   * Map from column -> comparator
   * @type {Record<string, (a: EnrichedProvisioner, b: EnrichedProvisioner) => number>}
   */
  const columnComparators = {
    [SortColumn.STAKING_ADDRESS]: (a, b) => a.key.localeCompare(b.key),
    [SortColumn.OWNER]: (a, b) => a.ownerAddress.localeCompare(b.ownerAddress),
    [SortColumn.STAKE]: (a, b) => Number(a.amount) - Number(b.amount),
    [SortColumn.REWARD]: (a, b) => Number(a.reward) - Number(b.reward),
    [SortColumn.SLASHES]: (a, b) => slashes(a) - slashes(b),
  };

  const defaultComparator = () => 0;

  /**
   * @param {EnrichedProvisioner} a
   * @param {EnrichedProvisioner} b
   * @param {string} column
   * @param {SortDirection} direction
   * @returns {number}
   */
  function compare(a, b, column, direction) {
    const comparator = columnComparators[column] ?? defaultComparator;
    const result = comparator(a, b);

    return direction === "asc" ? result : -result;
  }

  $: classes = makeClassName(["provisioners-table", className]);

  $: sortArrow = sort.direction === "asc" ? "↑" : "↓";

  $: sortedData = data.toSorted((a, b) =>
    compare(a, b, sort.column, sort.direction)
  );
</script>

<Table className={classes}>
  <TableHead>
    <TableRow>
      <TableCell type="th">
        <button
          type="button"
          class="provisioners-table__header-button"
          on:click={() => toggleSort(SortColumn.STAKE)}
        >
          <span>#</span>
          {#if sort.column === SortColumn.STAKE}
            <span class="provisioners-table__header-sort-indicator">
              {sortArrow}
            </span>
          {/if}
        </button>
      </TableCell>

      <TableCell type="th">
        <button
          type="button"
          class="provisioners-table__header-button"
          on:click={() => toggleSort(SortColumn.STAKING_ADDRESS)}
        >
          <span>Staking address</span>
          {#if sort.column === SortColumn.STAKING_ADDRESS}
            <span class="provisioners-table__header-sort-indicator">
              {sortArrow}
            </span>
          {/if}
        </button>
      </TableCell>

      <TableCell type="th">
        <button
          type="button"
          class="provisioners-table__header-button"
          on:click={() => toggleSort(SortColumn.OWNER)}
        >
          <span>Owner</span>
          {#if sort.column === SortColumn.OWNER}
            <span class="provisioners-table__header-sort-indicator">
              {sortArrow}
            </span>
          {/if}
        </button>
      </TableCell>

      <TableCell type="th">
        <button
          type="button"
          class="provisioners-table__header-button"
          on:click={() => toggleSort(SortColumn.STAKE)}
        >
          <span>Stake</span>
          {#if sort.column === SortColumn.STAKE}
            <span class="provisioners-table__header-sort-indicator">
              {sortArrow}
            </span>
          {/if}
        </button>
      </TableCell>

      <TableCell type="th">
        <button
          type="button"
          class="provisioners-table__header-button"
          on:click={() => toggleSort(SortColumn.REWARD)}
        >
          <span>Rewards</span>
          {#if sort.column === SortColumn.REWARD}
            <span class="provisioners-table__header-sort-indicator">
              {sortArrow}
            </span>
          {/if}
        </button>
      </TableCell>

      <TableCell type="th">
        <button
          type="button"
          class="provisioners-table__header-button"
          on:click={() => toggleSort(SortColumn.SLASHES)}
        >
          <span>Slashes</span>
          {#if sort.column === SortColumn.SLASHES}
            <span class="provisioners-table__header-sort-indicator">
              {sortArrow}
            </span>
          {/if}
        </button>
      </TableCell>
    </TableRow>
  </TableHead>

  <TableBody>
    {#each sortedData as provisioner (provisioner.key)}
      {@const consensusAddress = provisioner.key}
      {@const slashCount =
        (provisioner.faults ?? 0) + (provisioner.hard_faults ?? 0)}

      <TableRow>
        <TableCell
          ><span class="provisioners-table__rank">{provisioner.rank}</span
          ></TableCell
        >

        <TableCell>
          <div class="provisioners-table__staking-address-wrapper">
            <AppAnchor
              className="provisioners-table__address"
              href="/accounts/?key={consensusAddress}"
              >{middleEllipsis(consensusAddress, HASH_CHARS_LENGTH)}</AppAnchor
            >
            <CopyButton name="Staking address" rawValue={consensusAddress} />
          </div>
        </TableCell>

        <TableCell>
          {#if provisioner.hasSeparateOwner}
            <span
              class="provisioners-table__address provisioners-table__owner"
              data-tooltip-id="provisioners-tooltip"
              data-tooltip-text="Owner: {provisioner.ownerAddress}"
              >{provisioner.ownerType === "Account"
                ? middleEllipsis(provisioner.ownerAddress, HASH_CHARS_LENGTH)
                : `Contract ${middleEllipsis(provisioner.ownerAddress, 4)}`}</span
            >
          {:else}
            <span class="provisioners-table__muted">—</span>
          {/if}
        </TableCell>

        <TableCell align="right">
          <span class="row-amount"
            ><span title="{formatDuskExact(provisioner.amount)} DUSK"
              >{formatDusk(provisioner.amount)}</span
            >
            <span class="row-unit">DUSK</span></span
          >
          <span class="row-line provisioners-table__stake-line">
            {#if provisioner.locked_amt}
              <span title="{formatDuskExact(provisioner.locked_amt)} DUSK"
                >{formatDusk(provisioner.locked_amt)} inactive</span
              >
            {/if}
            {#if provisioner.locked_amt && provisioner.eligibility}
              <span aria-hidden="true">·</span>
            {/if}
            {#if provisioner.eligibility}
              <span
                >eligible from block {numberFormatter(
                  provisioner.eligibility
                )}</span
              >
            {/if}
          </span>
        </TableCell>

        <TableCell align="right">
          <span class="row-amount"
            ><span title="{formatDuskExact(provisioner.reward)} DUSK"
              >{formatDusk(provisioner.reward)}</span
            >
            <span class="row-unit">DUSK</span></span
          >
        </TableCell>

        <TableCell align="right">
          <span class:provisioners-table__muted={!slashCount}
            >{numberFormatter(provisioner.faults)} soft, {numberFormatter(
              provisioner.hard_faults
            )} hard</span
          >
        </TableCell>
      </TableRow>
    {/each}
  </TableBody>
</Table>
