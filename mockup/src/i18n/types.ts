export type Locale = 'zh' | 'en'

export type Messages = {
  brand: string
  brandSub: string
  nodeLabel: string
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
  settlements24h: string
  news: string
  changelog: string
  recentTxs: string
  channelTable: string
  recentLogs: string
  openApp: string
  category: string
  uptime: string
  cpu: string
  memory: string
  tipHeight: string
  notFound: string

  // Sidebar intent blocks
  wallet: string
  liquidityMarket: string
  appCountSuffix: string

  // Hub nav cards + descriptions
  nodeOverview: string
  channelsDescription: string
  peersDescription: string
  runtimeDescription: string
  connectedPeers: string
  pending: string
  nodeNavChannels: string
  nodeNavPeers: string
  nodeNavRuntime: string

  // Liquidity — network (follows the node's configured chain)
  networkMainnet: string
  networkTestnet: string
  rpcUrlLabel: string

  // Liquidity — inbound liquidity hero
  lmInboundLiquidity: string
  lmInboundDesc: string
  lmActiveMatches: string
  lmTotalDeposit: string
  lmAvgRate: string
  lmBuyLiquidity: string

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
  lmStatusMatched: string
  lmStatusCancelled: string
  lmCancelOrder: string
  lmCancelOrderTitle: string
  lmCancelOrderBody: string
  lmOrderCancelled: string

  // Liquidity — my matched liquidity
  lmMyMatches: string
  lmWithdrawable: string
  lmStakedHint: string
  lmWithdrawableHint: string
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
  matchCapacity: string
  matchRate: string
  healthHealthy: string
  healthWarning: string
  healthCritical: string
  healthExhausted: string
  shannonsPerBlock: string
  unitCkb: string

  // Liquidity — awaiting-match pill
  meAwaitingMatch: string

  // Liquidity — card grid + bottom sheet
  mgOrderTag: string
  mgMatchTag: string
  mgDetails: string
  mgStatus: string
  mgRemainingDays: string
  mgExpiresAt: string
  mgCreatedAt: string
  mgOrderTx: string
  mgChannelTx: string
  mgMatchTx: string
  mgLinkedOrder: string
  mgLinkedMatch: string
  mgNoOrders: string
  mgNoMatches: string

  // Liquidity — pool + top strip dashboard
  lmPoolHint: string
  lmPoolLegend: string
  lmTotalDemand: string
  lmAvgApy: string
  lmPendingOrders: string
  lmAvgDwell: string
  lmAvgRemaining: string

  // Liquidity — market dashboard (right sidebar)
  lmMarketOverview: string
  lmOrderMatchSplit: string
  lmOrderDemand: string
  lmMatchCapacity: string

  // Liquidity — cell anatomy
  lmApyLabel: string
  lmRentalDays: string
  lmDemand: string
  lmInboundDemand: string
  lmShareOfTotal: string
  lmRentFlow: string
  lmCkbPerBlock: string
  lmRent: string
  lmRevokeOrder: string
  lmDaysUnit: string
  lmBack: string
  lmDwell: string
  lmRemaining: string
  lmRemainingRent: string
  lmRentalDaysShort: string
  lmSpent: string
  lmPoolLegendOrder: string

  // Liquidity — sheet rows
  lmRentalTerm: string
  lmDwellSince: string
  lmDwellHoursFull: string

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
  sendReceiveDesc: string
  viewAll: string
  txMoreRemaining: string

  // Transaction table
  txType: string
  amount: string
  time: string
  transaction: string
  txHistory: string
  txReceive: string
  txSend: string
  txChannelOpen: string
  txChannelClose: string

  // Peer / channel table headers
  capacity: string
  local: string
  remote: string
  state: string
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
  close: string
  copied: string

  // Node page — sections + redesigned sidebar
  nodeConnectionsSection: string
  nodeExpand: string
  nodeCollapse: string
  nodeNoChannels: string
  nodeOnchainTx: string
  nodeOutbound: string
  nodeInbound: string
  nodeOutboundBalance: string
  nodeInboundBalance: string
  nodeKpiNodes: string
  nodeKpiChannels: string
  hubConnect: string
  hubConnected: string
  hubLocal: string
  nodeLogsSection: string
  nodeChannelCount: string
  viewAllLogs: string
  logConsoleTitle: string

  // Node page — create + delete actions
  nodeNewChannel: string
  nodeNewConnection: string
  nodeRefresh: string
  nodeRefreshToast: string
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

  // Node control panel
  nodeAlias: string
  fiberPubkey: string
  fiberAddr: string
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