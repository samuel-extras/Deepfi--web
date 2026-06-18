// Shared mock-auth state used by the privy/wagmi shims.
//
// During the DEXV2 -> DeepFi (Sui) migration we replaced Privy + Wagmi (EVM)
// with a stubbed "always-connected" wallet so the full DEXV2 UI renders
// end-to-end without real keys. Real Enoki zkLogin replaces this in a later
// phase (see _archive_rebuild/lib/enoki.ts and SETUP-ZKLOGIN.md).

// The real testnet dev/owner address (Sui keystore: `flamboyant-phenacite`).
// Used as the connected identity until real Enoki zkLogin lands (Phase 1).
export const MOCK_ADDRESS =
  "0xd3e835d573c126bb7f5266f3d5390cdf0eba7bf05984316cfb0675f4be362b91" as `0x${string}`;

export const MOCK_CHAIN_ID = 42161; // arbitrum, matches DEXV2 default chain

// Minimal EIP-1193 provider stub.
export const mockEip1193Provider = {
  request: async () => null,
  on: () => {},
  removeListener: () => {},
  removeAllListeners: () => {},
};
