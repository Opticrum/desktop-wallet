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
  networkTopology: string
  publicChannels: string
  topHubs: string
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

  // Liquidity — network (follows the node's configured chain)
  lmFollowsNode: string
  networkLabel: string
  networkMainnet: string
  networkTestnet: string
  rpcUrlLabel: string
  indexerUrlLabel: string

  // Liquidity — inbound liquidity hero
  lmInboundLiquidity: string
  lmInboundDesc: string
  lmActiveMatches: string
  lmTotalDeposit: string
  lmAvgRate: string
  lmBuyLiquidity: string
  lmBuyDesc: string

  // Liquidity — buy order modal
  lmNewOrder: string
  lmChannelCapacity: string
  lmRateShPerBlock: string
  lmDeposit: string
  lmFiberAddressOptional: string
  lmEstimatedApy: string
  lmPublishOrder: string
  lmOrderPublished: string

  // Liquidity — my orders (purchase records)
  lmMyOrders: string
  lmOrderOutpoint: string
  lmChannelOutpoint: string
  lmOrderStatus: string
  lmStatusOpen: string
  lmStatusMatched: string
  lmStatusCancelled: string
  lmCancelOrder: string
  lmCancelOrderTitle: string
  lmCancelOrderBody: string
  lmOrderCancelled: string
  lmCreatedAt: string

  // Liquidity — my matched liquidity
  lmMyMatches: string
  lmWithdrawable: string
  lmInject: string
  lmWithdraw: string
  lmAdjustTitle: string
  lmAdjustAmount: string
  lmDepositAdjusted: string
  lmExtractDelete: string
  lmExtractDeleteTitle: string
  lmExtractDeleteBody: string
  lmExtractDeleted: string

  // Liquidity — shared table labels + health
  yieldDistribution: string
  matchOutpoint: string
  matchCapacity: string
  matchRate: string
  matchRemaining: string
  matchHealth: string
  healthHealthy: string
  healthWarning: string
  healthCritical: string
  healthExhausted: string
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
  scanToReceive: string
  clickToSend: string
  zoomQr: string
  hdSectionTitle: string
  hdAccountsSuffix: string
  hdAddAccount: string
  hdActive: string
  hdAccountCreated: string
  hdImportToast: string
  hdDeleteAccount: string
  hdDeleteNeedZero: string
  hdDeleteBalanceToast: string
  hdDeleteConfirmTitle: string
  hdDeleteConfirmBody: string
  hdDeleteConfirm: string
  hdDeleteCancel: string
  hdDeleteToast: string
  hdDeleteHint: string
  close: string
  copied: string

  // Node page — sections + redesigned sidebar
  nodeChannelsSection: string
  nodePeersSection: string
  nodeTabsLabel: string
  nodeLogsSection: string
  nodeChannelCount: string
  nodePeerCount: string
  viewNodeLogs: string

  // Node page — create + delete actions
  nodeNewChannel: string
  nodeNewConnection: string
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
  nodeConfig: string
  stopNodeTitle: string
  stopNodeBody: string
  nodeStoppedToast: string
  nodeStartedToast: string
  nodeConfigReset: string
  nodeConfigSave: string
  nodeConfigSaved: string
  watchtower: string
  watchtowerLocal: string
  watchtowerRemote: string
  watchtowerRemoteEnable: string
  watchtowerRemoteDesc: string
  watchtowerUrl: string
  configFile: string
  nodeChainDesc: string

  // Node config — structured sections
  cfgSectionServices: string
  cfgSectionNetwork: string
  cfgSectionAdvanced: string
  cfgSectionScripts: string
  cfgSectionRpc: string
  cfgSectionCkb: string
  cfgNodeName: string
  cfgListenAddr: string
  cfgAnnounceListen: string
  cfgBootnodes: string
  cfgAddAddr: string
  cfgAnnouncedAddrs: string
  cfgWatchtowerInterval: string
  cfgDisableBuiltinWatchtower: string
  cfgAutoAcceptMin: string
  cfgAutoAcceptAmount: string
  cfgTlcExpiry: string
  cfgTlcFee: string
  cfgFundingTimeout: string
  cfgMaxInbound: string
  cfgMinOutbound: string
  cfgSyncGraph: string
  cfgAutoAnnounceNode: string
  cfgProxyUrl: string
  cfgRpcListenAddr: string
  cfgEnabledModules: string
  cfgCkbPolling: string
  cfgUdtWhitelist: string
  cfgScriptCodeHash: string
  cfgHashType: string
  cfgArgs: string
  cfgUdtAutoAccept: string
  cfgShowAdvanced: string
  cfgCollapseAdvanced: string
  cfgDetectNetwork: string
  cfgNetworkFromRpc: string
  cfgNetworkUnknown: string
  cfgAddUdt: string
  cfgRemove: string
  cfgCellDeps: string
  cfgTxHash: string
  cfgIndex: string
  cfgDepType: string
  cfgUdtEmpty: string
}