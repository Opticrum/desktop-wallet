# opticrum-sdk 覆盖缺口分析

> 版本：v1.1（修订 · 2026-08-11 对齐代码基线，经全量审计通过）· 基线 = wallet 渲染数据 · 配套文档：[ipc-api.md](./ipc-api.md)

**基线**：opticrum-wallet desktop 前端（`app/src/`）渲染所需全部数据
**范围**：wallet / channels / node / liquidity 四域走 Tauri IPC（`invoke`）；应用市场（apps / banners / news / changelogs）走远程目录 HTTP fetch，为 HTTP 边界，不设计其 command
**版本基线**：opticrum-sdk（`sdk.rs` / `types.rs` / `dashboard.rs` / `deadline.rs`）+ opticrum-calculator（`calculator/opticrum/src/types.rs`）+ rust-server（`services/wallet/`、`services/chain/real_chain_provider.rs`、`fiber/rpc_client.rs`）

---

## 0. 已确认设计决策（本稿遵循）

1. **IPC 覆盖范围**：钱包 / 通道 / 节点 / 流动性市场走 Tauri IPC（`invoke`）。应用市场（apps / banners / news / changelogs 内容型数据）走远程目录 HTTP fetch——本稿作为 HTTP 边界标注，不设计其 command。
2. **计算边界**：Rust 返回 SDK 聚合类型 + 链上原始字段；前端保留纯展示 / 纯数学公式（APY bps 换算、matchLife 剩余寿命百分比、dwell 时长、入站汇总 `computeInboundSummary` 等）。这些公式留在前端（从 `mock/liquidity.ts` 迁到前端 lib），不在 IPC 中重新计算返回。
3. **取数模式**：本轮只设计命令式请求 / 响应查询。实时事件推送（tip 高度、日志流、余额变化、匹配寿命推进、channel-state）标注为 **Phase 2 扩展**，不展开设计。

---

## 1. 基线说明：wallet 渲染数据清单

### 1.1 数据域划分

| 域 | 归属 | 说明 |
|---|---|---|
| wallet / channels / node / liquidity | **Tauri IPC（invoke）** | 本稿覆盖范围 |
| apps / banners / news / changelogs | **HTTP 边界** | 远程目录 fetch，仅标注数据结构，不设计 command |
| 纯展示 / 纯数学公式 | **前端 lib** | 从 mock 迁出，不在 IPC 中重算 |

### 1.2 IPC 域渲染数据清单

#### wallet（`WalletModule.tsx` / `SendDetail.tsx` / `QrModal.tsx`）

| 渲染字段 | 来源 | 备注 |
|---|---|---|
| `wallet.availableCkb` | `wallet.get_summary` | 主余额 |
| `wallet.totalCkb` | 同上 | 仅参与 fiatUsd 公式 |
| `wallet.lockedCkb` | 同上 | 已定义但当前未渲染，预留 |
| `wallet.fiatUsd` | 外部价格源 `Option<f64>` | `None` 时前端隐藏 USD 行 |
| `wallet.address` | `wallet.get_addresses[0]` | CKB2021 bech32m |
| `wallet.txs[].{id,type,amountCkb,timestamp,txHash}` | `wallet.get_transactions` | type: `receive`/`send`/`channel_open`/`channel_close`；amountCkb 带符号 |

#### channels（`NodeConnectionsSection.tsx` / `NodeKpiGrid.tsx`）

| 渲染字段 | 来源 | 备注 |
|---|---|---|
| `connectedNodes[].{id, alias, addr}` | `channels.list` → `ChannelNode` | peer id / alias / multiaddr |
| `nodes[].channels[].{id, txHash}` | 同上 | |
| `ch.capacityCkb` / `ch.localBalanceCkb` / `ch.remoteBalanceCkb` | 同上 | shannons/1e8 |
| `ch.state` | 同上 | 原始 `state_name` 前端映射 `active`/`pending`/`closing` |
| `ch.baseFeeMshannons` / `ch.feeRatePpm` | `channels.list` 补充（`get_channel_info`） | 已定义未渲染，可选增强 |
| `activeCount`（TopBar） | `channels.list` 派生 | 前端计数；`channelsSummary.online` 无替代（未渲染），如需由 `node.get_runtime.running` 派生 |

#### node（`NodeControlPanel.tsx` / `NodeLogsConsole.tsx` / `LogViewer.tsx` / `NodeContext.tsx`）

| 渲染字段 | 来源 | 备注 |
|---|---|---|
| `nodeRuntime.{nodeAlias, startedAtMs, fiberPubkey, fiberAddr, chain}` | `node.get_runtime` | `uptimeHours` 保留（整小时派生）；前端计时用 `startedAtMs` |
| `nodeWatchtower.{mode, endpoint}` | 同上 | wire 值为 standalone / disabled / builtin；mock/UI 现用 `'local'\|'remote'`（`NodeControlPanel` `wt-${mode}`），接入时迁移 |
| `running`（本地布尔） | `node.get_runtime` | 子进程状态，state-as-data 非错误 |
| `logs[].{ts, level, msg}` + `stats.{INFO,WARN,ERROR}` | `node.get_logs` | stats 为前端计数 |
| `chain` | `NodeContext` | 由 `save_config` 时 `setChain(config.fiber.chain)` 写入 |
| `nodeRuntime.tipHeight/cpuPercent/memPercent/synced` | 无 IPC 替代（未渲染遗留字段） | `tipHeight` 归 Phase 2 `node.tip_changed`；其余建议删除 |
| `config.*` 全字段 | `node.get_config` / `node.save_config` | 见 1.4 + 第 5 节配置层 |

#### liquidity（`LiquidityMarket.tsx` / `LiquidityCellField.tsx` / `LiquiditySheet.tsx`）

| 渲染视图 | 关键字段 | 来源 |
|---|---|---|
| pool cell order | `outpoint, annualYieldBps, channelCapacityCkb, rentalDays, createdAt, status` | `liquidity.get_orders` + 前端 `dwellHours`/`dwellTierColor` |
| pool cell match | `outpoint, channelOutpoint, annualYieldBps, channelCapacityCkb, createdAt, expiresAt, depositCkb, withdrawableCkb, matchLife{pct,label,isExhausted}` | `liquidity.get_matches` + 前端 `matchLife`/`rentalDaysForMatch`/`lifeTierColor` |
| tooltip order/match | 同上 + `shannonsPerBlock` + `sharePct`（前端 Σ） | |
| overview donut（64px 右上） | orders: `channelCapacityCkb`（按份额着色）；matches: `matchLife.label` | 前端聚合 |
| sheet order | `status, channelCapacityCkb, annualYieldBps, shannonsPerBlock, depositCkb, rentalDays, outpoint, createdAt` | |
| sheet match | `matchLife, channelCapacityCkb, withdrawableCkb, channelOutpoint, outpoint, annualYieldBps, shannonsPerBlock, depositCkb, createdAt, expiresAt` | |
| strip dashboard KPIs（orders tab） | `totalDemand, avgApy, pending, avgDwell` | 前端 reduce |
| strip dashboard KPIs（matches tab） | `active, totalDeposit, avgRate, avgRemaining` | 前端 reduce |
| market overview（右 aside） | `dashboard.{totalOrdersCapacityCkb, totalOrders, totalCapacityLockedCkb, avgAnnualYieldBps, avgShannonsPerBlock}` + 收益分布直方图 `yield_distribution.buckets` | `get_dashboard` → `mapDashboardData`（snake→camel 薄 mapper；`formatCkb`/`formatBpsValue`/`toLocaleString`） |
| 表单 | publish（`channelCapacityCkb, shannonsPerBlock, depositCkb, rentalDays=30, fiberAddress?`）；adjust（`depositCkb`/`withdrawableCkb` 封顶） | |

### 1.3 HTTP 边界域（不设计 command，仅标注）

- **apps**：`id, nameZh, nameEn, blurbZh, blurbEn, descZh, descEn, category, tags, badge, featured, platform, accent, rating, downloads`（Home 搜索 / 分类 / hot-new 分组 / AppGrid / AppDetail）
- **banners**：`id, titleZh, titleEn, subtitleZh, subtitleEn, accent`（Home 内联轮播）
- **news**：`id, tag('Fiber'|'Lightning'), titleZh, titleEn, bodyZh, bodyEn, source, time`
- **changelogs**：`version, date, titleZh, titleEn, bodyZh, bodyEn`

### 1.4 前端保留公式清单（设计决策 #2，全部留在前端）

**wallet / node 域：**
1. 钱包余额展示：`availableCkb.toFixed(2).split('.')` → whole/frac 分段、`whole.toLocaleString()` 渲染
2. 法币估算：`fiatUsd = (availableCkb / totalCkb) * wallet.fiatUsd` → `≈ $X USD`
3. 交易金额带符号：`(amountCkb >= 0 ? '+' : '') + amountCkb.toLocaleString({maximumFractionDigits:2}) + ' CKB'`
4. 短哈希 `shortHash(h) = h.slice(0,8) + '…' + h.slice(-6)`；中长 `truncatedHash(h) = h.slice(0,12) + '…' + h.slice(-12)`
5. 交易类型计数 `typeCounts{receive,send,channel_open,channel_close}`；日志等级计数 `stats{INFO,WARN,ERROR}`（均为 reduce）
6. 每节点流动性汇总：`nodeOutboundCkb = Σ localBalanceCkb`；`nodeInboundCkb = Σ remoteBalanceCkb`（对应 `computeInboundSummary` 类公式；IPC 只返回原始通道余额）
7. KPI 汇总：`outboundCkb/inboundCkb = Σ 全通道`、节点数、通道数
8. 容量占比条：`localPct = capacityCkb>0 ? Math.round(localBalanceCkb/capacityCkb*100) : 0`；`remotePct = 100 - localPct`
9. 日志时间格式化：`new Date(ts).toLocaleString(locale, {month/day/hour/minute/second})`
10. 链网检测 `detectChainFromRpc(rpcUrl)`：`includes('testnet')→testnet` / `includes('mainnet')→mainnet` / 否则 `null`（纯字符串启发式）
11. `config.yml` 序列化 + 体积：`serializeConfigYaml(config)` → `new Blob(yaml).size / 1024` → `'~/.fiber-node/config.yml · X.X KB'`
12. QR 伪图案：`address` 做 FNV-1a 32-bit + xorshift 位流确定性渲染 finder/timing/alignment（纯前端渲染，非 IPC）
13. `startedAtMs` → 每秒刷新 `Xh Ym` 实时计时展示（分钟级；`uptimeHours` 为整小时派生，不再直接渲染）
14. `activeTypes` 过滤（仅展示选中的交易类型；依据 `wallet.get_transactions` 的 `kind`）
15. level filter chips（本地筛选日志等级；依据 `node.get_logs` 返回）
16. fiber `state_name` → `active|pending|closing` 显示桶映射（依据 `Channel.state`）

**liquidity 域：**
1. `shannonsPerBlockToApyBps(rate, capacityCkb) = round((shannonsPerBlock * BLOCKS_PER_YEAR) / (capacityCkb * 1e8) * 10000)`；`BLOCKS_PER_YEAR = 2_629_800`（12s 出块，calculator config）
2. `dwellHours(iso, now) = max(0, (now - createdAt) / 3_600_000)`（订单驻留时长）
3. `rentalDaysForMatch(match) = max(1, round((expiresAt - createdAt) / 86_400_000))`
4. `matchLife(match, now) = { pct: round(clamp((expiresAt-now)/(expiresAt-createdAt), 0..1)*100), label: pct<=0 'exhausted' | <25 'critical' | <50 'warning' | else 'healthy', isExhausted: pct<=0 }`（小写，对齐 `LiquidityMatch.health` wire 枚举；mock 当前返回大写 label，迁移前端 lib 时一并改小写）
5. `computeInboundSummary(matches) = { totalInboundCkb: Σ channelCapacityCkb(非耗尽), activeMatches, totalDepositCkb: Σ depositCkb(全部), avgRateBps: round(avg annualYieldBps(active)) }`
6. `daysLeft(match) = max(0, ceil((expiresAt - now) / 86_400_000))`
7. Order cell gauge `min(100, dwellH/168*100)` + `dwellTierColor`（≤72h teal / ≤168h warn / >168h danger）
8. Match cell gauge `life.pct` + `lifeTierColor` + `lifeColor`（连续绿→黄→红）
9. `formatCkbPerBlock(shannons) = shannons / 1e8`
10. `splitPct = orderDemandTotal / (orderDemandTotal + matchCapTotal)`
11. `cellDiameter(capacityCkb, maxCap)`：sqrt 面积缩放 96–168px（纯渲染，物理循环是装饰性的，永不 IPC）
12. `get_dashboard` / `get_matches_near_exhaustion` 的 snake_case→camelCase 薄 mapper
13. 本地取消后从池中过滤（spent/hidden）
14. 订单池汇总 `totalDemand`/`avgApy`/`pending`/`avgDwell`（前端 reduce，LiquidityMarket.tsx:188-210）

**shell-content 域**：app 搜索匹配 / hot-new 分组 / 分类分组 / news tag 过滤 / `iconLetter` / `platformLabel` / blurb 回退 / 星级 —— 全部前端本地逻辑，无 IPC 项。TopBar 的 `apps.length` 走 HTTP 内容域（fetch）；`channelsSummary.activeCount` 来自 `channels.list`；`total_matches` 来自 `liquidity.get_dashboard`（IPC 参与，见 ipc-api.md §2.2）。

### 1.5 其他基线约定

- **state-as-data**：`unlocked=false` / `running=false` 是正常状态值，非错误；Rust 以字段返回而非抛错。
- **not 设计项**：撮合（match）在本 UI 无用户动作，属链外撮合；**本轮不设计 match 的 invoke**。
- **`'mine'` 过滤**：`liquidity.get_matches` 以**买方视角**为主（`order_args.buyer_lock_hash == 当前钱包 lock hash`，与 mockup buyer-centric 基线一致，`depositCkb`/`withdrawableCkb` 均为买方语义）；钱包节点作为流动性提供方时 `seller_lock_hash == 钱包 lock hash` 的匹配也计入（见 ipc-api.md §4.4）。
- **Phase 2 标注项**：tip 高度、日志流、余额变化、匹配寿命推进、channel-state 实时推送。

---

## 2. SDK 现有能力概览（简短）

`opticrum-sdk` 是**纯 CKB opticrum 协议**的查询 + 组装层，无钱包、无 Fiber 网络、无签名广播：

- **扫描**：`scan_orders(fiber_pubkey?)` / `scan_matches(fiber_pubkey?)` → 原始 `OrderInfo`/`MatchInfo`（calculator reader）。
- **聚合**：`compute_dashboard` → `DashboardData`（`tip_block, total_orders/total_matches, active_matches, exhausted_matches, total_capacity_locked_shannons, total_orders_capacity_shannons, avg_shannons_per_block, avg_annual_yield_bps, matches_near_exhaustion, recent_orders, recent_matches, yield_distribution`）；`summarize_order`/`summarize_match` → `OrderSummary`/`MatchSummary`；`get_order_detail`/`get_match_detail`（dashboard.rs:182/207）→ `OrderDetail`/`MatchDetail`。
- **到期监控**：`find_matches_near_exhaustion(blocks_threshold)`（deadline.rs:143；IPC 命令名为 `liquidity.get_matches_near_exhaustion`）→ `MatchDeadline[]` + `sort_by_urgency`（排序在 Rust，前端不重排）；另有 `find_exhausted_matches`（deadline.rs:126）可直接取已耗尽匹配。
- **组装**：`build_create_order` / `build_cancel_order` / `build_match_order` / `build_extract_rent` / `build_update_match` / `build_destroy_match` → **unsigned `TransactionSkeleton`**（`destroy` 带 NotExhausted guard 返回剩余 CKB）。
- **显式不负责**（`sdk.rs:4`）："The SDK does **not** manage wallets or keys." `build_*` 只返回 unsigned skeleton，**不签不发**。

---

## 3. 覆盖判定矩阵

| # | 渲染需求 | 覆盖方 | 缺口说明 | 建议动作 |
|---|---|---|---|---|
| 1 | `wallet.unlock/create_hd_wallet/import_mnemonic/import_private_key/derive_addresses/lock`（HD 钱包、keystore、BIP32、解锁会话） | rust-server-wallet | SDK 明确无钱包/密钥/签名；rust-server `services/wallet/` 能力完整但强耦合 `DbPool`（`wallets` 表）与 HttpOnly cookie 会话 | 抽出 `services/wallet/{hd_wallet,crypto,keystore,address,wallet_session}` 进 opticrum-wallet-core，去 DbPool；子键改为每次 unlock 由 keystore+mnemonic 重派生（复用 `unlock_keystore` 派生循环）或轻量本地索引；`WalletSessionManager` 原样复用即得 `unlocked` 语义（TTL 3600s 滑动、`clear`） |
| 2 | `wallet.get_summary`/`get_addresses`：`available_ckb/total_ckb/locked_ckb`、`address`、`lock_hash`、`chain` | rust-server-wallet | SDK 无余额聚合；rust-server `get_hd_wallet_balance`/`get_hd_wallet_address_balances` 用 `ChainProvider.get_balance_by_address` 循环求和（返回**原始 shannons**，`/1e8` 在 core 层预换算），但绑 DbPool（`list_wallets_by_type 'hd_child'`）；chain→hrp 地址/lock_hash 派生在 `address.rs` | 抽无 DB 版本：对解锁钱包地址集合逐个 `provider.get_balance_by_address` 求和并 `/1e8` 填 `WalletSummary`（available=sum、locked 预留）；`address` 用 `ckb_address_from_pubkey(hrp per chain)`；`lock_hash` 用 `script_lock_hash(lock_arg)`（即 channels.list 的 `owner_lock_hash` 输入） |
| 3 | `channels.list` → `ChannelNode`/`Channel`（peer id/alias/addr、capacity_ckb、local/remote_balance_ckb、state） | **new-core-crate** | SDK 只谈 CKB opticrum 协议，不接触 Fiber 网络；通道/对端/节点数据只来自 fiber-node JSON-RPC。rust-server `RealChainProvider.scan_fiber_channels`/`list_peers` 可复用但绑 `ChainProvider` trait + `fiber-json-types`（vendored fiber RPC 类型），SDK 无法提供；alias 链上无（需 peer/`announced_node_name` 匹配，替代 mock `connectedNodes[].alias`） | 移植 rust-server `fiber/rpc_client.rs` + `fiber-json-types` 调用面进 new-core-crate，写 `channels.list`：`scan_fiber_channels(owner_lock_hash=当前钱包 lock_hash)` + `list_peers` 按 `counterparty_fiber_key` 分组 → `ChannelNode`；`*_ckb = shannons/1e8`；`state_name` 保留原始、前端映射 `active`/`pending`/`closing`（公式，设计决策 #2） |
| 4 | `node.get_runtime` → `NodeRuntime`：`fiber_pubkey/addr`、`alias`、`chain`、`running`、`started_at_ms`（+ `uptime_hours` 派生）、`watchtower{mode,endpoint}` | **new-core-crate** | SDK 无。rust-server `get_fiber_node_info` 有 node_info 解析（version/commit_hash/pubkey/addresses/chain_hash + '0x' 十六进制 counts），但 running/uptime_hours（子进程状态，rust-server 是常驻进程无此概念）、持久化 chain、watchtower 派生（`standalone_watchtower_rpc_url→standalone` / `disable_built_in_watchtower→disabled` / 否则 `builtin`）均需 desktop 新写 | new-core-crate 写 `NodeProcessManager`（spawn/terminate、`process_start_ts→started_at_ms` + `uptime_hours` 派生、`running` bool）+ 组装 `get_runtime`：node_info + 子进程状态 + 持久化 `config.fiber.chain` + config 派生 `watchtower{mode,endpoint}` |
| 5 | `wallet.send_ckb` 真实 CKB 转账（组装+签名+广播+确认） | **new-core-crate** | `RealChainProvider.send_transaction` 是 placeholder（`'create_order:'`/`'cancel_order:'` 前缀检测返回伪 hash，真实路径报错）；`HdWalletSigner`/`InternalSigner.sign()` 只对 `'operation:tx_hex'` 字符串做 SHA256 签名（非真 CKB 交易）；rust-server 无 secp256k1_blake160 转账组装 | 新写 `send_ckb` 流水线：`AddSecp256k1SighashCellDep` + `BalanceTransaction` + cinnabar `balance_and_sign` → send → register → `wait_for_confirmation`（300s 超时，参照 `TransactionAssembler`）；用解锁的 HD child key 真签；`address.rs` 校验 CKB2021 bech32m（ckb/ckt） |
| 6 | `wallet.get_transactions` 账户历史：`kind(receive/send/channel_open/channel_close)` + `amount_ckb`(带符号) + `timestamp_ms` + `tx_hash` | **new-core-crate** | 无现有实现。rust-server `RealChainProvider` 有可复用底层（`get_cells_by_lock_arg` / `get_transaction` 含 TxInputInfo/TxOutputInfo 与 `lock_args_len` / `get_block_timestamp`），但 "funding-lock args 长度 20 / channel outpoint 识别 channel_open/close + CellOutput 容量差算 amount + 分类" 的索引器逻辑不存在于任何层 | new-core-crate 写 desktop account-history indexer：对钱包各 lock_hash `get_cells_by_lock_arg` → `get_transaction` → Rust 内按 `lock_args_len==20` / channel outpoint 判定 kind、容量差算 signed `amount_ckb`、`get_block_timestamp(block)` 得 `timestamp_ms`；replace mock `wallet.txs` |
| 7 | `liquidity.get_matches` 返回 `deposit_ckb / withdrawable_ckb / created_at_ms / expires_at_ms`（SDK 只有块序号） | **new-core-crate** | `MatchSummary` 只有 `remaining_capacity_ckb/last_extraction_block/projected_exhaustion_block`，连 `match_creation_block` 都没有（只在 `MatchDetail`/`MatchDeadline`）；`deposit_ckb/withdrawable_ckb` 在 `MatchInfo.ckb_capacity`（opticrum-calculator 原始字段，SDK 未暴露为聚合）；block→ms 时间戳 SDK 无（`get_block_timestamp` 只在 rust-server ChainProvider，SDK 无） | new-core-crate 写 `get_matches` 服务：`scan_matches` → 每 `MatchInfo` 调 `get_block_timestamp(match_current_block)→created_at_ms`、`get_block_timestamp(projected_exhaustion_block)→expires_at_ms`（`shannons_per_block==0`→`u64::MAX`）；`deposit_ckb`=本地 sidecar（回退 `withdrawable_ckb`）；`withdrawable_ckb`=`MatchInfo.ckb_capacity/1e8`（xUDT 时 `xudt.amount/1e8`）；`channel_capacity_ckb`=`remaining_capacity_ckb`（耗尽为 0）。前端 `matchLife/rentalDaysForMatch/daysLeft/computeInboundSummary` 仍按 #2 留前端 |
| 8 | `liquidity.get_orders` 返回 `deposit_ckb / rental_days / status / created_at_ms / fiber_address` | **opticrum-calculator** | `OrderSummary` 缺 `deposit_ckb/rental_days/status/created_at_ms`，且 `fiber_address` 被折叠成 `has_fiber_address: bool`。`deposit_ckb` 可取自 `OrderInfo.ckb_capacity`（reader `real_rent_capacity` 已算）但 SDK 未暴露；`rental_days` 链上不存（`OrderData` 无此字段，mock 硬编码 30）；`created_at` 需订单创建块，但 `OrderInfo` 无 `block_number`（`parse_order_cell` 丢弃 base.block_number，`OrderDetail.block_number` 硬编码 0——`dashboard.rs:202` 注释已确认）；`status` 恒 `'open'`（matched/cancelled 链上消费后不存在） | (a) opticrum-calculator reader：给 `OrderInfo` 增加 `block_number`（`parse_cell_prologue` 已有，传进结构即可，避免 `OrderDetail.block_number` 为 0）；(b) new-core-crate 写 `outpoint→{rental_days, created_at_ms, deposit_ckb}` 本地 sidecar（`publish_order` 写入、`get_orders` join、缺失→null 前端隐藏 dwell/rental 徽章）；(c) `get_orders` 用 `OrderInfo.ckb_capacity/1e8` 填 `deposit_ckb`、直接透传 `OrderInfo.fiber_address` |
| 9 | liquidity 写操作（publish/cancel/inject/withdraw/extract）的签名+广播+确认，及 extract 的 `returned_ckb` | **new-core-crate** | SDK 覆盖 unsigned skeleton 组装（`build_create_order`/`build_cancel_order`/`build_update_match`/`build_destroy_match`，destroy 已带 NotExhausted guard 返回 remaining CKB），但不签不发；rust-server 签名器是占位；extract 成功路径 `returned_ckb`（toast `lmExtractDeleted` 显示）需计算 | new-core-crate 包一层 assemble + `balance_and_sign` + send_and_wait（复用 `TransactionAssembler` 模式，300s 确认超时）；`publish_order` 写 sidecar（`rental_days/created_at_ms/deposit_ckb`）；extract 用 `MatchInfo.ckb_capacity/1e8` 计算 `returned_ckb` 返回 |
| 10 | `channels.connect_peer / disconnect_peer / open_channel / close_channel` | **new-core-crate** | `connect_peer/open_channel/shutdown_channel` 在 rust-server `ChainProvider` trait 有；`disconnect_peer` 不在 trait（已确认，需经 vendored fiber `rpc_client` call `'disconnect_peer'`）；`open_channel` 现只返回 temp_id 不轮询 channel_id；fee-at-open 支持未知（mock `baseFeeMshannons/feeRatePpm` 定义了未渲染） | new-core-crate 写 `disconnect_peer`（fiber `rpc_client` call `'disconnect_peer'`，ConfirmModal 确认后调用）；`open_channel` 补 temp_id→channel_id 轮询；`connect_peer` 从 addr 的 `/p2p/` 段解析 pubkey；fee 参数 fiber 不支持时文档标注 no-op 并经 update 后补 |
| 11 | `channels.list` 通道费用 `base_fee_mshannons / fee_rate_ppm` | **new-core-crate** | `FiberChannelInfo` 无费用字段（已确认 list_channels 解析不含，rust-server 注释即标注 gap）；需 fiber `get_channel_info` RPC 补取；前端 mock 已定义但未渲染 | new-core-crate 对 ChannelReady 通道调 fiber `get_channel_info` 补 `base_fee_mshannons/fee_rate_ppm`（NodeNotRunning 或不可用时 `None`）；文档标注可选增强，前端可不渲染 |
| 12 | `node.start / node.stop / node.get_logs`（子进程管理 + 日志环形缓冲 + stats 计数源） | **new-core-crate** | rust-server 是常驻服务进程，无子进程 spawn/stdout-stderr 捕获，无日志缓冲；无任何现成实现可复用 | new-core-crate 写子进程管理器（idempotent start/stop、spawn 用 config 指定 fiber-node 可执行、`process_start_ts`）＋环形日志缓冲（stdout/stderr 捕获、level 归一化 INFO/WARN/ERROR）＋ `get_logs(level/since_ts_ms/limit)` 拉取查询；实时流标注 Phase 2 `node.log_line`。前端 `stats{INFO,WARN,ERROR}` 计数与 locale 时间格式按 #2 留前端 |
| 13 | `node.get_config / node.save_config`：NodeConfig serde 结构 + config.yml YAML round-trip + chain/watchtower 持久化 | **new-core-crate** | config.yml schema 目前只在前端 `mock/fiberConfig.ts`（`defaultNodeConfig` + `serializeConfigYaml`，含全字段/枚举）；rust-server 源码零 serde_yaml（已 grep 确认）；`NodeConfigModal` 全字段需 Rust 侧 1:1 结构 | new-core-crate 写 `NodeConfig` serde 结构（`services[]/fiber{...}/rpc{...}/ckb{...}/scripts[]/udt_whitelist[]`，`scripts.cell_deps.kind` = `type_id`\|`cell_dep`）+ serde_yaml 读写（文件缺失时默认）+ save 持久化 `fiber.chain` + 派生 watchtower 并返回；`RPC_MODULES/SERVICES/HASH_TYPES` 枚举留前端常量（静态 UI 元数据，不进 IPC） |
| 14 | `wallet.get_summary` 的 `fiat_usd`（可选价格源，`None` 时前端隐藏 USD 行） | frontend-only | SDK 与 rust-server 均无价格 feed；mock `wallet.fiatUsd` 需替换为 `Option<f64>`。按设计决策 #2 这是外部数据源，非 SDK 依赖 | 本轮 frontend 只消费 `None` 路径（隐藏 USD 行）即可闭环；若实现，在 new-core-crate 写可选外部价格 fetch（标注可选，不阻塞主线） |

---

## 4. 按域展开缺口详情

### 4.1 wallet 密钥层（缺口 #1、#2）

**现状**：`opticrum-sdk` 明确 "The SDK does **not** manage wallets or keys"（`sdk.rs:4`），`build_*` 返回 unsigned skeleton，不签不发。**前端 wallet 域命令全部依赖从 rust-server 抽出的能力。**

**rust-server 已有能力**（`services/wallet/`）：
- `hd_wallet.rs`：BIP39 / BIP32 派生 `m/44'/309'/0'/0/N`（coin 309 = CKB）
- `keystore.rs`：AES-256-GCM，密文格式 `nonce[12] || ciphertext`（hex），元数据含 `derivation_path: "m/44'/309'/0'/0"`
- `crypto.rs`、`address.rs`：`ckb_address_from_pubkey`（blake160 + script_lock_hash + **bech32m** CKB2021）、`script_lock_hash(lock_arg)`
- `wallet_session.rs`：`WalletSessionManager`，TTL 3600s 滑动、`create`/`password_for`/`status`/`clear` —— 原样复用即得 `unlocked` 语义
- `wallet_service.rs`：`get_hd_wallet_balance` / `get_hd_wallet_address_balances`（`ChainProvider.get_balance_by_address` 循环求和，返回**原始 shannons `u64`**；`/1e8` 预换算在 wallet-core 层完成，rust-server 函数内无换算）

**强耦合点**（抽取必须去除）：
- `wallet_service` 绑 `DbPool`（`list_wallets_by_type 'hd_child'`）→ 子键改为每次 unlock 由 keystore+mnemonic 重派生（复用 `unlock_keystore` 的派生循环）或轻量本地索引
- 会话绑 HttpOnly cookie → `WalletSessionManager` 本身可无 HTTP 复用

**产出**：`wallet.unlock/create_hd_wallet/import_mnemonic/import_private_key/derive_addresses/lock/get_summary/get_addresses`，返回 `WalletSummary{available_ckb, total_ckb, locked_ckb}` + 地址列表。`fiat_usd` 为 `Option<f64>`，`None` 时前端隐藏 USD 行（缺口 #14，本轮前端只消费 `None` 路径）。

### 4.2 节点 / 通道层（缺口 #3、#4、#10、#11、#12）

**现状**：SDK 对 Fiber 网络零覆盖——它只谈 CKB opticrum 协议。通道/对端/节点运行时数据只来自 fiber-node JSON-RPC，SDK 无法提供。

**可复用**（rust-server，但绑 `ChainProvider` trait + vendored `fiber-json-types`，需移植调用面）：
- `RealChainProvider.scan_fiber_channels` / `list_peers`（#3）
- `get_fiber_node_info` 的 node_info 解析（version/commit_hash/pubkey/addresses/chain_hash，'0x' 十六进制 counts）（#4）
- `connect_peer` / `open_channel` / `shutdown_channel`（trait 内已有）（#10）
- `fiber/rpc_client.rs`（vendored 移植）+ `fiber-json-types`（实为 git 固定 rev 依赖 `nervosnetwork/fiber@3c25bcf1`，rust-server Cargo.toml:56，非 path 依赖）整体移植（#3/#10/#11）

**需 new-core-crate 新写**：
- `channels.list`：`scan_fiber_channels(owner_lock_hash=当前钱包 lock_hash)` + `list_peers` 按 `counterparty_fiber_key` 分组 → `ChannelNode`；`*_ckb=shannons/1e8`；`state_name` 保留原始、前端映射 `active|pending|closing`；alias 链上无，需 peer/`announced_node_name` 匹配（替代 mock `connectedNodes[].alias`）。**注意**：现有 `scan_fiber_channels` 忽略 owner 且 `include_closed: true`（real_chain_provider.rs:331），core 需自行过滤 owner / Closed
- `node.get_runtime`：`NodeProcessManager`（spawn/terminate、`process_start_ts→started_at_ms` + `uptime_hours` 派生、`running` bool）+ node_info + 持久化 `config.fiber.chain` + config 派生 `watchtower{mode,endpoint}`
- `disconnect_peer`（不在 trait，经 fiber `rpc_client` call `'disconnect_peer'`，ConfirmModal 确认后调用）；`open_channel` 补 temp_id→channel_id 轮询；`connect_peer` 从 addr 的 `/p2p/` 段解析 pubkey；fee-at-open 未知，标注 no-op 并经 update 后补
- `channels.list` 费用补充：ChannelReady 通道调 fiber `get_channel_info` 补 `base_fee_mshannons/fee_rate_ppm`（不可用时 `None`，可选增强，前端可不渲染）
- `node.start/stop`：idempotent、spawn 用 config 指定 fiber-node 可执行；`node.get_logs(level/since_ts_ms/limit)`：stdout/stderr 环形缓冲 + level 归一化 INFO/WARN/ERROR。实时日志流标注 **Phase 2 `node.log_line`**

### 4.3 流动性订单 / 匹配渲染字段缺失（缺口 #7、#8）

**SDK 有但字段不匹配（明确列表）**：

| SDK 提供 | 前端需要 | 不匹配点 |
|---|---|---|
| `OrderSummary.has_fiber_address: bool` | `fiber_address: string` | **字段折叠**：SDK 只给 bool，字符串被丢弃；`OrderDetail.fiber_address: Option<String>` 才有字符串。`get_orders` 应直接透传 `OrderInfo.fiber_address` |
| `MatchSummary` 无 `match_creation_block` | `createdAt` | **层级错位**：`match_creation_block` 只在 `MatchDetail`/`MatchDeadline`，`MatchSummary` 缺失 → `get_matches` 需从 `MatchInfo.match_current_block` 取 |
| `MatchSummary.remaining_capacity_ckb` | `channelCapacityCkb`（耗尽为 0） | 字段名不同但可映射；耗尽时需 core 层置 0（SDK 的 `is_exhausted` 已提供判定） |
| SDK 无 block→ms 时间戳（`get_block_timestamp` 只在 rust-server ChainProvider） | `createdAt`/`expiresAt`（ms） | **能力缺失**：`get_matches` 需对每个 `match_current_block`/`projected_exhaustion_block` 调 `get_block_timestamp` |
| `OrderInfo.ckb_capacity`（reader 已算 `real_rent_capacity`） | `deposit_ckb` | **未暴露为聚合**：SDK 只暴露 `xudt_amount` 等，需 core 层 `/1e8` 填充 |
| `OrderData`（`xudt_amount, channel_capacity, shannons_per_block`） | `rentalDays` | **链上不存**：`OrderData` 无此字段，mock 硬编码 30 → 需本地 sidecar |
| SDK 无 order `block_number`（`parse_order_cell` 丢弃 base.block_number；`OrderDetail.block_number` 硬编码 0，`dashboard.rs:202` 注释确认） | `createdAt` | **底层信息丢弃** → 需 opticrum-calculator reader 给 `OrderInfo` 增加 `block_number`（`parse_cell_prologue` 已有） |
| SDK 无 order `status` | `status: open/matched/cancelled` | **语义缺失**：链上消费后 matched/cancelled 单元格不存在，恒 `'open'` → 前端状态机依赖本地/sidecar 维护 |

**解决路径**：
- **`get_matches`**（new-core-crate）：`scan_matches` → 每 `MatchInfo` 调 `get_block_timestamp(match_current_block)→created_at_ms`、`get_block_timestamp(projected_exhaustion_block)→expires_at_ms`（`shannons_per_block==0→u64::MAX`）；`deposit_ckb`=本地 sidecar（回退 `withdrawable_ckb`）；`withdrawable_ckb`=`MatchInfo.ckb_capacity/1e8`（xUDT 时 `xudt.amount/1e8`）；`channel_capacity_ckb`=`remaining_capacity_ckb`（耗尽为 0）。前端 `matchLife/rentalDaysForMatch/daysLeft/computeInboundSummary` 按 #2 留前端。
- **`get_orders`**：(a) opticrum-calculator reader 给 `OrderInfo` 增加 `block_number`（消除 `OrderDetail.block_number` 为 0）；(b) new-core-crate 本地 sidecar `outpoint→{rental_days, created_at_ms, deposit_ckb}`（`publish_order` 写入、`get_orders` join、缺失→null 前端隐藏 dwell/rental 徽章）；(c) `deposit_ckb=OrderInfo.ckb_capacity/1e8`、直接透传 `OrderInfo.fiber_address`。
- **撮合（match）**：本 UI 无用户动作，链外撮合，**本轮不设计 match invoke**（sheet 中 order 等待撮合的 pill 为展示态）。

### 4.4 配置层（缺口 #13）

**现状**：config.yml schema 只存在于前端 `mock/fiberConfig.ts`（`defaultNodeConfig` + `serializeConfigYaml`），rust-server 源码零 `serde_yaml`（grep 确认）。`NodeConfigModal` 全字段需 Rust 侧 1:1 结构。

**字段清单**（`NodeConfig` serde 结构）：
- `services[]`
- `fiber{ listening_addr, announced_node_name, bootnode_addrs[], announce_listening_addr, announced_addrs[], chain, standalone_watchtower_rpc_url, disable_built_in_watchtower, watchtower_check_interval_seconds, open_channel_auto_accept_min_ckb_funding_amount, auto_accept_channel_ckb_funding_amount, tlc_expiry_delta, tlc_fee_proportional_millionths, funding_timeout_seconds, max_inbound_peers, min_outbound_peers, sync_network_graph, auto_announce_node, proxy_url }`
- `rpc{ listening_addr, enabled_modules[] }`
- `ckb{ rpc_url, tx_tracing_polling_interval_ms }`
- `scripts[]{ name, script:{ code_hash, hash_type, args }, cell_deps[]{ kind(type_id: code_hash/hash_type/args | cell_dep: out_point:{tx_hash, index}, dep_type) } }`（YAML 中 `code_hash/hash_type/args` 嵌套于 `script:`、`cell_dep` 嵌套于 `out_point:`，与 mock `serializeConfigYaml` 输出一致）
- `udt_whitelist[]{ name, script:{ code_hash, hash_type, args }, cell_deps?: Array<{ kind: type_id | cell_dep, … }>, auto_accept_amount }`（`cell_deps` 可选）

**产出**：`node.get_config`（文件缺失时返回默认）、`node.save_config`（serde_yaml 读写 + 持久化 `fiber.chain` + 派生 watchtower 并返回）。前端 `config Reset = defaultNodeConfig` 为本地回退（无后端）；`RPC_MODULES/SERVICES/HASH_TYPES/SCRIPT_TYPES` 枚举留前端常量（静态 UI 元数据，不进 IPC）；config.yml 体积显示为前端公式（#1.4-11）。

### 4.5 交易动作层（缺口 #5、#6、#9）

**现状**：SDK 覆盖 unsigned skeleton 组装（`build_create_order`/`build_cancel_order`/`build_match_order`/`build_extract_rent`/`build_update_match`/`build_destroy_match`），但不签不发；rust-server 签名器是占位：
- `RealChainProvider.send_transaction` 只对 `'create_order:'`/`'cancel_order:'` 前缀返回伪 hash，真实路径报错（`real_chain_provider.rs:188-206`）
- `HdWalletSigner`/`InternalSigner.sign()` 只对 `'operation:tx_hex'` 字符串做 SHA256 签名（`internal_signer.rs:61-66` 注释确认 placeholder，Phase 6 才接真 CKB 交易）
- rust-server 无 secp256k1_blake160 转账组装

**new-core-crate 新写**：
- **`send_ckb`**：`AddSecp256k1SighashCellDep` + `BalanceTransaction` + cinnabar `balance_and_sign` → send → register → `wait_for_confirmation`（300s 超时，参照 `TransactionAssembler`）；用解锁的 HD child key 真签；`address.rs` 校验 CKB2021 bech32m（ckb/ckt）。前端 Send 表单当前为 readOnly 视觉稿，本轮可先落接口。
- **`get_transactions`（desktop account-history indexer）**：对钱包各 lock_hash `get_cells_by_lock_arg` → `get_transaction` → Rust 内按 `lock_args_len==20`（funding lock）判定 `channel_open`/`channel_close`、channel outpoint 识别、CellOutput 容量差算 signed `amount_ckb`、`get_block_timestamp(block)` 得 `timestamp_ms`；replace mock `wallet.txs`。分类逻辑目前不存在于任何层，为纯新增。
- **liquidity 写操作**：`publish/cancel/inject/withdraw/extract` 包一层 assemble + `balance_and_sign` + send_and_wait（复用 `TransactionAssembler` 模式，300s 确认超时）；`publish_order` 写 sidecar（`rental_days/created_at_ms/deposit_ckb`）；extract 用 `MatchInfo.ckb_capacity/1e8` 计算 `returned_ckb` 返回（toast `lmExtractDeleted` 显示）。注意：extract 仅 `life.isExhausted` 可用（前端 gate）；inject 不设上限（`POSITIVE_INFINITY`），withdraw 封顶 `withdrawableCkb`。

---

## 5. 结论：落地归属

### 5.1 进 opticrum-wallet-core（新写为主，含从 rust-server 移植的调用面）

| 模块 | 内容 |
|---|---|
| **钱包服务** | 从 rust-server 抽出 `services/wallet/{hd_wallet,crypto,keystore,address,wallet_session}` 去 DbPool；子键按 unlock 重派生；`WalletSessionManager` 原样复用（TTL 3600s） |
| **钱包查询** | `get_summary`/`get_addresses`（`get_balance_by_address` 求和 + `/1e8`）；`get_transactions` account-history indexer（新写） |
| **节点管理** | `NodeProcessManager`（spawn/terminate/`started_at_ms`→uptime/running）+ `get_runtime` 组装；环形日志缓冲 + `get_logs`；`node.get_config/save_config`（`NodeConfig` serde_yaml 1:1 + chain/watchtower 持久化） |
| **Fiber 调用面** | 移植 `fiber/rpc_client.rs` + `fiber-json-types`；`channels.list`（`scan_fiber_channels`+`list_peers` 按 `counterparty_fiber_key` 分组）；`connect_peer`/`disconnect_peer`/`open_channel`（temp_id→channel_id 轮询）/`close_channel`；`get_channel_info` 费用补取 |
| **流动性富化服务** | `get_matches`（`get_block_timestamp` block→ms + `ckb_capacity/1e8`）；`get_orders`（透传 `fiber_address` + `ckb_capacity/1e8`）；本地 sidecar `outpoint→{rental_days, created_at_ms, deposit_ckb}` |
| **签名/广播** | `send_ckb` 真签流水线（`AddSecp256k1SighashCellDep`+`BalanceTransaction`+cinnabar `balance_and_sign`+`wait_for_confirmation` 300s）；liquidity 写操作（publish/cancel/inject/withdraw/extract）统一包层，extract 返回 `returned_ckb` |

### 5.2 复用 rust-server（抽离依赖后）

| 复用点 | 抽取要求 |
|---|---|
| `services/wallet/*`（hd_wallet/keystore/crypto/address/wallet_session） | 去 `DbPool`（`wallets` 表）、去 HttpOnly cookie |
| `wallet_service` 余额聚合逻辑（`get_balance_by_address` 循环求和，返回原始 shannons） | 去 DB 绑定 |
| `RealChainProvider.scan_fiber_channels` / `list_peers` / `get_fiber_node_info` | 去 `ChainProvider` trait + DB，移植 fiber RPC 调用面 |
| `ChainProvider` 底层：`get_balance_by_address` / `get_cells_by_lock_arg` / `get_transaction`（TxInputInfo/TxOutputInfo/`lock_args_len`）/ `get_block_timestamp` / `get_tx_block_number`（注意：trait **无** `get_header_by_number`） | 直接复用其链访问实现 |
| `TransactionAssembler` 模式（300s 确认超时、send/register/wait 编排） | 作为签名/广播流水线模板 |
| trait 内已有 `connect_peer`/`open_channel`/`shutdown_channel` 调用面 | 移植调用逻辑 |

### 5.3 复用 SDK / opticrum-calculator

| 复用点 | 说明 |
|---|---|
| `compute_dashboard` → `DashboardData` | `liquidity.get_dashboard` 直接透传（`tip_block, total_orders/total_matches, active/exhausted, capacity locked, avg_yield_bps, yield_distribution, recent_orders/recent_matches`） |
| `get_matches_near_exhaustion` → `MatchDeadline[]` | `find_matches_near_exhaustion` + `sort_by_urgency`，排序在 Rust，前端不重排 |
| `scan_orders` / `scan_matches` | 原始扫描，作为 `get_matches`/`get_orders` 富化服务的底层 |
| `summarize_order` / `summarize_match` + `OrderDetail`/`MatchDetail` | 部分富化复用（`outpoint/channel_capacity_ckb/shannons_per_block/annual_yield_bps/xudt_amount/seller_lock_hash/is_exhausted/health/last_extraction/projected_exhaustion`） |
| `build_*` 系列 | unsigned skeleton 组装（create/cancel/match/extract/update/destroy），作为签名/广播流水线的组装段 |
| **opticrum-calculator reader**：给 `OrderInfo` 增加 `block_number` | 唯一需要在 SDK 上游落的小改动（消除 `OrderDetail.block_number==0`），供 `created_at_ms` 使用。**注意**：SDK 现以 git 依赖消费 calculator（`Opticrum/ckb-contract-script@master`，Cargo.toml:20；本地 path 仅注释 :16-18）——改动需推上游分支或改回 path 依赖才会被 SDK 采纳 |

### 5.4 明确不做（边界与 Phase 2）

- **HTTP 边界**：apps / banners / news / changelogs 走远程目录 fetch，不设计 command（仅前端数据结构，见 §1.3）。
- **前端公式**：§1.4 全部 30 项公式留前端 lib（自 `mock/liquidity.ts` 等迁移；当前仍位于 mock/ 与组件内，接入 IPC 时迁到 lib），不在 IPC 中重算。
- **撮合（match）**：链外撮合，本轮不设计 match invoke。
- **Phase 2 实时事件**：tip 高度、`node.log_line` 日志流、余额变化、匹配寿命推进、channel-state 推送——仅标注，不展开设计。
- **可选不阻塞**：`fiat_usd` 外部价格源（本轮前端消费 `None` 路径）、`channels.list` 的 `base_fee_mshannons/fee_rate_ppm` 补取（不可用返回 `None`）、fiber fee-at-open 参数（不支持则文档标注 no-op）。