export type AppCategory = 'payments' | 'defi' | 'tools' | 'games'

export type AppPlatform = 'web' | 'mobile' | 'both'

export type MarketApp = {
  id: string
  nameZh: string
  nameEn: string
  blurbZh: string
  blurbEn: string
  descZh?: string
  descEn?: string
  category: AppCategory
  tags: string[]
  accent: string
  featured?: boolean
  rating?: number    // 1-5
  downloads?: string // e.g. "12K", "3.2M"
  badge?: 'hot' | 'new'
  platform: AppPlatform
}

export const banners = [
  {
    id: 'b1',
    titleZh: 'Fiber 支付周',
    titleEn: 'Fiber Pay Week',
    subtitleZh: '体验即时小额支付应用，手续费近乎为零。',
    subtitleEn: 'Try instant micropayment apps with near-zero fees.',
    accent: '#0f766e',
  },
  {
    id: 'b2',
    titleZh: '流动性做市启航',
    titleEn: 'Liquidity Market Launch',
    subtitleZh: '在 Opticrum 上提供通道流动性，赚取路由收益。',
    subtitleEn: 'Provide channel liquidity on Opticrum and earn routing yield.',
    accent: '#134e4a',
  },
  {
    id: 'b3',
    titleZh: '开发者工具包',
    titleEn: 'Developer Toolkit',
    subtitleZh: '调试节点、发票与通道的一站式工具集合。',
    subtitleEn: 'One-stop tools for debugging nodes, invoices, and channels.',
    accent: '#115e59',
  },
  {
    id: 'b4',
    titleZh: '跨网络实验场',
    titleEn: 'Cross-network Playground',
    subtitleZh: '探索 Fiber 与闪电网络桥接演示应用。',
    subtitleEn: 'Explore Fiber ↔ Lightning bridge demo apps.',
    accent: '#0e7490',
  },
]

export const apps: MarketApp[] = [
  {
    id: 'fiber-pay',
    nameZh: 'Fiber Pay',
    nameEn: 'Fiber Pay',
    blurbZh: '扫码或粘贴发票，一键完成 Fiber 支付。',
    blurbEn: 'Scan or paste invoices for one-tap Fiber payments.',
    descZh: 'Fiber 网络原生的即时支付工具，支持发票扫码、地址簿和交易历史，极低手续费。',
    descEn: 'Native instant payment tool for the Fiber Network. Invoice scanning, address book, and tx history with near-zero fees.',
    category: 'payments',
    tags: ['P2P', 'invoice'],
    accent: '#3f61ff',
    featured: true,
    rating: 4.8,
    downloads: '56K',
    badge: 'hot',
    platform: 'web',
  },
  {
    id: 'invoice-desk',
    nameZh: '发票工作台',
    nameEn: 'Invoice Desk',
    blurbZh: '批量创建、归档与对账 Fiber 发票。',
    blurbEn: 'Batch create, archive, and reconcile Fiber invoices.',
    category: 'payments',
    tags: ['merchant', 'batch'],
    accent: '#15b8ed',
    rating: 4.5,
    downloads: '12K',
    platform: 'web',
  },
  {
    id: 'tip-jar',
    nameZh: 'UDT 小费罐',
    nameEn: 'UDT Tip Jar',
    blurbZh: '为创作者接收 CKB / UDT 小额打赏。',
    blurbEn: 'Receive CKB / UDT micro-tips for creators.',
    category: 'payments',
    tags: ['UDT', 'tips'],
    accent: '#ff6b1a',
    rating: 4.6,
    downloads: '8K',
    platform: 'mobile',
  },
  {
    id: 'lp-desk',
    nameZh: 'Opticrum LP Desk',
    nameEn: 'Opticrum LP Desk',
    blurbZh: '管理通道流动性订单与到期提醒。',
    blurbEn: 'Manage channel liquidity orders and expiry alerts.',
    descZh: '一站式流动性管理面板，可视化通道到期时间，自动提醒续期，支持批量操作。',
    descEn: 'All-in-one liquidity management dashboard with expiry visualization, auto-renewal alerts, and batch operations.',
    category: 'defi',
    tags: ['LP', 'yield'],
    accent: '#633de8',
    featured: true,
    rating: 4.3,
    downloads: '23K',
    badge: 'hot',
    platform: 'both',
  },
  {
    id: 'channel-scout',
    nameZh: '通道侦察',
    nameEn: 'Channel Scout',
    blurbZh: '发现高流量对端并评估开通道成本。',
    blurbEn: 'Discover high-traffic peers and estimate open costs.',
    category: 'defi',
    tags: ['routing', 'analytics'],
    accent: '#0891b2',
    rating: 4.1,
    downloads: '9K',
    platform: 'web',
  },
  {
    id: 'yield-radar',
    nameZh: '收益雷达',
    nameEn: 'Yield Radar',
    blurbZh: '跟踪路由费与锁定资金的年化估算。',
    blurbEn: 'Track routing fees and estimated APY on locked capital.',
    category: 'defi',
    tags: ['APY', 'fees'],
    accent: '#ca8a04',
    rating: 3.9,
    downloads: '15K',
    platform: 'web',
  },
  {
    id: 'peer-map',
    nameZh: 'Peer 地图',
    nameEn: 'Peer Map',
    blurbZh: '可视化节点拓扑与延迟热力。',
    blurbEn: 'Visualize node topology and latency heatmaps.',
    category: 'tools',
    tags: ['graph', 'latency'],
    accent: '#0891b2',
    rating: 4.4,
    downloads: '31K',
    badge: 'hot',
    platform: 'web',
  },
  {
    id: 'hashtime-lab',
    nameZh: 'HashTime Lab',
    nameEn: 'HashTime Lab',
    blurbZh: 'HTLC / 超时路径的沙盒调试器。',
    blurbEn: 'Sandbox debugger for HTLC and timeout paths.',
    category: 'tools',
    tags: ['HTLC', 'debug'],
    accent: '#4f46e5',
    rating: 4.0,
    downloads: '6K',
    badge: 'new',
    platform: 'both',
  },
  {
    id: 'bridge-watch',
    nameZh: '桥接监视器',
    nameEn: 'LN Bridge Watch',
    blurbZh: '监控 Fiber ↔ Lightning 桥接队列健康度。',
    blurbEn: 'Monitor Fiber ↔ Lightning bridge queue health.',
    category: 'tools',
    tags: ['bridge', 'ops'],
    accent: '#ea580c',
    rating: 4.2,
    downloads: '18K',
    platform: 'web',
  },
  {
    id: 'pixel-faucet',
    nameZh: '像素水龙头',
    nameEn: 'Pixel Faucet',
    blurbZh: '用小额支付解锁协作像素画布。',
    blurbEn: 'Unlock a collaborative pixel canvas with micropayments.',
    category: 'games',
    tags: ['canvas', 'fun'],
    accent: '#db2777',
    rating: 4.9,
    downloads: '42K',
    badge: 'hot',
    platform: 'mobile',
  },
  {
    id: 'sat-runner',
    nameZh: '聪跑酷',
    nameEn: 'Sat Runner',
    blurbZh: '街机跑酷，通关结算走 Fiber 发票。',
    blurbEn: 'Arcade runner that settles levels via Fiber invoices.',
    category: 'games',
    tags: ['arcade'],
    accent: '#2563eb',
    rating: 4.7,
    downloads: '28K',
    badge: 'new',
    platform: 'mobile',
  },
]
