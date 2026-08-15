CREATE TABLE wallets (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    label            TEXT NOT NULL,
    encrypted_key    BLOB NOT NULL,
    lock_hash        BLOB NOT NULL UNIQUE,
    ckb_address      TEXT NOT NULL,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    parent_wallet_id INTEGER REFERENCES wallets(id) NULL,
    derivation_path  TEXT NULL,
    derivation_index INTEGER NULL,
    wallet_type      TEXT NOT NULL DEFAULT 'imported'
);

CREATE INDEX idx_wallets_parent ON wallets(parent_wallet_id);
CREATE INDEX idx_wallets_type ON wallets(wallet_type);
