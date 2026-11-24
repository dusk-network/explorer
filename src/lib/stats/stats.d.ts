type Stats = {
  activeProvisioners?: number;
  activeStake?: NodeInteger;
  lastBlock: number;
  /** When the last block was made, by its own time. */
  lastBlockDate?: Date;
  waitingProvisioners?: number;
  waitingStake?: NodeInteger;
  txCount?: {
    public: number;
    shielded: number;
    total: number;
  };
};
