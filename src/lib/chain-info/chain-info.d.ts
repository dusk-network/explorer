/**
 * An integer the node wrote, as the explorer reads it: a number while a
 * number holds it exactly, a bigint past 2^53.
 */
type NodeInteger = number | bigint;

type AccountStake = {
  /** The stake taking part in consensus, in LUX. */
  active: bigint;
  /** The block from which the stake takes part. */
  eligibility: number;
  faults: number;
  hardFaults: number;
  /** The stake that is locked, in LUX. */
  inactive: bigint;
  /** The rewards not yet claimed, in LUX. */
  reward: bigint;
};

type BlockHeader = {
  date: Date;
  feespaid: NodeInteger;
  /** The key of the provisioner that made the block: its account. */
  generator: string;
  hash: string;
  height: number;
  nextblockhash: string;
  prevblockhash: string;
  reward: NodeInteger;
  seed: string;
  statehash: string;
};

type BlockTransactions = {
  data: Transaction[];
  stats: {
    averageGasPrice: number;
    gasLimit: NodeInteger;
    gasUsed: NodeInteger;
  };
};

type Block = {
  header: BlockHeader;
  transactions: BlockTransactions;
};

type ChainInfo = {
  blocks: Block[];
  transactions: Transaction[];
};

type SearchResult = {
  id: string;
  type: "account" | "block" | "transaction";
};

type Transaction = {
  amount: NodeInteger | undefined;
  blobHashes: string[];
  /** The contract a call went to. */
  contract?: string;
  /** The DUSK, in LUX, a call sent to its contract. */
  deposit?: NodeInteger;
  from: string | undefined;
  to: string | null | undefined;
  blockhash: string;
  blockheight: number;
  date: Date;
  feepaid: bigint;
  gaslimit: NodeInteger;
  gasprice: NodeInteger;
  gasspent: NodeInteger;
  memo: string;
  method: string;
  success: boolean;
  txerror: string;
  txid: string;
  txtype: string;
  payload: string;
  nonce: NodeInteger | undefined;
};
