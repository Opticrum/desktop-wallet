export type ChangelogItem = {
  version: string
  date: string
  titleZh: string
  titleEn: string
  bodyZh: string
  bodyEn: string
}

export const changelogs: ChangelogItem[] = [
  {
    version: '0.4.2',
    date: '2026-07-28',
    titleZh: '应用市场 Banner 与分类筛选',
    titleEn: 'Marketplace banners and category filters',
    bodyZh: '桌面工作台中间区支持滚动运营位与搜索。',
    bodyEn: 'Center workbench now supports promo banners and search.',
  },
  {
    version: '0.4.1',
    date: '2026-07-21',
    titleZh: '通道详情表增加费率列',
    titleEn: 'Channel detail table adds fee columns',
    bodyZh: '展示 base fee 与 ppm，便于对比路由成本。',
    bodyEn: 'Shows base fee and ppm for easier route cost comparison.',
  },
  {
    version: '0.4.0',
    date: '2026-07-10',
    titleZh: '中英双语与深浅主题',
    titleEn: 'Bilingual UI and light/dark themes',
    bodyZh: '偏好保存在本地，重启后自动恢复。',
    bodyEn: 'Preferences persist locally across restarts.',
  },
  {
    version: '0.3.5',
    date: '2026-06-28',
    titleZh: '节点运行日志面板',
    titleEn: 'Node runtime log panel',
    bodyZh: '可快速查看 peer 连接与 HTLC 告警。',
    bodyEn: 'Quick view of peer connections and HTLC warnings.',
  },
  {
    version: '0.3.0',
    date: '2026-06-12',
    titleZh: '三栏工作台初版',
    titleEn: 'First three-column workbench',
    bodyZh: '钱包状态、应用市场与网络资讯同屏。',
    bodyEn: 'Wallet status, marketplace, and network intel on one screen.',
  },
]
