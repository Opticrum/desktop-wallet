// Typed per-domain IPC clients — one method per command in
// `docs/ipc/ipc-api.md` §4. Write params are CKB amounts converted to shannons
// by the caller (design decision #2: the frontend does CKB → shannons ×1e8).

import { call } from './transport'
import type {
  Chain,
  ChannelList,
  DashboardData,
  FnnCliStatus,
  LiquidityMatch,
  LiquidityOrder,
  LogLevel,
  MatchDeadline,
  NodeConfig,
  NodeLog,
  NodeRuntime,
  WalletAddress,
  WalletStatus,
  WalletSummary,
  WalletTx,
  WatchtowerConfig,
} from './types'

// ── wallet ────────────────────────────────────────────────────────────────

export const wallet = {
  getSummary: () => call<WalletSummary>('wallet.get_summary'),
  /** Fast local wallet state (no chain balance) — gates the unlock form. */
  getStatus: () => call<WalletStatus>('wallet.get_status'),
  getAddresses: () => call<WalletAddress[]>('wallet.get_addresses'),
  getTransactions: (params?: { limit?: number; offset?: number }) =>
    call<WalletTx[]>('wallet.get_transactions', params),
  unlock: (password: string, label?: string) =>
    call<WalletSummary>('wallet.unlock', { password, label }),
  lock: () => call<void>('wallet.lock'),
  createHdWallet: (label: string, password: string, addressCount: number) =>
    call<{ mnemonic: string; address: string; addresses: string[] }>('wallet.create_hd_wallet', {
      label,
      password,
      addressCount,
    }),
  importMnemonic: (mnemonic: string, password: string, label: string) =>
    call<WalletSummary>('wallet.import_mnemonic', { mnemonic, password, label }),
  importPrivateKey: (privateKeyHex: string, password: string, label: string) =>
    call<WalletSummary>('wallet.import_private_key', { privateKeyHex, password, label }),
  deriveAddresses: (count: number) => call<string[]>('wallet.derive_addresses', { count }),
  sendCkb: (address: string, amountShannons: number) =>
    call<{ txHash: string }>('wallet.send_ckb', { address, amountShannons }),
}

// ── node ──────────────────────────────────────────────────────────────────

export const node = {
  getRuntime: () => call<NodeRuntime>('node.get_runtime'),
  start: (config?: NodeConfig) => call<NodeRuntime>('node.start', config ? { config } : undefined),
  stop: () => call<void>('node.stop'),
  getLogs: (params?: { level?: LogLevel; sinceTsMs?: number; limit?: number }) =>
    call<NodeLog[]>('node.get_logs', params),
  getConfig: () => call<NodeConfig>('node.get_config'),
  saveConfig: (config: NodeConfig) =>
    call<{ chain: Chain; watchtower: WatchtowerConfig }>('node.save_config', { config }),
  fnnCliStatus: () => call<FnnCliStatus>('node.fnn_cli_status'),
  openFnnCli: (url: string) => call<void>('node.fnn_cli_open', { url }),
  openUrl: (url: string) => call<void>('node.open_url', { url }),
}

// ── channels ──────────────────────────────────────────────────────────────

export const channels = {
  list: () => call<ChannelList>('channels.list'),
  connectPeer: (addr: string, pubkey?: string, alias?: string) =>
    call<{ peerId: string }>('channels.connect_peer', { addr, pubkey, alias }),
  disconnectPeer: (peerId: string) => call<void>('channels.disconnect_peer', { peerId }),
  openChannel: (
    peerId: string,
    capacityShannons: number,
    baseFeeMshannons?: number,
    feeRatePpm?: number,
  ) =>
    call<{ tempId: string; channelId: string | null }>('channels.open_channel', {
      peerId,
      capacityShannons,
      baseFeeMshannons,
      feeRatePpm,
    }),
  closeChannel: (channelId: string, force: boolean) =>
    call<void>('channels.close_channel', { channelId, force }),
}

// ── liquidity ─────────────────────────────────────────────────────────────

export const liquidity = {
  /** SDK aggregate (snake_case) — the frontend keeps a thin mapper. */
  getDashboard: () => call<DashboardData>('liquidity.get_dashboard'),
  getOrders: (scope?: 'mine' | 'all') =>
    call<LiquidityOrder[]>('liquidity.get_orders', scope ? { scope } : undefined),
  /** Re-scan the chain and sync the personal-order cache; returns the fresh list. */
  refreshOrders: () => call<LiquidityOrder[]>('liquidity.refresh_orders'),
  getMatches: (scope?: 'mine' | 'all') =>
    call<LiquidityMatch[]>('liquidity.get_matches', scope ? { scope } : undefined),
  /** SDK aggregate (snake_case) — sorted by urgency in Rust; the frontend does not re-sort. */
  getMatchesNearExhaustion: (blocksThreshold: number) =>
    call<MatchDeadline[]>('liquidity.get_matches_near_exhaustion', { blocksThreshold }),
  publishOrder: (params: {
    capacityShannons: number
    shannonsPerBlock: number
    rentCapacityShannons: number
    rentalDays: number
    fiberAddress?: string
  }) => call<{ orderOutpoint: string; txHash: string }>('liquidity.publish_order', params),
  cancelOrder: (outpoint: string) => call<{ txHash: string }>('liquidity.cancel_order', { outpoint }),
  injectDeposit: (matchOutpoint: string, amountShannons: number) =>
    call<{ txHash: string }>('liquidity.inject_deposit', { matchOutpoint, amountShannons }),
  withdrawDeposit: (matchOutpoint: string, amountShannons: number) =>
    call<{ txHash: string }>('liquidity.withdraw_deposit', { matchOutpoint, amountShannons }),
  extractSpentMatch: (matchOutpoint: string) =>
    call<{ txHash: string; returnedCkb: number }>('liquidity.extract_spent_match', {
      matchOutpoint,
    }),
}

// ── app (host / tray) ────────────────────────────────────────────────────────

export const app = {
  /** Sync the UI locale to the shell so native tray menu text stays bilingual. */
  setLocale: (locale: string) => call<void>('app.set_locale', { locale }),
  /** Actually quit — after the tray-exit risk prompt is confirmed. */
  exit: () => call<void>('app.exit'),
}
