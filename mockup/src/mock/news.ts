export type NewsItem = {
  id: string
  source: string
  titleZh: string
  titleEn: string
  bodyZh: string
  bodyEn: string
  time: string
  tag: 'Fiber' | 'Lightning'
}

export const news: NewsItem[] = [
  {
    id: 'n1',
    source: 'Fiber Blog',
    titleZh: 'Fiber Network 主网通道数突破 6,000',
    titleEn: 'Fiber Network channels surpass 6,000',
    bodyZh:
      '本周 Fiber Network 主网公开通道数突破 6,000,日均新增约 50 条,流动性集中在北美与东亚节点之间,网络可用性指标保持 99.95% 以上。',
    bodyEn:
      'Public Fiber Network channels crossed 6,000 this week, adding roughly 50 per day. Liquidity concentrates between North-American and East-Asian nodes, with availability holding above 99.95%.',
    time: '2h',
    tag: 'Fiber',
  },
  {
    id: 'n2',
    source: 'CKB Eco',
    titleZh: 'Opticrum 流动性市场公开测试启动',
    titleEn: 'Opticrum liquidity market public beta opens',
    bodyZh:
      'Opticrum 流动性市场即日起进入公开测试,首批接入 12 家做市商节点,支持 CKB 与通道份额的双向报价,前两周手续费减半。',
    bodyEn:
      'The Opticrum liquidity market enters public beta today. Twelve market-maker nodes are connected at launch with two-sided quotes for CKB and channel shares; fees are halved for the first two weeks.',
    time: '5h',
    tag: 'Fiber',
  },
  {
    id: 'n3',
    source: 'LN Insights',
    titleZh: '闪电网络容量本周回升至新高',
    titleEn: 'Lightning capacity rebounds to a new high this week',
    bodyZh:
      '本周闪电网络公开容量回升至 5,680 BTC,较上周环比增加 2.45%,通道中位数容量上升,大型路由节点活跃度同步上升。',
    bodyEn:
      'Public Lightning capacity rebounded to 5,680 BTC this week, up 2.45% week-over-week. Median channel size ticked up and large routing nodes saw increased activity.',
    time: '8h',
    tag: 'Lightning',
  },
  {
    id: 'n4',
    source: 'Nervos Talk',
    titleZh: 'MuSig2 聚合密钥在 Fiber 节点的实践笔记',
    titleEn: 'Notes on MuSig2 key aggregation for Fiber nodes',
    bodyZh:
      '社区开发者总结了 MuSig2 在 Fiber 节点密钥聚合中的两个常见陷阱:签名轮询超时与 nonce 重用检测。文章给出最小化的回归测试集。',
    bodyEn:
      'A community developer summarized two common pitfalls when aggregating keys with MuSig2 on Fiber nodes: signing-round timeouts and nonce-reuse detection. The post ships a minimal regression-test set.',
    time: '1d',
    tag: 'Fiber',
  },
  {
    id: 'n5',
    source: 'Bitcoin Optech',
    titleZh: '洋葱路由与多跳计费的最新讨论摘要',
    titleEn: 'Roundup: onion routing and multi-hop fee debates',
    bodyZh:
      '本周邮件列表集中讨论了洋葱路由失败时的退费策略与多跳路径的费率计算,部分实现正在尝试将费率上报与 HTLC 失败原因绑定。',
    bodyEn:
      'This week\'s mailing-list discussions focused on refund policy for failed onion routes and fee calculation across multi-hop paths. Several implementations are testing fee reports tied to HTLC failure reasons.',
    time: '1d',
    tag: 'Lightning',
  },
  {
    id: 'n6',
    source: 'Fiber Dev',
    titleZh: '发票结算延迟监控面板开源',
    titleEn: 'Open-source dashboard for invoice settlement latency',
    bodyZh:
      '一个新的开源面板发布了,可按节点、按通道查看发票结算的 P50 / P95 延迟,数据通过 CKB 索引器回填,支持历史回放。',
    bodyEn:
      'A new open-source dashboard publishes per-node and per-channel P50/P95 invoice settlement latency, backfilled via the CKB indexer with full history replay.',
    time: '2d',
    tag: 'Fiber',
  },
  {
    id: 'n7',
    source: 'LN+CKB',
    titleZh: '跨网络桥接实验:Fiber ↔ Lightning 演示周',
    titleEn: 'Bridge demo week: Fiber ↔ Lightning experiments',
    bodyZh:
      '为期一周的 Fiber 与 Lightning 跨网络桥接演示将在三个时区接力进行,覆盖原子交换、看门狗回退与失败仲裁三个核心场景。',
    bodyEn:
      'A week-long Fiber-to-Lightning bridge demo runs across three time zones, covering atomic swaps, watchtower fallbacks, and failure arbitration.',
    time: '3d',
    tag: 'Lightning',
  },
]