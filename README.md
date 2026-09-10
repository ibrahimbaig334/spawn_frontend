# Spawn frontend

A static-first, interactive concept for Spawn's milestone-based token launch experience.

## Product status

This repository contains demo data and local simulations only. It does not connect to a wallet, contract, quote source, indexer, analytics service, or live Base deployment. No control sends a transaction.

## Commands

```sh
corepack yarn dev
corepack yarn lint
corepack yarn typecheck
corepack yarn test
corepack yarn build
corepack yarn test:e2e
```

The repository pins Yarn 4 through Corepack so commands do not fall back to a globally installed Yarn Classic executable. `SPECS.md` is the product reference and remains unchanged by the frontend.
