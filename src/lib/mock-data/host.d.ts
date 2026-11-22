type HostProvisioner = {
  amount: NodeInteger;
  eligibility: number;
  faults: number;
  hard_faults: number;
  key: string;
  locked_amt: NodeInteger;
  owner: { Account: string } | { Contract: string };
  reward: NodeInteger;
};

/** A provisioner as the provisioners' lists show it: its rank and its owner. */
type EnrichedProvisioner = HostProvisioner & {
  rank: number;
  ownerType: string;
  ownerAddress: string;
  hasSeparateOwner: boolean;
};
