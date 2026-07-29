export type Locale = 'zh' | 'en'

export type Messages = {
  brand: string
  brandSub: string
  nodeLabel: string
  balance: string
  available: string
  locked: string
  address: string
  nodeOnline: string
  nodeOffline: string
  channelsActive: string
  localCapacity: string
  nodeRuntime: string
  peers: string
  synced: string
  back: string
  marketplace: string
  searchApps: string
  allCategories: string
  catPayments: string
  catDefi: string
  catTools: string
  catGames: string
  networkOverview: string
  networkNodes: string
  networkChannels: string
  networkCapacity: string
  settlements24h: string
  news: string
  changelog: string
  recentTxs: string
  channelTable: string
  peerList: string
  recentLogs: string
  openApp: string
  category: string
  uptime: string
  cpu: string
  memory: string
  tipHeight: string
  notFound: string
  peerAddr: string

  // Sidebar intent blocks
  wallet: string
  me: string
  appCountSuffix: string

  // Hub nav cards + descriptions
  nodeOverview: string
  walletOverview: string
  channelsDescription: string
  peersDescription: string
  runtimeDescription: string
  connectedPeers: string
  averageLatency: string
  pending: string
  hdWallet: string
  hdWalletDescription: string
  hdCreateWallet: string
  hdImportWallet: string
  nodeNavChannels: string
  nodeNavPeers: string
  nodeNavRuntime: string
  onchainAssets: string
  onchainDescription: string
  walletAccounts: string
  transactionCount: string
  derivationPath: string

  // Me page
  profile: string
  security: string
  preferences: string
  connectedApps: string
  about: string
  comingSoon: string
  lnAddress: string
  profileName: string

  // Settings
  settings: string
  themeLabel: string
  currencyUnit: string
  currencyUsd: string
  currencyCkb: string
  currencyBtc: string
  hideSmallBalances: string
  hideSmallBalancesHint: string
  notifications: string
  notificationsHint: string
  languageZh: string
  languageEn: string

  // Transaction table
  txType: string
  amount: string
  time: string
  transaction: string

  // Peer / channel table headers
  peer: string
  capacity: string
  local: string
  remote: string
  state: string
  fees: string
  latency: string
  asset: string
}