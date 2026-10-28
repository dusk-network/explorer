type HostProvisioner = {
  amount: number;
  eligibility: number;
  faults: number;
  hard_faults: number;
  key: string;
  locked_amt: number;
  owner: { Account: string } | { Contract: string };
  reward: number;
};

/** A provisioner as the provisioners' lists show it: its rank and its owner. */
type EnrichedProvisioner = HostProvisioner & {
  rank: number;
  ownerType: string;
  ownerAddress: string;
  hasSeparateOwner: boolean;
};
