type GQLBlock = {
  fees: NodeInteger;
  gasSpent: NodeInteger;
  header: {
    gasLimit: NodeInteger;
    generatorBlsPubkey?: string;
    hash: string;
    height: number;
    nextBlockHash?: string;
    prevBlockHash: string;
    seed: string;
    stateHash: string;
    timestamp: number;
  };
  reward: NodeInteger;
  transactions: GQLTransaction[];
};

type GQLCallData = {
  contractId: string;
  fnName: string;
};

type GQLChainInfo = {
  blocks: GQLBlock[];
  transactions: GQLTransaction[];
};

type GQLSearchResult = {
  block?: {
    header: {
      hash: string;
    };
  } | null;
  tx?: {
    id: string;
  } | null;
  account?: {
    id: string;
  } | null;
};

type GQLTransaction = {
  blockHash: string;
  blockHeight: number;
  blockTimestamp: number;
  err: string | null;
  gasSpent: NodeInteger;
  id: string;
  tx: {
    blobHashes: string[] | null;
    callData: GQLCallData | null;
    gasLimit: NodeInteger;
    gasPrice: NodeInteger;
    id: string;
    isDeploy: boolean;
    memo: string;
    txType: string;
    json?: string;
  };
};
