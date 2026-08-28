//! Default `NodeConfig` — used by the real node backend when no config file has
//! been persisted yet (and as the source of the fiber node's RPC address).

use crate::wire::{
  CkbConfig, FiberConfig, FiberScript, NodeConfig, RpcConfig, ScriptCellDep, UdtWhitelistEntry,
};

pub fn default_config() -> NodeConfig {
  NodeConfig {
    services: vec!["fiber".into(), "rpc".into(), "ckb".into()],
    fiber: FiberConfig {
      chain: "testnet".into(),
      announced_node_name: "ckb-bot-sg".into(),
      listening_addr: "/ip4/0.0.0.0/tcp/8228".into(),
      announce_listening_addr: true,
      bootnode_addrs: vec![
        "/ip4/54.179.226.154/tcp/8228/p2p/Qmes1EBD4yNo9Ywkfe6eRw9tG1nVNGLDmMud1xJMsoYFKy".into(),
        "/ip4/16.163.7.105/tcp/8228/p2p/QmdyQWjPtbK4NWWsvy8s69NGJaQULwgeQDT5ZpNDrTNaeV".into(),
      ],
      announced_addrs: vec![],
      standalone_watchtower_rpc_url: "/ip4/45.77.65.221/tcp/8115".into(),
      standalone_watchtower_token: "".into(),
      watchtower_check_interval_seconds: 60,
      disable_built_in_watchtower: false,
      open_channel_auto_accept_min_ckb_funding_amount: 10_000_000_000,
      auto_accept_channel_ckb_funding_amount: 9_900_000_000,
      tlc_expiry_delta: 14_400_000,
      tlc_fee_proportional_millionths: 1000,
      funding_timeout_seconds: 86_400,
      max_inbound_peers: 16,
      min_outbound_peers: 8,
      sync_network_graph: true,
      auto_announce_node: true,
      proxy_url: "".into(),
    },
    rpc: RpcConfig {
      listening_addr: "127.0.0.1:8227".into(),
      enabled_modules: vec![
        "cch".into(),
        "channel".into(),
        "graph".into(),
        "payment".into(),
        "info".into(),
        "invoice".into(),
        "peer".into(),
        "watchtower".into(),
      ],
    },
    ckb: CkbConfig {
      rpc_url: "https://testnet.ckbapp.dev/".into(),
      tx_tracing_polling_interval_ms: 4000,
    },
    scripts: vec![
      FiberScript {
        name: "FundingLock".into(),
        code_hash: "0x6c67887fe201ee0c7853f1682c0b77c0e6214044c156c7558269390a8afa6d7c".into(),
        hash_type: "type".into(),
        args: "0x".into(),
        cell_deps: vec![
          ScriptCellDep::TypeId {
            code_hash: "0x00000000000000000000000000000000000000000000000000545950455f4944".into(),
            hash_type: "type".into(),
            args: "0x3cb7c0304fe53f75bb5727e2484d0beae4bd99d979813c6fc97c3cca569f10f6".into(),
          },
          ScriptCellDep::CellDep {
            tx_hash: "0x12c569a258dd9c5bd99f632bb8314b1263b90921ba31496467580d6b79dd14a7".into(),
            index: "0x0".into(),
            dep_type: "code".into(),
          },
        ],
      },
      FiberScript {
        name: "CommitmentLock".into(),
        code_hash: "0x740dee83f87c6f309824d8fd3fbdd3c8380ee6fc9acc90b1a748438afcdf81d8".into(),
        hash_type: "type".into(),
        args: "0x".into(),
        cell_deps: vec![
          ScriptCellDep::TypeId {
            code_hash: "0x00000000000000000000000000000000000000000000000000545950455f4944".into(),
            hash_type: "type".into(),
            args: "0xf7e458887495cf70dd30d1543cad47dc1dfe9d874177bf19291e4db478d5751b".into(),
          },
          ScriptCellDep::CellDep {
            tx_hash: "0x12c569a258dd9c5bd99f632bb8314b1263b90921ba31496467580d6b79dd14a7".into(),
            index: "0x0".into(),
            dep_type: "code".into(),
          },
        ],
      },
    ],
    udt_whitelist: vec![UdtWhitelistEntry {
      name: "RUSD".into(),
      code_hash: "0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a".into(),
      hash_type: "type".into(),
      args: "0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d5c764f253b55b998526439b".into(),
      auto_accept_amount: 1_000_000_000,
      cell_deps: Some(vec![ScriptCellDep::TypeId {
        code_hash: "0x00000000000000000000000000000000000000000000000000545950455f4944".into(),
        hash_type: "type".into(),
        args: "0x97d30b723c0b2c66e9cb8d4d0df4ab5d7222cbb00d4a9a2055ce2e5d7f0d8b0f".into(),
      }]),
    }],
  }
}
