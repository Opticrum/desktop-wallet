-- Cache of confirmed on-chain transactions resolved by the wallet trace-back.
-- Confirmed txs are immutable, so this data never changes once written (a
-- reorged/re-included tx is overwritten by a later re-trace). Keyed by bare
-- 64-hex tx hash; inputs/outputs stored as JSON so the raw `TransactionInfo`
-- round-trips without normalized child tables.
CREATE TABLE txs_cache (
    tx_hash         TEXT PRIMARY KEY,
    block_number    BIGINT NOT NULL,
    block_timestamp BIGINT NOT NULL,
    inputs          TEXT NOT NULL,
    outputs         TEXT NOT NULL,
    cached_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_txs_cache_block_number ON txs_cache(block_number);

-- The "top" frontier per managed wallet address: the newest tx seen by the
-- last refresh. Kept current every refresh; the seed for an eventual delta
-- indexer scan.
CREATE TABLE wallet_tx_tops (
    wallet_id        INTEGER PRIMARY KEY REFERENCES wallets(id) ON DELETE CASCADE,
    top_tx_hash      TEXT NOT NULL,
    top_block_number BIGINT NOT NULL,
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
