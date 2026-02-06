# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

### Changed

### Removed

### Fixed

## [1.5.0] - 2026-02-04

### Added

- Add Tokens page dusk-network/rusk#3415
- Add support for transactions' blob hashes dusk-network/rusk#3804
- Provisioner table now supports sorting across all columns dusk-network/rusk#3924
- Add rank column for provisioners based on active stake dusk-network/rusk#3924
- Display of owner/consensus key separation for each staker dusk-network/rusk#3925

### Changed

- Replace "TX last 100 blocks" with total historical transaction count from `/on/stats/tx_count` dusk-network/rusk#3626
- Use supply.dusk.network for circulating supply dusk-network/rusk#3757
- The `from` and `to` fields are now always shown in moonlight transactions regardless of the transaction's type dusk-network/rusk#3804
- Explorer now reads circulating supply from `https://supply.dusk.network/` directly. CORS and cache headers applied via Cloudflare dusk-network/rusk#3847
- No longer rely on Vite dev proxy for `/supply` during development dusk-network/rusk#3847
- Hide provisioners with no active or locked stake from the provisioners list dusk-network/rusk#3930
- Change ranking column to take the full provisioner list into account dusk-network/rusk#3931
- Update dependencies to address potential security issues dusk-network/rusk#3985

### Removed

- Deleted API URL plumbing (`makeApiUrl`, `ensureTrailingSlash`) and the `apiGet` helper. Removed `VITE_API_ENDPOINT` environment variable. dusk-network/rusk#3847

## [1.4.0] - 2025-05-22

### Added

- Add account address copy button (Account page) dusk-network/rusk#3698
- Add value property to Transaction Details dusk-network/rusk#3699

### Changed

- Change transaction details arrangement (Transaction Details page) dusk-network/rusk#3720
- Change transaction list to use a single GraphQL query (Account page) dusk-network/rusk#3739

## [1.3.3] - 2025-05-05

### Fixed

- Fix transaction type badges get wrapped dusk-network/rusk#3692
- Fix Transaction and Block entries have different row heights (Home page) dusk-network/rusk#3694

## [1.3.2] - 2025-04-29

### Fixed

- Fix truncated provisioners addresses when copied while on mobile view dusk-network/rusk#3675
- Fix line height and letter spacing not being applied to the account balance's container dusk-network/rusk#3676

## [1.3.1] - 2025-04-16

### Changed

- Change address to use mono font family (Account page) dusk-network/rusk#3667

## [1.3.0] - 2025-04-16

### Added

- Add copy buttons to appropriate fields dusk-network/rusk#3620

### Changed

- Change balance appearance (Account overview page) dusk-network/rusk#3612
- Change transaction API requests to execute in parallel dusk-network/rusk#3655
- Change Addresses and IDs to monospaced font dusk-network/rusk#3640
- Change data arrangement for improved information hierarchy (Provisioners page) dusk-network/rusk#3641

### Fixed

- Fix overview pane spacing (Account page) dusk-network/rusk#3639

## [1.2.0] - 2025-04-07

### Added

- Add "nonce" to transaction details page (Public transactions) dusk-network/rusk#3578
- Add "in/out" indicator for transfer operations (Account page) dusk-network/rusk#3579

### Changed

- Change provisioner rewards column to be more readable dusk-network/rusk#3581

### Fixed

- Fix current balance showing "Loading..." for empty accounts dusk-network/rusk#3576
- Fix Account page does not reload content on key change dusk-network/rusk#3591
- Fix badge widths to maintain consistent sizing dusk-network/rusk#3483

## [1.1.1] - 2025-03-17

- Add current balance (Account page) dusk-network/rusk#3564

## [1.1.0] - 2025-03-17

### Added

- Add Account page dusk-network/rusk#3454

### Changed

- Replace legacy event system with RUES dusk-network/rusk#3425

### Removed

- Remove version number from app title dusk-network/rusk#3338

### Fixed

- Fix wrong owner key shown in provisioners table dusk-network/rusk#3377
- Fix current year not displayed in footer dusk-network/rusk#3545

## [1.0.1] - 2025-01-07

### Fixed

- Fix Owner key (Provisioners page) dusk-network/rusk#3305

## [1.0.0] - 2024-12-22

### Added

- Add stake maturity information (Provisioners page) dusk-network/rusk#3218
- Add "owner" field to provisioners dusk-network/rusk#3215

### Changed

- Change Stake details labels dusk-network/rusk#3218
- Change Transaction Type tooltips dusk-network/rusk#3249

### Fixed

- Fix inactive stake shown as active on mobile dusk-network/rusk#3218

## [0.3.0] - 2024-12-03

### Added

- Add error message for failed transactions dusk-network/rusk#2220
- Add tooltips to current and pending stake to show exact amounts dusk-network/rusk#2363
- Add `memo` and `isDeploy` fields to transactions dusk-network/rusk#2362
- Add `txType` fields in transactions dusk-network/rusk#2347
- Add `json` payload to block details dusk-network/rusk#2364
- Add decode feature for the `memo` field dusk-network/rusk#2527
- Add top node info to StatisticsPanel dusk-network/rusk#2613
- Add Provisioners page dusk-network/rusk#2649
- Add check for transaction existence in mempool dusk-network/rusk#2877

### Changed

- Change `raw` payload to `json` in transaction details dusk-network/rusk#2364
- Change average gas price display value to “lux” dusk-network/rusk#2416
- Update blocks table headers – `FEE` to `GAS`, `AVG` to `AVG PRICE`, and
  `TOTAL` to `USED` dusk-network/rusk#2416
- Update block rewards tooltip information dusk-network/rusk#2166
- Hide "Show More" button when error occurs dusk-network/rusk#2585
- Update footer layout dusk-network/rusk#2640
- Change WorldMap location dusk-network/rusk#2613
- Change network info to fetch locally dusk-network/rusk#2662
- Update Moonlight icon for visual consistency dusk-network/rusk#3038
- Update hosted Explorer links dusk-network/rusk#3064

### Fixed

- Fix improper computation of transaction fees dusk-network/rusk#2348
- Fix shield icons for transaction types dusk-network/rusk#2389
- Fix Gas Used meter behavior when Gas Limit is zero dusk-network/rusk#2668
- Fix Cluster Location layout dusk-network/rusk#3034

## [0.2.0] - 2024-08-26

### Added

- Add DEVNET option to dropdown menu in the navbar dusk-network/rusk#2159
- Add conditional rendering for layout based on screen size dusk-network/rusk#2061
- Add accessible name to gas-used progress bar dusk-network/rusk#2037
- Add accessible name to navbar button on mobile dusk-network/rusk#2036
- Add warning for stale market data dusk-network/rusk#1892

### Changed

- Update separator line colors in StatisticsPanel dusk-network/rusk#2039
- Update labels in StatisticsPanel for clarity dusk-network/rusk#2034
- Update font-display to "swap" for custom fonts, improving performance dusk-network/rusk#2025
- Optimize auto re-renders of relative times dusk-network/rusk#2059

### Fixed

- Fix “Average Fee Paid” label dusk-network/rusk#2057
- Fix list items alignment on mobile dusk-network/rusk#2056

## [0.1.0] - 2024-07-24

### Added

- Add initial release for the Explorer module dusk-network/rusk#2017

<!-- ISSUES -->

dusk-network/rusk#1892: https://github.com/dusk-network/rusk/issues/1892
dusk-network/rusk#2017: https://github.com/dusk-network/rusk/issues/2017
dusk-network/rusk#2025: https://github.com/dusk-network/rusk/issues/2025
dusk-network/rusk#2034: https://github.com/dusk-network/rusk/issues/2034
dusk-network/rusk#2036: https://github.com/dusk-network/rusk/issues/2036
dusk-network/rusk#2037: https://github.com/dusk-network/rusk/issues/2037
dusk-network/rusk#2039: https://github.com/dusk-network/rusk/issues/2039
dusk-network/rusk#2056: https://github.com/dusk-network/rusk/issues/2056
dusk-network/rusk#2057: https://github.com/dusk-network/rusk/issues/2057
dusk-network/rusk#2059: https://github.com/dusk-network/rusk/issues/2059
dusk-network/rusk#2061: https://github.com/dusk-network/rusk/issues/2061
dusk-network/rusk#2159: https://github.com/dusk-network/rusk/issues/2159
dusk-network/rusk#2166: https://github.com/dusk-network/rusk/issues/2166
dusk-network/rusk#2220: https://github.com/dusk-network/rusk/issues/2220
dusk-network/rusk#2347: https://github.com/dusk-network/rusk/issues/2347
dusk-network/rusk#2348: https://github.com/dusk-network/rusk/issues/2348
dusk-network/rusk#2362: https://github.com/dusk-network/rusk/issues/2362
dusk-network/rusk#2363: https://github.com/dusk-network/rusk/issues/2363
dusk-network/rusk#2364: https://github.com/dusk-network/rusk/issues/2364
dusk-network/rusk#2389: https://github.com/dusk-network/rusk/issues/2389
dusk-network/rusk#2416: https://github.com/dusk-network/rusk/issues/2416
dusk-network/rusk#2527: https://github.com/dusk-network/rusk/issues/2527
dusk-network/rusk#2585: https://github.com/dusk-network/rusk/issues/2585
dusk-network/rusk#2613: https://github.com/dusk-network/rusk/issues/2613
dusk-network/rusk#2640: https://github.com/dusk-network/rusk/issues/2640
dusk-network/rusk#2649: https://github.com/dusk-network/rusk/issues/2649
dusk-network/rusk#2662: https://github.com/dusk-network/rusk/issues/2662
dusk-network/rusk#2668: https://github.com/dusk-network/rusk/issues/2668
dusk-network/rusk#2877: https://github.com/dusk-network/rusk/issues/2877
dusk-network/rusk#3034: https://github.com/dusk-network/rusk/issues/3034
dusk-network/rusk#3038: https://github.com/dusk-network/rusk/issues/3038
dusk-network/rusk#3064: https://github.com/dusk-network/rusk/issues/3064
dusk-network/rusk#3215: https://github.com/dusk-network/rusk/issues/3215
dusk-network/rusk#3218: https://github.com/dusk-network/rusk/issues/3218
dusk-network/rusk#3249: https://github.com/dusk-network/rusk/issues/3249
dusk-network/rusk#3305: https://github.com/dusk-network/rusk/issues/3305
dusk-network/rusk#3338: https://github.com/dusk-network/rusk/issues/3338
dusk-network/rusk#3377: https://github.com/dusk-network/rusk/issues/3377
dusk-network/rusk#3425: https://github.com/dusk-network/rusk/issues/3425
dusk-network/rusk#3415: https://github.com/dusk-network/rusk/issues/3415
dusk-network/rusk#3454: https://github.com/dusk-network/rusk/issues/3454
dusk-network/rusk#3483: https://github.com/dusk-network/rusk/issues/3483
dusk-network/rusk#3545: https://github.com/dusk-network/rusk/issues/3454
dusk-network/rusk#3564: https://github.com/dusk-network/rusk/issues/3564
dusk-network/rusk#3564: https://github.com/dusk-network/rusk/issues/3576
dusk-network/rusk#3578: https://github.com/dusk-network/rusk/issues/3578
dusk-network/rusk#3579: https://github.com/dusk-network/rusk/issues/3579
dusk-network/rusk#3581: https://github.com/dusk-network/rusk/pull/3581
dusk-network/rusk#3591: https://github.com/dusk-network/rusk/issues/3591
dusk-network/rusk#3612: https://github.com/dusk-network/rusk/issues/3612
dusk-network/rusk#3620: https://github.com/dusk-network/rusk/issues/3620
dusk-network/rusk#3626: https://github.com/dusk-network/rusk/issues/3626
dusk-network/rusk#3639: https://github.com/dusk-network/rusk/issues/3639
dusk-network/rusk#3640: https://github.com/dusk-network/rusk/issues/3640
dusk-network/rusk#3641: https://github.com/dusk-network/rusk/issues/3641
dusk-network/rusk#3655: https://github.com/dusk-network/rusk/issues/3655
dusk-network/rusk#3667: https://github.com/dusk-network/rusk/issues/3667
dusk-network/rusk#3675: https://github.com/dusk-network/rusk/issues/3675
dusk-network/rusk#3676: https://github.com/dusk-network/rusk/issues/3676
dusk-network/rusk#3692: https://github.com/dusk-network/rusk/issues/3692
dusk-network/rusk#3694: https://github.com/dusk-network/rusk/issues/3694
dusk-network/rusk#3698: https://github.com/dusk-network/rusk/issues/3698
dusk-network/rusk#3699: https://github.com/dusk-network/rusk/issues/3699
dusk-network/rusk#3720: https://github.com/dusk-network/rusk/issues/3720
dusk-network/rusk#3739: https://github.com/dusk-network/rusk/issues/3739
dusk-network/rusk#3757: https://github.com/dusk-network/rusk/issues/3757
dusk-network/rusk#3804: https://github.com/dusk-network/rusk/issues/3804
dusk-network/rusk#3847: https://github.com/dusk-network/rusk/issues/3847
dusk-network/rusk#3924: https://github.com/dusk-network/rusk/issues/3924
dusk-network/rusk#3925: https://github.com/dusk-network/rusk/issues/3925
dusk-network/rusk#3930: https://github.com/dusk-network/rusk/issues/3930
dusk-network/rusk#3931: https://github.com/dusk-network/rusk/issues/3931
dusk-network/rusk#3985: https://github.com/dusk-network/rusk/issues/3985

<!-- VERSIONS -->

[Unreleased]: https://github.com/dusk-network/explorer/tree/main
[1.5.0]: https://github.com/dusk-network/explorer/tree/explorer-v1.5.0
[1.4.0]: https://github.com/dusk-network/explorer/tree/explorer-v1.4.0
[1.3.3]: https://github.com/dusk-network/explorer/tree/explorer-v1.3.3
[1.3.2]: https://github.com/dusk-network/explorer/tree/explorer-v1.3.2
[1.3.1]: https://github.com/dusk-network/explorer/tree/explorer-v1.3.1
[1.3.0]: https://github.com/dusk-network/explorer/tree/explorer-v1.3.0
[1.2.0]: https://github.com/dusk-network/explorer/tree/explorer-v1.2.0
[1.1.1]: https://github.com/dusk-network/explorer/tree/explorer-v1.1.1
[1.1.0]: https://github.com/dusk-network/explorer/tree/explorer-v1.1.0
[1.0.1]: https://github.com/dusk-network/explorer/tree/explorer-v1.0.1
[1.0.0]: https://github.com/dusk-network/explorer/tree/explorer-v1.0.0
[0.3.0]: https://github.com/dusk-network/explorer/tree/explorer-0.3.0
[0.2.0]: https://github.com/dusk-network/explorer/tree/explorer-0.2.0
[0.1.0]: https://github.com/dusk-network/explorer/tree/explorer-0.1.0
