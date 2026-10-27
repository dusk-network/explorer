<svelte:options immutable={true} />

<script>
  import { mdiCubeOutline } from "@mdi/js";

  import { Icon, RelativeTime } from "$lib/dusk/components";
  import { AppAnchor } from "$lib/components";
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
  } from "$lib/components/table";
  import { formatDusk, formatDuskExact } from "$lib/dusk/currency";
  import { formatDateTime } from "$lib/dusk/date";
  import { makeClassName } from "$lib/dusk/string";
  import { createValueFormatter } from "$lib/dusk/value";

  import "./BlocksTable.css";

  /** @type {string | undefined} */
  export let className = undefined;

  /** @type {Block[]} */
  export let data;

  /**
   * Whether to give each block's gas. The home page's short list leaves it
   * to the blocks page.
   */
  export let showGas = true;

  const numberFormatter = createValueFormatter("en");

  $: classes = makeClassName(["blocks-table", className]);
</script>

<Table className={classes}>
  <TableHead>
    <TableRow>
      <TableCell type="th">Block</TableCell>
      <TableCell align="right" type="th">Transactions</TableCell>
      {#if showGas}
        <TableCell align="right" type="th">Gas used</TableCell>
      {/if}
      <TableCell align="right" type="th">Reward</TableCell>
    </TableRow>
  </TableHead>
  <TableBody>
    {#each data as block (block)}
      <TableRow>
        <TableCell>
          <div class="block__main">
            <span aria-hidden="true" class="row-icon"
              ><Icon path={mdiCubeOutline} /></span
            >
            <div class="block__who">
              <AppAnchor
                className="block__link chain-link"
                href={`/blocks/block?id=${block.header.hash}`}
                >{numberFormatter(block.header.height)}</AppAnchor
              >
              <span class="row-line">
                <RelativeTime
                  className="block__time"
                  data-tooltip-id="main-tooltip"
                  data-tooltip-text={formatDateTime(block.header.date)}
                  date={block.header.date}
                />
              </span>
            </div>
          </div>
        </TableCell>
        <TableCell align="right"
          >{numberFormatter(block.transactions.data.length)}</TableCell
        >
        {#if showGas}
          <TableCell align="right">
            <span class="block__gas"
              >{numberFormatter(block.transactions.stats.gasUsed)}</span
            >
            {#if block.transactions.stats.averageGasPrice}
              <span class="row-line block__gas-price"
                >avg {numberFormatter(block.transactions.stats.averageGasPrice)}
                LUX</span
              >
            {/if}
          </TableCell>
        {/if}
        <TableCell align="right"
          ><span class="row-amount"
            ><span title="{formatDuskExact(block.header.reward)} DUSK"
              >{formatDusk(block.header.reward)}</span
            >
            <span class="row-unit">DUSK</span></span
          ></TableCell
        >
      </TableRow>
    {/each}
  </TableBody>
</Table>
