type Stats = {
  activeProvisioners?: number;
  activeStake?: number;
  lastBlock: number;
  /** When the last block was made, by its own time. */
  lastBlockDate?: Date;
  waitingProvisioners?: number;
  waitingStake?: number;
  txCount?: {
    public: number;
    shielded: number;
    total: number;
  };
};
