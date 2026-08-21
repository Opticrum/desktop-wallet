# Opticrum 桌面 IPC 接口文档

> 版本：v1.1（修订 · 2026-08-11 对齐代码基线，经全量审计通过）· 适用范围：Opticrum Desktop（Tauri 壳 + `app/` React SPA）
> 状态：本轮仅设计**命令式请求/响应**查询与动作；实时事件推送列为 **Phase 2**（见 §7），不展开设计。
> 配套文档：[sdk-coverage-gap.md](./sdk-coverage-gap.md)（以 wallet 渲染数据为基线的 SDK 覆盖缺口分析）
> 注：运行时 mock 层（前端 `browserMock` + core `MockBackend`/`mock_data`）已移除，所有命令由 `opticrum-wallet-core` 真实后端实现。文中「替换 mock `X`」等历史注解指向已删除的 mock，仅作迁移背景保留。

---

## 1. 背景与目标

Opticrum Desktop 是一个 Tauri 壳包住的 React SPA：前端负责**渲染 + 保留纯公式**，Rust 侧（`opticrum-wallet-core`）负责**链上取数、聚合与动作（签名/广播）**。本文件的目的是把前端与 Rust 之间的 IPC 命令面固定下来，作为前后端并行开发的契约。

两条核心分工原则（设计决策 #1、#2）：

1. **计算边界**：Rust 只返回 SDK 聚合类型 + 链上原始字段。所有纯展示 / 纯数学公式——APY bps 换算、matchLife 剩余寿命百分比、dwell 时长、入站汇总 `computeInboundSummary`、通道/订单/匹配的各类求和与切片——**一律留在前端**（从 `mock/liquidity.ts` 迁到前端 lib），不在 IPC 中重新计算返回。
2. **取数模式**：本轮只有命令式查询。tip 高度、日志流、余额变化、匹配寿命推进等实时数据全部标注为 Phase 2 事件，不在本轮实现（见 §7）。

取数/动作职责对照：

| 层 | 职责 | 示例 |
|---|---|---|
| Rust（opticrum-wallet-core） | 链上取数、SDK 聚合、分组、交易分类、签名、广播、配置读写、子进程管理 | `scan_fiber_channels`、`compute_dashboard`、`build_create_order`、`unlock_keystore`、`get_fiber_node_info` |
| 前端（React SPA） | 只渲染、纯公式、本地状态（theme/locale/clipboard/QR）、保存前 badge 启发式 | `shannonsPerBlockToApyBps`、`matchLife`、`computeInboundSummary`、`detectChainFromRpc` |

---

## 2. 通信边界

### 2.1 边界图

```
                         Opticrum 桌面应用（Tauri 壳）
┌───────────────────────────────────────────────────────────────────────┐
│                                                                       │
│   前端 React SPA (app/)                                              │
│   ├─ 渲染层：只消费命令返回，不重算链上语义                            │
│   ├─ 公式层：APY bps 换算 / matchLife / dwell / computeInboundSummary │
│   └─ 本地层：theme / locale / clipboard / QR / defaultNodeConfig 重置 │
│                    │  invoke (async Promise)                          │
│                    ▼                                                  │
│  ┌───────────────────────────────────────────────┐                   │
│  │ ① Tauri IPC 域（本文件命令全集，见 §4）          │                   │
│  │    wallet · node · channels · liquidity        │                   │
│  │    opticrum-wallet-core：链上取数/聚合/动作    │                   │
│  └───────────────────────────────────────────────┘                   │
│                    │ ③ Phase 2：事件订阅（见 §7）                     │
│                    ▼                                                  │
│  ┌───────────────────────────────────────────────┐                   │
│  │  事件流：tip_changed / log_line / balance_…    │                   │
│  └───────────────────────────────────────────────┘                   │
│                                                                       │
│  ② fetch HTTP 域（市场内容，不设计 command）                           │
│    ↓ https://…/directory/{apps,banners,news,changelogs}.json          │
│   应用市场内容型数据（TopBar 的 apps.length 来自此处，非 IPC）         │
└───────────────────────────────────────────────────────────────────────┘
                    │ RPC / indexer
                    ▼
        Fiber 节点进程 · CKB 链 · opticrum-calculator SDK
```

### 2.2 三个边界的划分

| 边界 | 内容 | 传输 | 是否设计 command |
|---|---|---|---|
| **① invoke IPC 域** | 钱包（解锁/密钥/余额/交易流）、节点（运行时/日志/配置）、通道（对端/通道/费用）、流动性市场（订单/匹配/仪表盘/动作） | Tauri `invoke` | **是**（§4 全量列出） |
| **② fetch HTTP 域** | 应用市场内容型数据：`apps` / `banners` / `news` / `changelogs` | 远程目录 HTTP fetch | **否** —— 纯内容型数据，独立 fetch 模块承载；TopBar `apps.length` 取自此处；IPC 只参与其中非内容型的 `channelsSummary` / `total_matches` |
| **③ Phase 2 事件域** | 实时推送：tip 高度、日志流、运行状态、余额变化、新交易、订单/匹配状态推进、租金提取、通道状态 | Tauri event 订阅 | **否** —— 仅预告，见 §7 |

边界补充说明：

- **match 动作有意不设计**：Order→Match 是链上带外转换，不在 IPC 面内提供 `match_*` 动作命令。
- **本地动作无命令**：copy-to-clipboard、QR 渲染、配置 Reset（`defaultNodeConfig`）、theme/locale 切换、`detectChainFromRpc` 启发式、dwell/入站 APY 汇总等纯本地逻辑，不设命令。

---

## 3. 通用约定

### 3.1 命令命名

- 命令格式为 `<domain>.<verb>`（snake_case）。域：`wallet`、`node`、`channels`、`liquidity`。
- **查询动词**：`get_*` / `list`；**动作动词**：`send` / `unlock` / `lock` / `create` / `import` / `derive` / `start` / `stop` / `save` / `connect` / `disconnect` / `open` / `close` / `publish` / `cancel` / `inject` / `withdraw` / `extract`。
- **Tauri wire 名**：Rust 命令以函数名注册（`wallet_get_summary`，下划线，Rust 标识符不允许点号）；前端 `app/src/api/transport.ts` 把文档的 `<domain>.<verb>` 名称映射为 `<domain>_<verb>` 后再 `invoke`。§4 命令表中点号为**语义命令名**，wire 名 = 点号 → 下划线。

### 3.2 序列化（serde）

- JSON 由 Tauri 经 `serde_json` 传输。
- **应用级 wire type**：PascalCase，JSON 字段 camelCase（`#[serde(rename_all = "camelCase")]`）。
- **SDK 原生聚合**（`DashboardData` / `OrderSummary` / `MatchSummary` / `MatchDeadline` / `MatchHealth` / `YieldDistribution`）保留 SDK 自身的 snake_case 字段名；**只有 `liquidity.get_dashboard` 与 `liquidity.get_matches_near_exhaustion` 会裸返回它们**，前端为这两个命令保留一个薄 mapper。
  - **`NodeConfig` 例外**：它是 config.yml 的 1:1 往返结构，字段名与 config.yml 键一致（snake_case 为主），**不适用**本条 camelCase 规则（详见 §5）。
- 数值约定：
  - **读返回**：携带已预换算的 `*_ckb`（Rust 端 shannons/1e8）**以及**原始 `*_shannons`（有用处时）。
  - **写参数**：一律收 shannons（`u64`）；前端 lib 在入参方向做 CKB→shannons（×1e8）换算（依据 opticrum-calculator 约定：“frontend converts CKB→shannons when calling create/update”）。
  - `u128`（如 `xudt_amount`）在 serde_json 中序列化为**字符串**。
- `MatchHealth` 枚举：`'healthy' | 'warning' | 'critical' | 'exhausted'`。

### 3.3 错误模型

- 所有命令返回 `Result<T, CommandError>`。
- `CommandError` 是 serde-tagged 枚举，前端按 `{ code, message }` switch：变体与 `SdkError` 一一对应（`Chain`、`Scan`、`Build`、`InvalidInput`、`AlreadyExhausted`、`NotExhausted`、`NotAuthorized`、**`WithdrawWindowExpired`、`HesitationNotElapsed`、`PartialWithdrawNotAllowed`、`InjectDuringHesitation`** —— 后四个为犹豫期窗口错误码），外加应用级变体：`WalletLocked`、`NodeNotRunning`、`Node`、`InsufficientFunds`、`AlreadyExists`、`Config{message}`、`Io{path, message}`、`Internal{message}`。
- 桌面端负责把 rust-server 的 `AppError` 映射到上述变体。
- **状态即数据，不是错误**：`unlocked=false`、`running=false` 是正常状态字段，不当作错误抛出。

### 3.4 异步与并发

- 全部命令在 Tauri 异步运行时（tokio）上异步执行；RPC / indexer / scan / 区块时间戳调用均为 async。
- 复用 `ChainCache` + `CachedChainProvider` 做快照缓存，替代唯一的 actix 耦合：`actix_rt::spawn` → `tokio::spawn`，`actix_rt::time::sleep` → `tokio::time`。
- 阻塞性 FS（config.yml YAML、keystore 文件 IO、日志缓冲读取）走 `spawn_blocking`。
- 写命令（签名+广播）按 TransactionAssembler 风格等待确认：`send` → `register pending` → `wait_for_confirmation`（`confirm_count`，300s 超时）。
- 真实签名走 `TransactionAssembler::balance_and_sign`，**不**使用占位用的 `HdWalletSigner` / `InternalSigner::sign()`。

### 3.5 返回类型标注（用于 §4 表格）

| 标注 | 含义 |
|---|---|
| **新 wire type** | PascalCase 类型，camelCase JSON 字段（§5 定义） |
| **SDK 聚合（snake_case）** | 裸返回 SDK 原生类型，字段为 snake_case，前端需薄 mapper |
| **内联对象 / 裸类型** | 命令自身定义的小型返回，无独立 wire type |

---

## 4. 命令总览（按域分组）

### 4.0 命令索引

| 域 | 命令 |
|---|---|
| wallet | `get_summary` `get_status` `get_addresses` `get_transactions` `unlock` `lock` `create_hd_wallet` `import_mnemonic` `import_private_key` `derive_addresses` `send_ckb` |
| node | `get_runtime` `start` `stop` `get_logs` `get_config` `save_config` `fnn_cli_status` `fnn_cli_open` `open_url` |
| channels | `list` `connect_peer` `disconnect_peer` `open_channel` `close_channel` |
| liquidity | `get_dashboard` `get_orders` `refresh_orders` `get_matches` `get_matches_near_exhaustion` `publish_order` `cancel_order` `inject_deposit` `withdraw_deposit` `extract_spent_match` |
| app | `set_locale` `exit` |

### 4.1 wallet 域

| 命令 | 参数 | 返回 | 错误 | 说明 |
|---|---|---|---|---|
| `wallet.get_summary` | 无 | `WalletSummary`（新 wire type） | `Chain` | `WalletService.get_hd_wallet_balance` + `WalletSessionManager.status` + address.rs 当前 HD 地址（hrp 随 chain）。`unlocked=false` 是状态字段、非错误；`has_wallet=false`（首次运行，尚无 keystore）时前端进入创建/导入流程。`fiat_usd` 来自可选价格源（`None` → 前端隐藏 USD 行；替换 mock 的 `wallet.fiatUsd`）。`*_ckb` 已在 Rust 端由 shannons/1e8 预换算。余额查询带 3s 超时（`total_balance_shannons`），慢/不可达 RPC 快速返回 0，不让 `get_summary` 阻塞。 |
| `wallet.get_status` | 无 | `WalletStatus`（新 wire type）：`{ has_wallet, unlocked, address }` | 无 | **快速本地状态**（keystore 存在性 + 会话解锁 + keyring 首地址），**不做任何链上查询**。前端 `WalletModule` 用它在加载瞬间渲染解锁表单，不等待 `get_summary` 的余额查询/交易回溯。 |
| `wallet.get_addresses` | 无 | `Vec<WalletAddress>`（新 wire type） | `Chain` | `get_hd_wallet_address_balances`；`lock_hash = script_lock_hash(lock_arg)` hex（address.rs，32 字节 blake2b-256 Molecule script hash；`blake160` 仅生成 20 字节 lock_arg），作为 `channels.list` 的 `owner_lock_hash` 参数。 |
| `wallet.get_transactions` | `limit?: u32`、`offset?: u32` | `Vec<WalletTx>`（新 wire type） | `Chain`、`Scan` | 桌面账户历史索引器：每钱包地址构建 secp256k1_blake160 lock script → indexer `get_transactions`（`script_type: Lock`，地址出现在输入或输出均命中）→ 每 tx 经缓存 `get_transaction` 取完整 I/O → Rust 端分类 `kind`：钱包地址净 capacity 增量定 receive/send；**输出含配置的 FundingLock 合约 → `channel_open`；输入花费任一配置 fiber 合约 cell（FundingLock/CommitmentLock/…）→ `channel_close`**（合约 code_hash 命中 `config.scripts[]`，去 `0x` 前缀归一化）；**输出含 Opticrum 订单 cell → `rent_pledge`；输入花费 Opticrum match cell → `rent_extract`**（Opticrum 锁 code_hash = 部署合约 type script `(TYPE_ID, Type, opticrum_contract_type_id)` 的 script hash；订单/匹配按 lock args 长度 65/133 区分；`opticrum_contract_type_id` 当前仅实现 testnet，主网暂不分类）。前端保留 `typeCounts` 归约 + `activeTypes` 过滤 + `shortHash`/`truncatedHash`（公式，设计决策 #2）。 |
| `wallet.unlock` | `password: string`、`label?: string` | `WalletSummary`（新 wire type，`unlocked=true`） | `NotAuthorized`（密码错误）、`Io`、`Chain` | `unlock_keystore`（AES-256-GCM 解密）+ `WalletSessionManager.create` —— RAM-only 会话，TTL 3600s 滑动。`label` 用于多 keystore 时选钱包。错误码 `not_authorized` 供前端本地化（`lib/errors.ts`）。 |
| `wallet.lock` | 无 | `null` | 无 | `SessionManager.clear()`；前端本地翻转 `unlocked=false`，无需重新拉取。 |
| `wallet.create_hd_wallet` | `label: string`、`password: string`、`address_count: u32` | `{ mnemonic, address, addresses }`（内联） | `AlreadyExists`、`Io`、`InvalidInput` | `WalletService.create_hd_wallet` —— BIP39 12 词助记词，BIP32 派生路径 `m/44'/309'/0'/0/N`（coin 309 = CKB）。`mnemonic` 仅返回一次用于备份；前端展示后必须丢弃，永不写入日志。 |
| `wallet.import_mnemonic` | `mnemonic: string`、`password: string`、`label: string` | `WalletSummary`（新 wire type） | `InvalidInput`、`Io` | `import_hd_from_mnemonic`。 |
| `wallet.import_private_key` | `private_key_hex: string`、`password: string`、`label: string` | `WalletSummary`（新 wire type） | `InvalidInput`、`Io` | `import_wallet`（hex 私钥 → `WalletRecord`，`wallet_type='imported'`）。 |
| `wallet.derive_addresses` | `count: u32` | `Vec<string>`（裸类型，新地址） | `WalletLocked`、`InvalidInput` | `derive_more_addresses`；需要已解锁会话（未解锁 → `WalletLocked`）。 |
| `wallet.send_ckb` | `address: string`（收款 CKB 地址）、`amount_shannons: u64`（前端 CKB→shannons ×1e8） | `{ tx_hash }`（内联） | `WalletLocked`、`InvalidInput`（地址非法 / 金额 ≤ 0）、`InsufficientFunds`、`Build`、`Chain` | secp256k1_blake160 锁 CKB 转账：装配 + 用已解锁密钥签名 + 广播。**桌面后端必须实现真实转账** —— rust-server 的 `RealChainProvider.send_transaction` 仅为占位（`'create_order:/cancel_order:/…'` 前缀）；复用 TransactionAssembler 风格 `balance_and_sign` + `send_registered_and_wait`。address.rs 校验 CKB2021 bech32m（ckb/ckt）。 |

### 4.2 node 域

| 命令 | 参数 | 返回 | 错误 | 说明 |
|---|---|---|---|---|
| `node.get_runtime` | 无 | `NodeRuntime`（新 wire type） | `Chain` | `get_fiber_node_info`（`node_info` RPC：pubkey、name、addresses、version、commit_hash；通道/待定/对端计数从 hex 字符串解析）+ 桌面子进程状态（`running`、`started_at_ms = process_start_ts`（unix 毫秒，停止为 `null`）、`uptime_hours = (now − process_start_ts)/3600` 派生，停止为 0）+ 持久化 chain + watchtower 从配置派生（`standalone_watchtower_rpc_url` → standalone；否则 `disable_built_in_watchtower` → disabled；否则 builtin）。`chain` 权威来源是持久化的 `config.fiber.chain`（保存时经 `setChain`）；前端 `detectChainFromRpc` 仅保留为保存前 badge 启发式（设计决策 #2）。**watchtower 值迁移**：mock/UI 现用 `'local'\|'remote'`（`NodeControlPanel` 以 `wt-${mode}` + `watchtowerLocal/Remote` 渲染），接入 wire 后须映射 `'remote'→'standalone'`、`'local'→'builtin'\|'disabled'`（按配置派生），i18n 键同步调整。 |
| `node.start` | `config?: NodeConfig` | `NodeRuntime`（新 wire type） | `Node`、`Config` | 派生节点子进程（配置从磁盘或传入的 `NodeConfig`）；`running=true`；stdout/stderr 捕获进日志环形缓冲。已运行时幂等。 |
| `node.stop` | 无 | `null` | 无 | 终止子进程；`running=false`。已停止时幂等（不报错）。前端 toast `nodeStopped`。 |
| `node.get_logs` | `level?: 'INFO'\|'WARN'\|'ERROR'`、`since_ts_ms?: u64`、`limit?: u32` | `Vec<NodeLog>`（新 wire type） | `Node` | 对桌面捕获的节点 stdout/stderr 环形缓冲做拉取查询（实时流 = Phase 2 `node.log_line`）。前端派生 `stats{INFO,WARN,ERROR}` 计数（公式）+ locale 感知的时间戳格式化（公式）+ 等级过滤 chips（本地）。 |
| `node.get_config` | 无 | `NodeConfig`（新 wire type，完整 config.yml：`services[]`、`fiber{…}`、`rpc{…}`、`ckb{…}`、`scripts[]`、`udt_whitelist[]`）—— 与 `NodeConfigModal` 表单 1:1 | `Config`、`Io` | serde_yaml 解析当前 config.yml（无文件时用默认值）。`scripts` / `udt_whitelist` / `cell_deps` 为可编辑数组。`RPC_MODULES` / `SERVICES` / `HASH_TYPES` 枚举选项列表保持为前端常量（静态 UI 元数据，非链数据，不返回）。 |
| `node.save_config` | `config: NodeConfig` | `{ chain, watchtower }`（内联） | `Config`、`Io`、`Node` | 序列化 + 写 config.yml + 应用（运行时重载/重启）；持久化 `setChain(config.fiber.chain)`；由 `standalone_watchtower_rpc_url` + `disable_built_in_watchtower` 计算 watchtower mode 并持久化。返回**已应用**的 `chain` + `watchtower`，使 `NodeContext` badge 免重新拉取。 |
| `node.fnn_cli_status` | 无 | `FnnCliStatus`（新 wire type） | 无 | 检测本地是否安装 `fnn-cli`（PATH 探测，POSIX `command -v` / Windows `where`）。`install_url` 为安装文档链接，前端在未安装时跳转。OS 集成在 `src-tauri/src/fnn_cli.rs`（shell crate），非 core。 |
| `node.fnn_cli_open` | `url: string`（RPC URL，`node.get_config` 的 `rpc.listening_addr` 派生，前端公式 `fiberRpcUrl`） | `null` | `Io` | 打开终端窗口运行 `fnn-cli -u <url>` 并保持会话（macOS Terminal.app via osascript；Linux `x-terminal-emulator`；Windows `cmd /k`）。 |
| `node.open_url` | `url: string` | `null` | `Io` | 用系统默认浏览器打开 URL（`open` / `xdg-open` / `start`）。fnn-cli 未安装时的安装引导跳转。 |

### 4.3 channels 域

| 命令 | 参数 | 返回 | 错误 | 说明 |
|---|---|---|---|---|
| `channels.list` | 无 | `ChannelList`（新 wire type，含 `ChannelNode`/`Channel`） | `Chain`、`NodeNotRunning` | `scan_fiber_channels(owner_lock_hash = 当前钱包 lock_hash)` + `list_peers`，Rust 端按 `counterparty_fiber_key` 分组。**注意**：rust-server 现有 `scan_fiber_channels` 忽略 `owner_lock_hash` 且传 `include_closed: true`（real_chain_provider.rs:331），返回全部含 Closed——core 层需自行按 owner 过滤、并决定 Closed 通道是否进 `ChannelList`（§6 的 active/pending/closing 桶无 Closed 落点）。`Channel` 携带 `*_ckb`（预换算）+ `*_shannons`（原始）。前端派生 `nodeOutboundCkb`/`nodeInboundCkb` 求和 + KPI outbound/inbound/node/channel 计数（公式，设计决策 #2 —— IPC 只返回原始余额）。`alias` 尽力取自 peer list / `announced_node_name`。 |
| `channels.connect_peer` | `addr: string`、`pubkey?: string`、`alias?: string` | `{ peer_id }`（内联） | `Chain`、`InvalidInput`、`NodeNotRunning` | `connect_peer(pubkey, Some(addr))`；`pubkey` 省略时从 addr 的 `/p2p/` 段解析。`alias` 存为本地标签（尽力而为，不上链）。前端 “Create connection” 表单把 alias+addr 输入映射到此。 |
| `channels.disconnect_peer` | `peer_id: string` | `null` | `Chain`、`NodeNotRunning` | Fiber RPC `disconnect_peer` —— 不在 rust-server 的 `ChainProvider` trait 中；桌面后端经 vendored 通用 fiber rpc_client（`call_fiber_no_params`）补充。前端 `ConfirmModal` 确认后 invoke。 |
| `channels.open_channel` | `peer_id: string`、`capacity_shannons: u64`（前端 CKB→shannons ×1e8）、`base_fee_mshannons?: u64`、`fee_rate_ppm?: u64` | `{ temp_id, channel_id?: string }`（内联） | `Chain`、`InvalidInput`、`InsufficientFunds`、`NodeNotRunning` | `open_channel(pubkey, capacity_shannons, addr)` → `temp_id`，轮询得 `channel_id`。fee 参数若 fiber 支持开通道即付则透传，否则开通道后经 update 应用（可能 no-op —— 已记录缺口；mock 有 `baseFeeMshannons`/`feeRatePpm` 但今日未渲染）。 |
| `channels.close_channel` | `channel_id: string`、`force: bool` | `null` | `Chain`、`InvalidInput`、`NodeNotRunning` | `shutdown_channel(channel_id, force)`。前端 `ConfirmModal` 确认后 invoke；状态转换 `ShuttingDown → Closed`。 |

### 4.4 liquidity 域

| 命令 | 参数 | 返回 | 错误 | 说明 |
|---|---|---|---|---|
| `liquidity.get_dashboard` | 无 | `DashboardData`（**SDK 聚合，snake_case**）：`{ tip_block, total_orders, total_matches, active_matches, exhausted_matches, total_capacity_locked_shannons, total_orders_capacity_shannons, avg_shannons_per_block, avg_annual_yield_bps, matches_near_exhaustion, recent_orders: OrderSummary[], recent_matches: MatchSummary[], yield_distribution }` | `Chain`、`Scan` | `compute_dashboard`（tip + `scan_orders` + `scan_matches`）—— 顶级市场 KPI（TopBar `total_matches` + 节点页市场 KPI + 收益分布）。`avg_annual_yield_bps` 已是 bps，前端直接渲染。仅有的 snake_case 返回命令之一；前端保留薄 mapper。 |
| `liquidity.get_orders` | `scope?: 'mine'\|'all'`（默认 `'mine'`） | `Vec<LiquidityOrder>`（新 wire type） | `Chain`、`Scan` | `scan_orders(fiber_pubkey = 当前节点 pubkey 当 'mine')` + `summarize_order`；`deposit_ckb = OrderInfo.ckb_capacity/1e8`（真实租金容量）。`rental_days` + `created_at_ms` 来自桌面本地 sidecar（`publish_order` 时写入，按 outpoint 键）—— 为 `null` 说明订单早于本地跟踪 → dwell/rental 徽章隐藏。`status` 恒为 `'open'`：已匹配/已取消订单链下消耗、不返回（前端取消后本地过滤掉）。前端计算 `totalDemand`/`avgApy`/`pending`/`avgDwell`/`sharePct`（公式，设计决策 #2）。**个人订单缓存**（`'mine'`）：订单 outpoint 不可变，首次 scan 后把完整 `LiquidityOrder`（wire JSON）写入 `cached_orders` 表并按 outpoint 键缓存；后续 `get_orders('mine')` 纯读缓存（不碰链），直到用户点刷新。 |
| `liquidity.refresh_orders` | 无 | `Vec<LiquidityOrder>`（新 wire type） | `Chain`、`Scan` | 重新 `scan_orders` + 个人订单过滤 → **整表替换** `cached_orders` + 标记 primed → 返回新鲜列表。唯一触发链上重新检索个人订单的途径（普通加载走缓存）。失败返回空且不动缓存（离线时缓存仍可读）。 |
| `liquidity.get_matches` | `scope?: 'mine'\|'all'`（默认 `'mine'`） | `Vec<LiquidityMatch>`（新 wire type） | `Chain`、`Scan` | `scan_matches` + `summarize_match`/`get_match_detail`。`'mine'` = 钱包作为参与方的匹配：买方视角 `order_args.buyer_lock_hash == 当前钱包 lock hash`（与 mockup buyer-centric 基线一致，`depositCkb`/`withdrawableCkb` 均为买方语义）；若钱包节点同时作为流动性提供方，`seller_lock_hash == 钱包 lock hash` 的匹配也计入。`created_at_ms = get_block_timestamp(match_current_block)`（即 MatchDetail/MatchDeadline 的 `match_creation_block`，取自 `MatchInfo.match_current_block`）；`expires_at_ms = get_block_timestamp(projected_exhaustion_block)`（`shannons_per_block==0` 永不耗尽时为 `u64::MAX`）。`channel_capacity_ckb = remaining_capacity_ckb`（耗尽时为 0）。`deposit_ckb` 来自本地 sidecar，回退 `withdrawable_ckb`。前端由 `created_at_ms`/`expires_at_ms` + 原始字段计算 `matchLife`/`rentalDaysForMatch`/`daysLeft`/`computeInboundSummary`/donut slices（`OverviewChart`；`splitPct` 为池级汇总，见 §6）（公式，设计决策 #2）。 |
| `liquidity.get_matches_near_exhaustion` | `blocks_threshold: u64`（`50400` = 7 天） | `Vec<MatchDeadline>`（**SDK 聚合，snake_case**）：`{ match_outpoint, channel_outpoint, shannons_per_block, remaining_capacity_ckb, last_extraction_block, match_creation_block, projected_exhaustion_block, blocks_remaining, estimated_hours_remaining, health, extractable_now_ckb }` —— 按紧急性排序（`sort_by_urgency`，最紧急在前） | `Chain`、`Scan` | `find_matches_near_exhaustion` + `sort_by_urgency`（**Rust 端排序，前端不重排**）。驱动临近耗尽警告列表。注意：SDK `find_matches_near_exhaustion` 会把已耗尽（`blocks_remaining==0`）也计入并排在最前，命令应先过滤 `is_exhausted`。已耗尽匹配由 `get_matches` 的 `is_exhausted` 过滤覆盖，故不单独设 `get_exhausted_matches` 命令（SDK 内部另有 `find_exhausted_matches` 可用）。 |
| `liquidity.publish_order` | `capacity_shannons: u64`（前端 CKB→shannons）、`shannons_per_block: u64`、`rent_capacity_shannons: u64`（押金）、`rental_days: u32`、`fiber_address?: string` | `{ order_outpoint, tx_hash }`（内联） | `WalletLocked`、`InvalidInput`、`Build`、`Chain` | `build_create_order`（buyer, `order_args(fiber_pubkey, buyer_lock_hash)`, `order_data(shannons_per_block, channel_capacity)`, `rent_capacity`, `fiber_address`）+ 签名 + 广播；`outpoint = tx_hash:index`。后端记录本地 sidecar `{ outpoint → rental_days, created_at_ms, deposit_ckb }`。前端实时 APY 估算（`shannonsPerBlockToApyBps`）**不传入** —— 只传 `shannons_per_block` + `capacity`（设计决策 #2）。 |
| `liquidity.cancel_order` | `outpoint: string` | `{ tx_hash }`（内联） | `WalletLocked`、`NotAuthorized`（订单非当前 buyer 所有）、`Build`、`Chain` | `build_cancel_order`（buyer，按 outpoint 找 `order_info`）Burn 模式 + 签名 + 广播。前端本地标记该 cell 已取消并从池中过滤（spent/hidden）+ toast `lmOrderRevoked`。 |
| `liquidity.inject_deposit` | `match_outpoint: string`、`amount_shannons: u64`（前端 CKB→shannons） | `{ tx_hash }`（内联） | `WalletLocked`、`NotAuthorized`、**`InjectDuringHesitation`**（窗口内 SDK 拒绝）、`Build`、`Chain` | `build_update_match`（buyer, `match_info`, `new_xudt_amount`, `capacity_delta=+amount`）。**犹豫期内（`last_extraction_block==0 && tip−match_creation_block ≤ 3600`）SDK 返回 `InjectDuringHesitation`**，前端据此禁用注入按钮并提示。前端乐观地把 `depositCkb` 平移同 delta，随后重拉 `get_matches` 取权威状态。 |
| `liquidity.withdraw_deposit` | `match_outpoint: string`、`amount_shannons: u64`（前端传全额，CKB→shannons；**后端忽略金额、强制全额 dump**） | `{ tx_hash }`（内联） | `WalletLocked`、`NotAuthorized`、**`WithdrawWindowExpired`**（窗口已过）、**`PartialWithdrawNotAllowed`**（非全额）、`Build`、`Chain` | `build_update_match`，`capacity_delta=−match_info.ckb_capacity`、`new_xudt=0`（**全额提取 = 放弃订单**，SDK 在窗口内才放行）。前端在犹豫期内提供「放弃订单并提取全部租金」直接二次确认（不走金额弹窗）；确认后乐观移除该 match 并重拉。 |
| `liquidity.extract_spent_match` | `match_outpoint: string` | `{ tx_hash, returned_ckb }`（内联） | `WalletLocked`、`NotAuthorized`、`NotExhausted`（SdkError，仍有剩余 CKB）、`Build`、`Chain` | `build_destroy_match`（seller, `match_info`, `tip_block`）—— 守卫 `!is_exhausted` → `SdkError::NotExhausted`。`returned_ckb` = 扫回 seller 的剩余价值（前端 toast `lmExtractDeleted` 展示）；若抽取的匹配正被选中，则关闭打开中的 drawer。 |

### 4.5 app 域（host / 托盘，shell 层，非 core）

| 命令 | 参数 | 返回 | 错误 | 说明 |
|---|---|---|---|---|
| `app.set_locale` | `locale: string`（`'zh'`\|`'en'`） | `null` | 无 | 前端 locale 变化时同步到 shell，用于重建**系统托盘菜单文案**（原生菜单不在 React 树，双语查表在 `src-tauri/src/tray.rs`）。浏览器 dev 下 no-op。 |
| `app.exit` | 无 | `null` | 无 | 真正退出（`AppHandle::exit(0)`）—— 由前端在托盘「退出」风险提示确认后调用；不触发窗口 `CloseRequested`，故不被 hide-to-tray 拦截。 |

> 托盘行为（`src-tauri/src/tray.rs`）：窗口关闭按钮 → `prevent_close` + `hide()`（后台常驻，fiber 节点/瞭望塔保持可达）；托盘菜单显示节点/瞭望塔运行状态（5s 轮询）+ 显示/退出；「退出」→ 显示窗口 + `emit('tray-exit-requested')` → 前端 ConfirmModal 风险提示 → 确认后 `app.exit`。

---

## 5. Wire Type 定义

> 以下为应用级新 wire type（camelCase JSON，`#[serde(rename_all="camelCase")]`）。`DashboardData` / `MatchDeadline` / `OrderSummary` / `MatchSummary` / `MatchHealth` / `YieldDistribution` 为 SDK 原生类型，字段名 snake_case，不在此重复定义。

| Wire Type | 字段形状 | 来源 / 说明 |
|---|---|---|
| `WalletSummary` | `{ has_wallet: bool, unlocked: bool, address: string, available_ckb: f64, total_ckb: f64, locked_ckb: f64, fiat_usd: Option<f64>, chain: 'mainnet'\|'testnet' }` | `WalletService.get_hd_wallet_balance`（available/total/locked，Rust 端 shannons/1e8）+ `WalletSessionManager.status`（unlocked）+ address.rs 当前 HD 地址（hrp 随 chain）。`has_wallet`（本地 keystore 是否存在）区分首次运行三态：无钱包 → 创建/导入；有钱包未解锁 → 输入密码；已解锁。`fiat_usd: Option<f64>` 来自可选价格源（外部，不在 SDK 中；`None` 隐藏 USD 行；替换 mock `wallet.fiatUsd`）。余额查询 3s 超时。 |
| `WalletStatus` | `{ has_wallet: bool, unlocked: bool, address: string }` | `get_status` —— 仅本地（keystore 存在性 + 会话解锁 + keyring 首地址），无链上查询。前端用它即时渲染解锁表单，不等 `get_summary` 的余额/交易。 |
| `WalletAddress` | `{ address: string, lock_hash: string }` | `get_hd_wallet_address_balances`；`lock_hash = script_lock_hash(lock_arg)` hex（address.rs：32 字节 blake2b-256 Molecule script hash；`blake160` 仅生成 20 字节 lock_arg）。`lock_hash` 即 `channels.list` 消费的 `owner_lock_hash`。 |
| `WalletTx` | `{ id: string, kind: 'receive'\|'send'\|'channel_open'\|'channel_close'\|'rent_pledge'\|'rent_extract', amount_ckb: f64（有符号：+receive/inbound，−send/outbound）, timestamp_ms: u64, tx_hash: string }` | 新桌面账户历史索引器：钱包 lock script → indexer `get_transactions` → 每 tx 缓存 `get_transaction` → Rust 端分类 `kind`。默认按钱包地址净 capacity 增量定 receive/send；**输出含配置的 FundingLock 合约 → `channel_open`；输入花费任一配置 fiber 合约 cell → `channel_close`**（合约 code_hash 命中 `config.scripts[]`，归一化去 `0x`）；**输出含 Opticrum 订单 cell → `rent_pledge`；输入花费 Opticrum match cell → `rent_extract`**（Opticrum 锁 code_hash = `(TYPE_ID, Type, opticrum_contract_type_id)` type script 的 script hash；订单/匹配按 lock args 65/133 区分；当前仅 testnet）。`amount` 由 CellOutput capacity 增量得出（有符号）；`timestamp_ms = get_block_timestamp`（区块头 ts 即 ms）。替换 mock `wallet.txs`。 |
| `NodeRuntime` | `{ running: bool, alias: Option<string>, started_at_ms: Option<u64>, uptime_hours: u32, fiber_pubkey: string, fiber_addr: Option<string>, addresses: string[], chain: 'mainnet'\|'testnet', version: Option<string>, commit_hash: Option<string>, peers_count: u32, channel_count: u32, pending_channel_count: u32, watchtower: { mode: 'builtin'\|'standalone'\|'disabled', endpoint: Option<string> } }` | `FiberNodeInfo`（`node_info` RPC：version、commit_hash、pubkey→fiber_pubkey、node_name→alias、addresses、chain_hash；channel/pending/peers 计数为 `'0x'` hex 字符串解析为 u32）+ 桌面子进程状态（`running`、`started_at_ms = process_start_ts`（unix 毫秒，停止为 `null`）、`uptime_hours = (now − process_start_ts)/3600` 派生，停止时为 0）+ 持久化配置 chain（`setChain`）+ watchtower 从配置派生（`standalone_watchtower_rpc_url`→standalone；否则 `disable_built_in_watchtower`→disabled；否则 builtin；endpoint = 该 URL）。替换 mock `nodeRuntime` + `nodeWatchtower`。mock 遗留字段 `tipHeight`/`peers`/`cpuPercent`/`memPercent`/`synced` 当前未渲染：`tipHeight` 归 Phase 2 `node.tip_changed`；其余无替代，建议从 mock 删除（不进 wire）。watchtower 值迁移见 §4.2。 |
| `NodeLog` | `{ ts_ms: u64, level: 'INFO'\|'WARN'\|'ERROR', msg: string }` | 桌面环形缓冲（后端所有），捕获节点子进程 stdout/stderr；`level` 归一到 INFO/WARN/ERROR。替换 mock node.ts logs。前端计算 `stats{INFO,WARN,ERROR}` 计数（公式）。 |
| `FnnCliStatus` | `{ installed: bool, install_url: string }` | 桌面 shell 探测 PATH（`command -v fnn-cli`，Windows `where`）+ 常量安装文档 URL。`install_url` camelCase 为 `installUrl`。定义在 `src-tauri/src/fnn_cli.rs`（shell crate 的 OS 集成，非 core wire）。 |
| `NodeConfig` | `{ services: string[], fiber: { listening_addr: string, announced_node_name: Option<string>, bootnode_addrs: string[], announce_listening_addr: bool, announced_addrs: string[], chain: string, standalone_watchtower_rpc_url: Option<string>, disable_built_in_watchtower: bool, watchtower_check_interval_seconds: u64, open_channel_auto_accept_min_ckb_funding_amount: u64, auto_accept_channel_ckb_funding_amount: u64, tlc_expiry_delta: u64, tlc_fee_proportional_millionths: u64, funding_timeout_seconds: u64, max_inbound_peers: u64, min_outbound_peers: u64, sync_network_graph: bool, auto_announce_node: bool, proxy_url: Option<string> }, rpc: { listening_addr: string, enabled_modules: string[] }, ckb: { rpc_url: string, tx_tracing_polling_interval_ms: u64 }, scripts: Array<{ name: string, code_hash: string, hash_type: string, args: string, cell_deps: Array<{ kind: 'type_id', code_hash: string, hash_type: string, args: string } \| { kind: 'cell_dep', tx_hash: string, index: string（hex 字符串，如 `'0x0'`，与 mock `ScriptCellDep` 及 fiber CellDep 的 `out_point.index` 一致）, dep_type: string }> }>, udt_whitelist: Array<{ name: string, code_hash: string, hash_type: string, args: string, cell_deps?: Array<{ kind: 'type_id' \| 'cell_dep', … }>, auto_accept_amount: u64 }> }` | serde_yaml round-trip 的 config.yml（fiber 节点配置 schema）—— 与 `NodeConfigModal` 表单 1:1（`scripts`/`udt_whitelist`/`cell_deps` 可编辑数组）。**命名**：字段名与 config.yml 键一致（snake_case 为主），是 §3.2 camelCase 全局规则的例外；TS mock 的 `udtWhitelist` 为 camelCase，wire/YAML 键为 `udt_whitelist`，接入时对齐。**YAML 形态**：`code_hash`/`hash_type`/`args` 在 config.yml 中嵌套于 `script:` 下、`cell_dep` 嵌套于 `out_point:` 下（mock `serializeConfigYaml` 输出即此形态，fiberConfig.ts:225-265）——Rust serde 结构须按 config.yml 的嵌套 schema 定义以 1:1 round-trip（上表为内存/wire 扁平形态）。`udt_whitelist` 项含可选 `cell_deps`。`RPC_MODULES`/`SERVICES`/`HASH_TYPES`/`SCRIPT_TYPES` 枚举保持前端常量（静态 UI 元数据，非链数据）。作为 load/save 契约替换 mock `defaultNodeConfig`；`defaultNodeConfig` 仍是前端 “Reset config” 回退（本地，无命令）。 |
| `ChannelList` | `{ nodes: Vec<ChannelNode> }` | `scan_fiber_channels(owner_lock_hash)` + `list_peers`，Rust 端按 `counterparty_fiber_key` 分组（聚合）。前端仍从原始余额派生每节点与 KPI 求和（设计决策 #2）。 |
| `ChannelNode` | `{ peer: { id: string, alias: Option<string>, addr: Option<string> }, channels: Vec<Channel> }` | `PeerInfo`（pubkey→id、address→addr）按 `counterparty_fiber_key` 匹配；`alias` 尽力取自 `node_name` / `announced_node_name`（替换 mock `connectedNodes[].alias`，非链上数据）。 |
| `Channel` | `{ channel_id: string, tx_hash: string, output_index: u32, capacity_ckb: f64, capacity_shannons: u64, local_balance_ckb: f64, local_balance_shannons: u64, remote_balance_ckb: f64, remote_balance_shannons: u64, state: string, is_public: bool, enabled: bool, created_at_ms: u64, close_flags: Option<u32>, base_fee_mshannons: Option<u64>, fee_rate_ppm: Option<u64> }` | `FiberChannelInfo`（链上原始：channel_id、tx_hash、output_index、capacity/local/remote balance 均 shannons、`state_name`→state、is_public、enabled、created_at ms、close_flags）。`*_ckb = shannons/1e8`（Rust 端）。`state` 为 fiber 原始 state_name（NegotiatingFunding/…/ChannelReady/ShuttingDown/Closed）；前端映射到 active\|pending\|closing 显示桶。`base_fee_mshannons`/`fee_rate_ppm` 来自 fiber channel-detail RPC（`get_channel_info`）可用时 —— 不在 `FiberChannelInfo` 中（已记录缺口；今日仅 mock）。 |
| `LiquidityOrder` | `{ outpoint: string, channel_capacity_ckb: f64, channel_capacity_shannons: u64, shannons_per_block: u64, annual_yield_bps: f64, deposit_ckb: f64, rental_days: Option<u32>, fiber_address: Option<string>, xudt_amount: u128, created_at_ms: Option<u64>, status: 'open' }` | `OrderSummary`（SDK 聚合：outpoint、channel_capacity_ckb、shannons_per_block、annual_yield_bps、xudt_amount）+ `OrderInfo` 原始（`channel_capacity_shannons` 来自 `order_data.channel_capacity`；`deposit_ckb = ckb_capacity/1e8` 真实租金容量；`fiber_address`）+ 桌面本地 sidecar（`rental_days`、`created_at_ms` —— `publish_order` 时写入，未跟踪为 null）。`status` 恒为 `'open'` —— 已匹配/已取消订单链下消耗，`scan_orders` 中缺席。前端计算 dwellHours / rentalDays tier/gauge + `totalDemand`/`avgApy`/`pending`/`avgDwell`/`sharePct`（公式）。 |
| `LiquidityMatch` | `{ outpoint: string, channel_outpoint: string, channel_capacity_ckb: f64, shannons_per_block: u64, annual_yield_bps: f64, deposit_ckb: f64, original_stake_ckb: f64, withdrawable_ckb: f64, xudt_amount: u128, created_at_ms: u64, expires_at_ms: u64, is_exhausted: bool, health: 'healthy'\|'warning'\|'critical'\|'exhausted', last_extraction_block: u64, projected_exhaustion_block: u64, seller_lock_hash: string, match_creation_block: u64, hesitation_ends_at_ms: u64, role: 'buyer'\|'seller'\|'other' }` | `MatchDetail`/`MatchSummary`（SDK：outpoint、channel_outpoint、shannons_per_block、annual_yield_bps、is_exhausted、last_extraction_block、projected_exhaustion_block 两类型皆有；**`health`、`seller_lock_hash`、`match_creation_block` 仅 `MatchDetail`，`MatchSummary` 无**）+ `get_block_timestamp(match_current_block)`→created_at_ms（即 MatchDetail/MatchDeadline 的 `match_creation_block`）、`get_block_timestamp(projected_exhaustion_block)`→expires_at_ms（`shannons_per_block==0` 时为 `u64::MAX`）。**各字段语义**：`channel_capacity_ckb` = 被资助的 Fiber 通道容量（`match_channel_capacity` 读 funding tx，恒定，**非**剩余质押）；`deposit_ckb` = **当前剩余租金池**（`MatchInfo.ckb_capacity/1e8`，每次卖方提取后下降）；`original_stake_ckb` = **原始租金池**（new-core-crate 交易图回溯：沿 match cell producing-tx 的 Opticrum 锁输入（133B match / 65B order）回退到 `order_match` 创建 tx，其 match 输出容量 − occupied（occupied 跨化身恒定，由 `last_raw − ckb_capacity` 得出）；按 match args hex 缓存；回溯失败回退 `deposit_ckb`）；`withdrawable_ckb` = 全额质押**仅当**钱包为买方且处于犹豫窗口内，否则 `0.0`。**犹豫期字段（new-core-crate 提供）**：`match_creation_block` = `MatchInfo.match_current_block`（窗口锚点）；`hesitation_ends_at_ms` = `created_at_ms + HESITATION_BLOCKS×12s`（`HESITATION_BLOCKS=3600`，≈12h，与 `expires_at_ms` 同一 12s/块约定）；`role` 由 buyer/seller lock hash 与钱包 lock hash 比对（`buyer`/`seller`/`other`）。前端由 `created_at_ms`/`expires_at_ms`/`hesitation_ends_at_ms`/`role`/`original_stake_ckb`/`deposit_ckb` + 原始字段计算 `matchLife`/`matchPhase`/`extractionProgress`/`rentalDaysForMatch`/`daysLeft`/`computeInboundSummary`/donut slices（`OverviewChart`；`splitPct` 为池级汇总，见 §6）（公式，设计决策 #2）。 |

---

## 6. 前端保留公式清单（明确不进 IPC）

以下逻辑**只在前端**（自 `mock/liquidity.ts` 迁到前端 lib），Rust 端**不**计算、不返回这些派生值：

> 现状：这些公式当前仍位于 `mock/liquidity.ts`（`shannonsPerBlockToApyBps`/`matchLife`/`computeInboundSummary`/`dwellHours`/`rentalDaysForMatch`）、`components/LiquidityCellField.tsx`（`daysLeft`/`cellDiameter`）与 `pages/LiquidityMarket.tsx`（`splitPct` 内联）——接入 IPC 时迁移到前端 lib。

| 域 | 保留公式 / 逻辑 | 依据的输入 |
|---|---|---|
| 钱包/交易 | `typeCounts` 归约、`activeTypes` 过滤 | `wallet.get_transactions` 返回的 `kind` |
| 钱包/交易 | `shortHash` / `truncatedHash`（地址/哈希缩写显示） | `tx_hash` / `address` |
| 节点 | `stats{INFO,WARN,ERROR}` 计数 | `node.get_logs` 返回的 `level` |
| 节点 | locale 感知的时间戳格式化 | `NodeLog.ts_ms` 等 |
| 节点 | level filter chips（本地筛选） | `node.get_logs` 返回 |
| 节点 | `detectChainFromRpc` —— 仅作**保存前 badge 启发式**；权威 chain 一律来自 `node.get_runtime` / `node.save_config` | 本地 RPC 探测 |
| 通道 | `nodeOutboundCkb` / `nodeInboundCkb` 求和；KPI outbound/inbound/node/channel 计数 | `channels.list` 的原始 `*_ckb` 余额 |
| 通道 | fiber `state_name` → `active`/`pending`/`closing` 显示桶映射 | `Channel.state` |
| 流动性 | APY 换算 `shannonsPerBlockToApyBps`（实时 APY 估算；`publish_order` 只传 `shannons_per_block` + `capacity`，**不**传 APY） | `shannons_per_block`、`channel_capacity` |
| 流动性 | `matchLife` 剩余寿命百分比 | `created_at_ms` / `expires_at_ms` + 当前时间 |
| 流动性 | `rentalDaysForMatch` / `daysLeft`（剩余租期/天数） | `created_at_ms` / `expires_at_ms` |
| 流动性 | `dwell` 时长（订单驻留小时） | `LiquidityOrder.created_at_ms` |
| 流动性 | `computeInboundSummary`（入站汇总，含 APY 加权） | `LiquidityMatch` 原始字段 |
| 流动性 | `totalDemand` / `avgApy` / `pending` / `avgDwell`（订单池汇总）；per-order 工具提示 share `hoveredOrderShare = channelCapacityCkb/totalDemand*100` | `LiquidityOrder` 原始字段 |
| 流动性 | 匹配健康环 donut slices（前端 `OverviewChart`：按 outpoint 分片、按 `matchLife().label` 着色；不叫 splitPct） | `LiquidityMatch` 原始字段 |
| 流动性 | 本地取消后从池中过滤（spent/hidden） | 取消动作本地状态 |
| 流动性 | `get_dashboard` / `get_matches_near_exhaustion` 的 snake_case → camelCase 薄 mapper | SDK 聚合返回 |
| 钱包/交易 | `fiatUsd = (availableCkb / totalCkb) * fiat_usd` 法币估算 | `WalletSummary` |
| 钱包/交易 | 余额分段 `availableCkb.toFixed(2).split('.')` + `toLocaleString()` | `WalletSummary` |
| 钱包/交易 | 交易金额带符号 `(amountCkb>=0?'+':'')+amountCkb.toLocaleString({maximumFractionDigits:2})+' CKB'` | `WalletTx.amount_ckb` |
| 通道 | `localPct`/`remotePct` 容量占比条 | `Channel` 原始余额 |
| 节点 | `startedAtMs` → 前端每秒刷新实时计时 `Xh Ym`（分钟级；停止时 `0h 0m`） | `NodeRuntime.started_at_ms`（`uptime_hours` 为其整小时派生） |
| 配置 | `serializeConfigYaml` 序列化 + `new Blob(yaml).size / 1024` 体积显示 | `NodeConfig` |
| 配置 | QR 伪图案 FNV-1a 32-bit + xorshift 确定性渲染 | `WalletSummary.address` |
| 流动性 | `formatCkbPerBlock(shannons) = shannons / 1e8` | `shannons_per_block` |
| 流动性 | `cellDiameter(capacityCkb, maxCap)` sqrt 面积缩放 96–168px（纯渲染） | `LiquidityOrder.channel_capacity_ckb` |
| 流动性 | `dwellTierColor`（≤72h teal / ≤168h warn / >168h danger）、`lifeTierColor`/`lifeColor`（连续绿→黄→红） | `LiquidityOrder.created_at_ms` / `LiquidityMatch` |
| 流动性 | order cell gauge `min(100, dwellH/168*100)`；match cell gauge `life.pct` | `LiquidityOrder.created_at_ms` / `LiquidityMatch` |
| 流动性 | **`matchPhase`**（`'hesitating'\|'active'\|'exhausted'`）+ `hesitationRemainingMs` + `formatDurationHm`（h/m 倒计时）—— 犹豫期判定：`isExhausted→exhausted`；`role≠buyer` 或 `lastExtractionBlock>0 → active`；`now < hesitation_ends_at_ms → hesitating`（近似链上 `tip − match_creation_block ≤ 3600` 且 `last_extraction_block==0`） | `LiquidityMatch.hesitation_ends_at_ms` / `role` / `last_extraction_block` |
| 流动性 | **`extractionProgress`** = `{ originalCkb, remainingCkb, extractedCkb: max(0, original−remaining), pct: round(extracted/original×100) }` —— 实际租金提取进度（容量口径；`matchLife` 仍为时间口径）。Cell 显示「已提取 X%」迷你进度徽章，抽屉显示完整进度条 + 原始/已提取/剩余三列 | `LiquidityMatch.original_stake_ckb` / `deposit_ckb` |

补充：`liquidity.get_dashboard` 的 `avg_annual_yield_bps` 已是 bps，前端**直接渲染**，无需换算公式。

本地动作（无对应命令）：copy-to-clipboard、QR 渲染、配置 Reset（`defaultNodeConfig` 回退）、theme/locale 切换。

---

## 7. Phase 2 事件预告（不展开设计）

本轮不实现，仅锁定方向。实时数据以 Tauri event 订阅形式推送，用于替代命令轮询：

| 事件 | 说明 |
|---|---|
| `node.tip_changed` | tip 区块高度推送（替代 `get_dashboard` 的 tip 轮询 与 mock `nodeRuntime.tipHeight` 遗留字段） |
| `node.log_line` | 日志流（替代 `node.get_logs` 轮询） |
| `node.status_changed` | running/stopped 状态切换 |
| `wallet.balance_changed` | 钱包锁上的余额增量 |
| `wallet.new_tx` | 已确认交易追加进账户历史 |
| `liquidity.new_order` | 自有订单 cell 链上确认 |
| `liquidity.order_matched` | 链上匹配消耗一个订单 → 新 match cell；awaiting-match 药丸翻转为 match |
| `liquidity.match_life_advanced` | matchLife 百分比推进 + 7d/1d 阈值临近耗尽告警 |
| `liquidity.rent_extraction` | 自动提取调度 tick / seller 租金自动收取（本 UI 不展示 `extract_rent` 路径） |
| `channels.channel_state_changed` | `ChannelReady` / `ShuttingDown` / `Closed` 切换 |

---

## 8. 实现建议

### 8.1 crate 与模块结构

- 新建独立 crate **`opticrum-wallet-core`**（不在 opticrum-sdk / rust-server 内部），作为桌面侧唯一桥接层：依赖 `opticrum-calculator` + `ckb-cinnabar-calculator` + vendored fiber rpc_client + rust-server 的 `ChainProvider`/`TransactionAssembler`/钱包组件。
- **command 薄封装**：每个 IPC command 只做参数反序列化 + 委托给 core 内对应 service + 结果映射，业务逻辑下沉到 service；避免 command 层膨胀。

### 8.2 关键实现点

| 项 | 建议 |
|---|---|
| 链上取数缓存 | 复用 `ChainCache` + `CachedChainProvider` 做快照缓存，替换唯一 actix 耦合：`actix_rt::spawn` → `tokio::spawn`、`actix_rt::time::sleep` → `tokio::time` |
| 阻塞 FS | config.yml YAML、keystore 文件 IO、日志缓冲读取一律走 `spawn_blocking` |
| 写命令确认 | 签名+广播命令按 TransactionAssembler 风格：`send` → `register pending` → `wait_for_confirmation`（`confirm_count`，300s 超时） |
| 真实签名 | 走 `TransactionAssembler::balance_and_sign`，**不要**用占位 `HdWalletSigner`/`InternalSigner::sign()` |
| `wallet.send_ckb` | 桌面后端必须实现真实转账 —— rust-server `RealChainProvider.send_transaction` 仅为占位（`'create_order:/cancel_order:/…'` 前缀） |
| 交易历史索引器 | 新增桌面账户历史索引器：`get_cells_by_lock_arg`(钱包 lock hashes) → `get_transaction` → Rust 端分类 kind（fiber 通道开/关经 funding-lock args 长度 / 通道 outpoint） |
| 本地 sidecar | 维护 `outpoint → { rental_days, created_at_ms, deposit_ckb }`（`publish_order` 写入），供 `get_orders`/`get_matches` 使用 |
| 钱包会话 | RAM-only 会话，TTL 3600s 滑动；`unlocked=false` / `running=false` 一律作为状态数据返回，不作为错误 |
| 记录缺口 | fiber `base_fee_mshannons`/`fee_rate_ppm` 不在 `FiberChannelInfo` 中（今日仅 mock）；开通道 fee 透传可能 no-op，均需在注释/文档标注 |
| HTTP 市场域 | 独立 fetch 模块承载 `apps`/`banners`/`news`/`changelogs`，保留 mock→真实目录 URL 的切换开关；TopBar `apps.length` 来自此域，`channelsSummary`/`total_matches` 来自 IPC |
| Phase 2 预留 | 事件名与承载已在 §7 锁定，代码中为事件通道预留命名空间，避免后续迁移破坏 |

---

**附：与 mock 的对应关系（替换点）**

| mock 数据/逻辑 | IPC 替代 |
|---|---|
| `wallet.fiatUsd` | `WalletSummary.fiat_usd`（可选） |
| `wallet.txs` | `wallet.get_transactions` → `Vec<WalletTx>` |
| `nodeRuntime` + `nodeWatchtower` | `node.get_runtime` → `NodeRuntime`（watchtower mode 值迁移：`'local'\|'remote'` → `'builtin'\|'standalone'\|'disabled'`） |
| `nodeRuntime.tipHeight` | Phase 2 `node.tip_changed`（未渲染遗留字段） |
| `nodeRuntime.cpuPercent/memPercent/synced/peers` | 无替代 —— 未渲染，建议从 mock 删除（不进 wire） |
| `channelsSummary.online` | 无替代 —— 未渲染；如需展示由 `node.get_runtime.running` 派生 |
| node.ts logs | `node.get_logs` → `Vec<NodeLog>` |
| `defaultNodeConfig`（load/save 契约） | `node.get_config` / `node.save_config`（`NodeConfig`）；`defaultNodeConfig` 仅作 “Reset config” 本地回退 |
| `connectedNodes[].alias` | `ChannelNode.peer.alias`（尽力，来自 node_name / announced_node_name） |
| liquidity 的 APY/matchLife/dwell/汇总公式 | 保留在前端（§6 清单），Rust 端只返回原始字段与 SDK 聚合 |
