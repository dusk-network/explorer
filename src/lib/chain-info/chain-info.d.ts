type AccountStake = {
  /** The stake taking part in consensus, in LUX. */
  active: number;
  /** The block from which the stake takes part. */
  eligibility: number;
  faults: number;
  hardFaults: number;
  /** The stake that is locked, in LUX. */
  inactive: number;
  /** The rewards not yet claimed, in LUX. */
  reward: number;
};

type BlockHeader = {
  date: Date;
  feespaid: number;
  hash: string;
  height: number;
  nextblockhash: string;
  prevblockhash: string;
  reward: number;
  seed: string;
  statehash: string;
};

type BlockTransactions = {
  data: Transaction[];
  stats: {
    averageGasPrice: number;
    gasLimit: number;
    gasUsed: number;
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
  amount: number | undefined;
  blobHashes: string[];
  /** The contract a call went to. */
  contract?: string;
  /** The DUSK, in LUX, a call sent to its contract. */
  deposit?: number;
  from: string | undefined;
  to: string | null | undefined;
  blockhash: string;
  blockheight: number;
  date: Date;
  feepaid: number;
  gaslimit: number;
  gasprice: number;
  gasspent: number;
  memo: string;
  method: string;
  success: boolean;
  txerror: string;
  txid: string;
  txtype: string;
  payload: string;
  nonce: number | undefined;
};
