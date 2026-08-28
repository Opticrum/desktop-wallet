export type Locale = 'zh' | 'en'

export type Messages = {
  brand: string
  brandSub: string
  nodeLabel: string
  nodeListTab: string
  nodeBuiltin: string
  nodeExternals: string
  nodeAddExternal: string
  nodeEditExternal: string
  nodeRemoveExternal: string
  nodeExternalAlias: string
  nodeExternalRpcUrl: string
  nodeExternalToken: string
  nodeExternalTokenHint: string
  nodeExternalSave: string
  nodeExternalBusy: string
  nodeReachable: string
  nodeUnreachable: string
  nodeConfirmRemoveExternalTitle: string
  nodeConfirmRemoveExternalBody: string
  nodeWalletLocked: string
  nodeWalletUnlocked: string
  nodeNoExternals: string
  nodeEditConnection: string
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

  // System tray — exit risk prompt
  trayExitTitle: string
  trayExitBody: string
  trayQuit: string
  trayCancel: string

  // Sidebar intent blocks
  wallet: string
  liquidityMarket: string
  appCountSuffix: string

  // Wallet flow — create / unlock / import (no-wallet onboarding)
  walletCreate: string
  walletSetupTitle: string
  walletHelp: string
  walletImport: string
  walletUnlock: string
  walletPassword: string
  walletSingleHint: string
  walletMnemonic: string
  walletMnemonicHint: string
  walletRemembered: string
  walletConfirmTitle: string
  walletConfirmBody: string
  walletPrivateKey: string
  walletCreateAction: string
  walletUnlockAction: string
  walletLockAction: string
  walletReceive: string
  walletImportMnemonicAction: string
  walletImportKeyAction: string
  walletCancel: string
  copy: string
  walletCreated: string
  walletImportFailed: string
  walletPasswordRequired: string
  walletPasswordWrong: string
  /** Opticrum / wallet ops blocked on unsupported network (e.g. mainnet market). */
  unsupportedNetwork: string
  walletNone: string
  walletNoneHint: string
  walletRefreshing: string

  // Node page — the embedded CKB wallet module heading
  walletCkb: string

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

  // Liquidity — network
  networkMainnet: string
  networkTestnet: string
  rpcUrlLabel: string
  /** Wallet page segmented control aria / titles */
  walletNetworkSwitch: string
  walletNetworkSwitching: string
  /** TopBar read-only wallet network pill */
  walletNetworkBadge: string
  /** Opticrum market unavailable on mainnet */
  lmMarketUnavailableTitle: string
  lmMarketUnavailableBody: string
  /** Wallet ↔ node CKB network mismatch */
  networkMismatchTitle: string
  networkMismatchTip: string
  networkMismatchBlocked: string
  networkMismatchBadge: string

  // Liquidity — KPI labels + buy action
  lmActiveMatches: string
  lmTotalDeposit: string
  lmAvgRate: string
  lmBuyLiquidity: string
  lmNoOrdersForNode: string

  // Liquidity — buy order modal
  lmNewOrder: string
  lmLiquidity: string
  lmCost: string
  lmDays: string
  lmChannelCapacity: string
  lmRateShPerBlock: string
  lmDeposit: string
  lmFiberAddressOptional: string
  lmFiberRiskTitle: string
  lmFiberRiskBody: string
  /** Order/match cell created under a fiber pubkey that differs from the current node. */
  lmLegacyCell: string
  lmPubkeyMismatchTitle: string
  lmPubkeyMismatchBody: string
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
  lmOrderCancelFailed: string

  // Liquidity — my matched liquidity
  lmMyMatches: string
  lmWithdrawable: string
  lmStakedHint: string
  lmInject: string
  lmWithdraw: string
  lmAdjustTitle: string
  lmAdjustAmount: string
  lmDepositAdjusted: string
  lmExtractDelete: string
  lmExtractDeleteTitle: string
  lmExtractDeleteBody: string
  lmExtractDeleted: string

  // Liquidity — hesitation window (buyer's post-match check period)
  lmHesitation: string
  lmHesitationLeft: string
  lmHesitationEndsAt: string
  lmHesitationInStatus: string
  lmHesitationOver: string
  lmHesitationOverHint: string
  lmAbandonOrder: string
  lmAbandonOrderFull: string
  lmAbandonOrderTitle: string
  lmAbandonOrderBody: string
  lmOrderAbandoned: string
  lmInjectBlockedHesitation: string
  lmWithdrawExpiredHint: string
  lmHesitationNotElapsed: string
  lmPartialWithdrawNotAllowed: string
  lmSellerActionsHint: string

  // Liquidity — rent-extraction progress (original vs remaining stake)
  lmExtractionProgress: string
  lmOriginalStake: string
  lmExtracted: string
  lmExtractionLeft: string
  lmExtractionPct: string

  // Help dialog — About Opticrum (protocol / buyer / seller)
  aboutButton: string
  githubLinkTitle: string
  helpTitle: string
  helpTabProtocol: string
  helpTabBuyer: string
  helpTabSeller: string
  hpLead: string
  hpS1Title: string
  hpS1a: string
  hpS1b: string
  hpS1c: string
  hpS2Title: string
  hpS2a: string
  hpS2b: string
  hpS2c: string
  hpS3Title: string
  hpS3a: string
  hpS3b: string
  hbLead: string
  hbS1Title: string
  hbS1a: string
  hbS1b: string
  hbS2Title: string
  hbS2a: string
  hbS2b: string
  hsLead: string
  hsS1Title: string
  hsS1a: string
  hsS2Title: string
  hsS2a: string
  hsS2b: string

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
  lmGlobalOrderDemand: string
  lmTotalOrders: string
  lmOrdersUnit: string
  lmLockedCapacity: string
  lmYieldDistribution: string
  lmNoYieldData: string
  /** Chip click — re-scan the whole-chain dashboard. */
  lmRefreshMarket: string
  /** Idle face of the top-bar market chip. */
  lmMarketChipLabel: string
  /** Hover face of the top-bar market chip. */
  lmClickToRefresh: string

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
  /** Pool notice shown while the wallet is locked (cells frozen). */
  lmWalletLockedHint: string
  lmDwell: string
  lmRemaining: string
  /** Match-detail hero label — time remaining until the service term expires. */
  lmUntilExpiry: string
  lmExpired: string
  lmTimeDays: string
  lmTimeHours: string
  lmTimeMinutes: string
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
  txRentPledge: string
  txRentExtract: string
  txFilterLabel: string
  txFilterEmpty: string
  txEmpty: string

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
  sendAddressRequired: string
  sendAmountInvalid: string
  sendAmountMin: string
  sendAmountExceed: string
  scanToReceive: string
  clickToSend: string
  zoomQr: string
  close: string
  copied: string

  // CKB transaction confirmation modal (构造 → 发送上链 → 打包确认 → confirmed / failed)
  ckbTxWaiting: string
  ckbTxWaitingHint: string
  ckbTxConfirmed: string
  ckbTxConfirmedHint: string
  ckbTxFailed: string
  ckbTxHash: string
  ckbTxViewExplorer: string
  ckbTxOk: string
  ckbTxStepConstruct: string
  ckbTxStepBroadcast: string
  ckbTxStepConfirm: string
  ckbTxPhaseConstructing: string
  ckbTxPhaseBroadcasting: string
  ckbTxPhaseConfirming: string

  // Node page — sections + redesigned sidebar
  nodeConnectionsSection: string
  nodeNoChannels: string
  nodeChannelListTitle: string
  nodeChannelId: string
  nodeChannelPublic: string
  nodeChannelPrivate: string
  nodeChannelCreated: string
  nodeStateActive: string
  nodeStatePending: string
  nodeStateClosing: string
  nodeStateNegotiating: string
  nodeStateCollaborating: string
  nodeStateSigning: string
  nodeStateAwaitingSigs: string
  nodeStateAwaitingReady: string
  nodeStateStale: string
  nodeBaseFeeShort: string
  nodeFeeRateShort: string
  nodeOnchainTx: string
  nodeOutbound: string
  nodeInbound: string
  nodeOutboundBalance: string
  nodeInboundBalance: string
  nodeKpiNodes: string
  nodeKpiChannels: string
  nodeKpiNodesUnit: string
  nodeKpiChannelsUnit: string
  hubConnect: string
  hubConnected: string
  hubLocal: string
  nodeLogsSection: string
  nodeChannelCount: string
  viewAllLogs: string
  logConsoleTitle: string
  logFilterLabel: string
  logFilterEmpty: string
  connFrozen: string
  connFrozenHint: string

  // Node page — Fiber transfer & invoice dialogs (clickable 出金/入金 KPIs)
  fiberSendKicker: string
  fiberSendTitle: string
  fiberSendDesc: string
  fiberInvoiceKicker: string
  fiberInvoiceTitle: string
  fiberInvoiceDesc: string
  fiberTargetInvoice: string
  fiberTargetInvoicePh: string
  fiberInvoiceRequired: string
  fiberAmount: string
  fiberMax: string
  fiberCapOutbound: string
  fiberCapInbound: string
  fiberConfirmSend: string
  fiberGenerate: string
  fiberGenerating: string
  fiberInvoiceReady: string
  fiberInvoiceHint: string
  fiberAmountRequired: string
  fiberOverCap: string
  fiberSentToast: string
  fiberGeneratedToast: string
  fiberGenerateFailed: string
  fiberDone: string

  // Node page — create + delete actions
  nodeNewChannel: string
  nodeNewConnection: string
  nodeRefresh: string
  nodeRefreshToast: string
  nodeRefreshFailed: string
  nodeFormPeerAlias: string
  nodeFormPeerAddr: string
  nodeFormCapacity: string
  nodeFormBaseFee: string
  nodeFormBaseFeeHelp: string
  nodeFormFeeRate: string
  nodeFormFeeRateHelp: string
  nodeFormCancel: string
  nodeFormCreate: string
  nodeCreateToast: string
  channelOpenLabel: string
  channelOpenSubmitting: string
  channelOpenWaiting: string
  channelOpenReady: string
  channelOpenHint: string
  channelOpenReadyHint: string
  channelOpenFailed: string
  channelOpenTimeout: string
  channelCloseLabel: string
  nodeCloseChannel: string
  nodeRemovePeer: string
  nodeConfirmDeleteTitle: string
  nodeConfirmDeleteChannelBody: string
  nodeForceCloseTitle: string
  nodeForceCloseBody: string
  nodeConfirmDeletePeerBody: string
  nodeDeleteConfirm: string
  nodeDeleteCancel: string
  nodeDeleteToast: string
  nodeDeleteFailed: string

  // Node control panel
  nodeAlias: string
  fiberPubkey: string
  fiberAddr: string
  fiberVersion: string
  fiberPort: string
  fnnCliOpen: string
  fnnCliNotInstalledTitle: string
  fnnCliNotInstalledBody: string
  fnnCliInstall: string
  fnnCliOpenFailed: string
  chain: string
  nodeRunning: string
  nodeStopped: string
  nodeStart: string
  nodeStarting: string
  nodePreparing: string
  nodeStartFailed: string
  nodeStartLocked: string
  nodeStartNoWallet: string
  /** Tooltip on node-dependent actions while the node is down. */
  nodeNotRunning: string
  nodeStop: string
  nodeConfig: string
  nodePeerPubkey: string
  nodePeerAddr: string
  stopNodeTitle: string
  stopNodeBody: string
  nodeStoppedToast: string
  nodeStartedToast: string
  nodeConfigReset: string
  nodeConfigSave: string
  nodeConfigSaved: string
  watchtower: string
  wtBuiltin: string
  wtStandalone: string
  wtDisabled: string
  watchtowerRemoteEnable: string
  watchtowerRemoteDesc: string
  watchtowerUrl: string
  watchtowerToken: string
  watchtowerTokenDesc: string
  configFile: string
  nodeChainDesc: string

  // Node config — modal tabs
  cfgTabForm: string
  cfgTabPreview: string
  cfgCopyConfig: string

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
  cfgDisableBuiltinWatchtowerDesc: string
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