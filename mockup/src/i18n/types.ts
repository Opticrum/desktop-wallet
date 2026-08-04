export type Locale = 'zh' | 'en'

export type Messages = {
  brand: string
  brandSub: string
  nodeLabel: string
  balance: string
  available: string
  locked: string
  availableCkb: string
  lockedFiber: string
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
  liquidityMarket: string
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

  // Liquidity — connection
  connectionPanel: string
  networkLabel: string
  networkMainnet: string
  networkTestnet: string
  rpcUrlLabel: string
  rpcUrlPlaceholder: string
  indexerUrlLabel: string
  indexerUrlPlaceholder: string
  connectionStatus: string
  statusConnected: string
  statusDisconnected: string
  connectButton: string

  // Liquidity — dashboard
  dashboardTitle: string
  tvlLabel: string
  activeOrdersLabel: string
  activeMatchesLabel: string
  averageApyLabel: string
  yieldDistribution: string

  // Liquidity — match monitoring
  matchMonitorTitle: string
  matchOutpoint: string
  matchCapacity: string
  matchRate: string
  matchRemaining: string
  matchExtractable: string
  matchHealth: string
  matchDeadline: string
  healthHealthy: string
  healthWarning: string
  healthCritical: string
  healthExhausted: string
  filterAll: string
  shannonsPerBlock: string
  unitCkb: string
  unitBlocks: string

  // Marketplace hero
  marketHeroTitle: string
  marketHeroLead: string
  featuredApp: string
  browseApps: string
  downloadsLabel: string
  ratingLabel: string
  discover: string
  hotBadge: string
  newBadge: string
  popularApps: string
  newApps: string
  platformWeb: string
  platformMobile: string
  yourBalance: string
  sendReceive: string
  sendReceiveDesc: string
  viewAll: string
  activity: string

  // Transaction table
  txType: string
  amount: string
  time: string
  transaction: string
  txReceive: string
  txSend: string
  txChannelOpen: string
  txChannelClose: string

  // Peer / channel table headers
  peer: string
  capacity: string
  local: string
  remote: string
  state: string
  fees: string
  latency: string
  asset: string

  // Send page + balance QR
  send: string
  sendDescription: string
  sendConfirm: string
  sendAddress: string
  sendAmount: string
  sendMemo: string
  scanToReceive: string
  hdSectionTitle: string
  close: string
  copied: string

  // Node page — sections + redesigned sidebar
  nodeChannelsSection: string
  nodePeersSection: string
  nodeLogsSection: string
  nodeChannelCount: string
  nodePeerCount: string
  capacityBreakdown: string
  topArticles: string
  viewNodeLogs: string

  // Node page — create + delete actions
  nodeNewChannel: string
  nodeNewPeer: string
  nodeFormPeerAlias: string
  nodeFormPeerAddr: string
  nodeFormCapacity: string
  nodeFormBaseFee: string
  nodeFormFeeRate: string
  nodeFormCancel: string
  nodeFormCreate: string
  nodeCreateToast: string
  nodeCloseChannel: string
  nodeRemovePeer: string
  nodeConfirmDeleteTitle: string
  nodeConfirmDeleteChannelBody: string
  nodeConfirmDeletePeerBody: string
  nodeDeleteConfirm: string
  nodeDeleteCancel: string
  nodeDeleteToast: string

  // Peer connection status
  peerConnected: string
  peerDisconnected: string

  // Node control panel
  nodeAlias: string
  fiberPubkey: string
  totalLocked: string
  chain: string
  nodeRunning: string
  nodeStopped: string
  nodeStart: string
  nodeStop: string
  nodeRestart: string
  stopNodeTitle: string
  stopNodeBody: string
  nodeStoppedToast: string
  nodeStartedToast: string
  nodeRestartToast: string
  watchtower: string
  watchtowerLocal: string
  watchtowerRemote: string
  watchtowerSessions: string
  watchtowerEndpoint: string
  watchtowerSwitchLocal: string
  watchtowerSwitchRemote: string
  watchtowerSwitchedToast: string
}