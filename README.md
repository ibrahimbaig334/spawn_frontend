# Spawn frontend

Production frontend for the Spawn milestone launchpad: launches, Uniswap v4 trading,
live market data and creator revenue — backed by the Spawn API (`spawn_backend`) and
the protocol contracts on Base.

## Stack

- Next.js 16 (App Router) + React 19 + Tailwind 4, strict TypeScript.
- Data: typed client for every route in `FRONTEND_INTEGRATION_GUIDE.md` (`src/lib/api/`),
  TanStack Query for polling/caching (`src/lib/queries.ts`).
- Live stream: WebSocket client for the broadcaster's `tick` / `bar` / `bar_close` /
  `pool` messages with reconnect + REST reconciliation (`src/lib/use-pool-stream.ts`).
- Chain: viem — EIP-1193 injected wallets, Uniswap v4 Universal Router swap calldata
  (`V4_SWAP` command; native ETH ↔ token, exact-input), MilestoneHook actions
  (graduate, flushTo, claimCreator, claimCreatorPath, collectFees), ERC-20 approvals,
  Multicall3 `aggregate3` batching for creator claim-all.
- Contract addresses are consumed only from `GET /protocol/addresses` — never hardcoded
  (pre-deployment the UI degrades gracefully with `MANIFEST_NOT_SYNCED` / `PROTOCOL_NOT_DEPLOYED`).

## Configuration

Copy `.env.example` to `.env.local`. All values are browser-exposed:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3000/api/v1` | Spawn API |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:3001/ws` | Broadcaster stream |
| `NEXT_PUBLIC_CHAIN_ID` | `8453` | Base mainnet (84532 = Sepolia) |
| `NEXT_PUBLIC_RPC_URL` | `https://mainnet.base.org` | Direct chain reads/writes |
| `NEXT_PUBLIC_UNIVERSAL_ROUTER_ADDRESS` | canonical v4 UR | Swap execution target |
| `NEXT_PUBLIC_EXPLORER_BASE_URL` | `https://basescan.org` | Explorer links |
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` / `_SECRET_KEY` | — | IPFS logo uploads |

## Commands

```sh
corepack yarn dev        # http://localhost:3000
corepack yarn lint
corepack yarn typecheck
corepack yarn test       # vitest
corepack yarn build
corepack yarn verify     # lint + typecheck + test + build
```

## Feature map

| Area | Route(s) | Backend/chain |
| --- | --- | --- |
| Market directory (search, phase, sort, pagination, grid/rows) | `/tokens` | `GET /tokens` |
| Trending / newest on landing | `/` | `GET /tokens/featured` |
| Pool terminal: price/FDV/mcap/ATH, curve progress, candles (1m–1d) with live splice, trade tape (WS + REST), depth (curve positions or bands+full-range+wall), milestone ladder (PENDING/DEPLOYED/SKIPPED/HARVESTED), revenue event feeds, pot & live claims (chain views), graduation action, comments (replies/likes/deletes) | `/tokens/[ref]` (poolId / token / UUID) | §2–§8, §11–§12 + hook writes |
| Launch wizard: identity + IPFS logo, payout plan (registry, ≤8 bits, ≤100% takes), dev buy (direct launches), prepare → predicted token + digest (cross-checked vs `LaunchSupport.launchDigest`), relay (operator-signed) or direct `launch(config,"0x")` with budget, record polling → auto-redirect | `/create` | §3 |
| Wallet: connect any EIP-1193 provider, live ETH balance, network switch/add, per-token balances | global | RPC |
| Portfolio: holdings across watched/created pools, RevenueNFT streams, claim-all (aggregate3), launch records, own trades, watchlist (localStorage) | `/portfolio*` | §12.3–12.4 + RPC |
| Creator profile by wallet (username/bio/avatar edit, created launches, held streams) | `/profiles/[wallet]` | §12.1–12.4 |
| Protocol status: manifest addresses, economics tuple + caps, plugin registry, governance + ops, protocol revenue + global history, indexer watermark, keeper jobs, 60-day stats | `/protocol` | §9–§10 |

## Ground rules encoded in the UI

- `level = -tick`; display math in level space, price orientation per guide §1.3.
- “Graduation on next trade” notice at `level ≥ farLevel − 1` with a deliberate graduate path.
- Quotes come from `V4Quoter` via the API (real `beforeSwap` simulation); re-quote on
  submission errors instead of padding slippage; quote gas estimates are not used for sends.
- Zero-amount claims/empty flushes are treated as no-op successes; bypassed bands render
  as “Bypassed”, transient settlement-lock reverts as retryable.
- Creators never sign under the relay model; direct launches carry the dev-buy budget and
  auto-refund unused ETH. No LP UI is offered (the hook rejects third-party liquidity).

`spawn-integration-handoff/` holds the contract docs/ABIs; `SPECS.md` and the
`FRONTEND_INTEGRATION_GUIDE.md` remain the normative API reference.
