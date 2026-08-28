//! EmbeddedNode — runs the fiber node in-process as a library.
//!
//! Replicates `fiber-bin/src/main.rs::run_node` with LOCAL lifecycle handles
//! (never the `fnn::tasks` global singletons — those close permanently and are
//! single-shot). `node.start` calls `EmbeddedNode::start`, `node.stop` calls
//! `stop`.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use jsonrpsee::http_client::{HeaderMap, HeaderValue, HttpClientBuilder};
use jsonrpsee::server::ServerHandle;
use ractor::Actor;
use ractor::ActorRef;
use tokio::sync::{mpsc, RwLock};
use tokio_util::sync::CancellationToken;
use tokio_util::task::TaskTracker;

use crate::wire::CommandError;

pub struct EmbeddedNode {
  root_actor: ActorRef<fnn::actors::RootActorMessage>,
  tracker: TaskTracker,
  token: CancellationToken,
  rpc_handle: Option<(ServerHandle, SocketAddr)>,
  _network_actor: ActorRef<fnn::fiber::network::NetworkActorMessage>,
  _store_actor: ActorRef<fnn::store::actor::StoreActorMessage>,
  /// Kept alive for the node's lifetime (future restart/reload use).
  _base_dir: PathBuf,
}

impl EmbeddedNode {
  /// Start the embedded node from a fully-built `fnn::Config`.
  pub async fn start(cfg: &fnn::Config) -> Result<Self, CommandError> {
    let tracker = TaskTracker::new();
    let token = CancellationToken::new();
    let root_actor = fnn::actors::RootActor::start(tracker.clone(), token.clone()).await;

    let fiber_config = cfg
      .fiber
      .clone()
      .ok_or_else(|| CommandError::invalid_input("fiber config missing"))?;
    let ckb_config = cfg
      .ckb
      .clone()
      .ok_or_else(|| CommandError::invalid_input("ckb config missing"))?;
    let rpc_config = cfg
      .rpc
      .clone()
      .ok_or_else(|| CommandError::invalid_input("rpc config missing"))?;

    // Node identity (reads/generates `$FIBER_BASE_DIR/sk`).
    let node_public_key = fiber_config.public_key();

    // Chain spec + genesis (bundled testnet/mainnet, else a file path).
    let resource = match fiber_config.chain.as_str() {
      "testnet" => ckb_resource::Resource::bundled("specs/testnet.toml".to_string()),
      "mainnet" => ckb_resource::Resource::bundled("specs/mainnet.toml".to_string()),
      other => ckb_resource::Resource::file_system(cfg.base_dir.join(other)),
    };
    let chain_spec = ckb_chain_spec::ChainSpec::load_from(&resource)
      .map_err(|e| CommandError::internal(format!("load chain spec: {e}")))?;
    let genesis = chain_spec
      .build_genesis()
      .map_err(|e| CommandError::internal(format!("build genesis: {e}")))?;
    let genesis_hash: fnn::fiber::types::Hash256 = genesis.hash().into();

    // GLOBAL chain-hash guard: initialize once; a chain change needs a restart.
    if fnn::fiber::network::get_chain_hash() == Default::default() {
      fnn::fiber::network::init_chain_hash(genesis_hash);
    } else if fnn::fiber::network::get_chain_hash() != genesis_hash {
      return Err(CommandError::invalid_input(
        "chain change requires an app restart",
      ));
    }

    // Contracts context (global OnceCell).
    match fnn::ckb::contracts::try_init_contracts_context(
      genesis.clone(),
      fiber_config.scripts.clone(),
      ckb_config.udt_whitelist.clone().unwrap_or_default(),
      Some(fnn::ckb::contracts::TypeIDResolver::new(
        ckb_config.rpc_url.clone(),
      )),
    )
    .await
    {
      Ok(()) => {}
      Err(fnn::ckb::contracts::ContractsContextError::ContextAlreadyInitialized) => {
        log::warn!("contracts context already initialized — script/UDT changes need a restart");
      }
      Err(e) => return Err(CommandError::internal(format!("contracts init: {e}"))),
    }

    // Store (RocksDB/sqlite backend).
    let mut store = fnn::store::open_store_with_migration(
      fiber_config.store_path(),
      Box::new(|_| true),
      Box::new(|_| {}),
    )
    .map_err(|e| CommandError::internal(format!("open store: {e}")))?;

    // Store watcher → RPC pubsub.
    let store_change_port = Arc::new(ractor::port::OutputPort::default());
    let port_clone = store_change_port.clone();
    store.set_watcher(Arc::new(move |change| {
      port_clone.send(change);
    }));

    // CkbChainActor.
    let (ckb_chain_actor, _) = Actor::spawn_linked(
      Some("ckb".into()),
      fnn::ckb::CkbChainActor {},
      ckb_config.clone(),
      root_actor.get_cell(),
    )
    .await
    .map_err(|e| CommandError::internal(format!("ckb chain actor: {e}")))?;

    // Network events channel.
    let (event_sender, mut event_receiver) = mpsc::channel(4000);

    // Network graph.
    let network_graph = Arc::new(RwLock::new(fnn::fiber::graph::NetworkGraph::new(
      store.clone(),
      fnn::fiber::types::pubkey_from_tentacle(node_public_key.clone()),
      fiber_config.announce_private_addr(),
    )));

    // Default funding lock script (requires the CKB key — provisioned in
    // `ckb_key::ensure_ckb_key` + `FIBER_SECRET_KEY_PASSWORD` before start).
    let default_shutdown_script = ckb_config
      .get_default_funding_lock_script()
      .map_err(|e| CommandError::internal(format!("default funding lock script: {e}")))?;

    // StoreActor (periodic backups + key copies).
    let (store_actor, _) = Actor::spawn_linked(
      Some("store_actor".into()),
      fnn::store::actor::StoreActor {
        _phantom: std::marker::PhantomData,
      },
      fnn::store::actor::StoreActorInitializationParameter {
        store: store.clone(),
        backup_path: fiber_config.base_dir().join("backups"),
        ckb_key_path: ckb_config.base_dir.clone().unwrap_or_default().join("key"),
        fiber_key_path: fiber_config.base_dir().join("sk"),
        backup_interval_hours: 24,
      },
      root_actor.get_cell(),
    )
    .await
    .map_err(|e| CommandError::internal(format!("store actor: {e}")))?;

    // Network actor.
    let chain_client = fnn::ckb::client::CkbRpcClient::new(&ckb_config);
    let network_actor = fnn::fiber::network::start_network(
      fiber_config.clone(),
      chain_client,
      ckb_chain_actor.clone(),
      event_sender,
      tracker.clone(),
      root_actor.get_cell(),
      store.clone(),
      Some(store_actor.clone()),
      network_graph.clone(),
      default_shutdown_script,
    )
    .await;

    // Standalone watchtower RPC client (optional biscuit Bearer token).
    let watchtower_client = if let Some(url) = fiber_config.standalone_watchtower_rpc_url.clone() {
      let mut client_builder = HttpClientBuilder::default();
      if let Some(token) = fiber_config.standalone_watchtower_token.as_ref() {
        let mut headers = HeaderMap::new();
        headers.insert(
          "Authorization",
          HeaderValue::from_str(&format!("Bearer {token}"))
            .map_err(|e| CommandError::invalid_input(format!("watchtower token: {e}")))?,
        );
        client_builder = client_builder.set_headers(headers);
      } else {
        log::debug!("create watchtower rpc client without standalone_watchtower_token");
      }
      Some(
        client_builder
          .build(url)
          .map_err(|e| CommandError::internal(format!("watchtower rpc client: {e}")))?,
      )
    } else {
      None
    };

    // Watchtower (built-in unless disabled).
    if !fiber_config.disable_built_in_watchtower.unwrap_or(false) {
      let (watchtower_actor, _) = Actor::spawn_linked(
        Some("watchtower".into()),
        fnn::watchtower::WatchtowerActor::new(store.clone()),
        ckb_config.clone(),
        root_actor.get_cell(),
      )
      .await
      .map_err(|e| CommandError::internal(format!("watchtower actor: {e}")))?;
      let interval = fiber_config
        .watchtower_check_interval_seconds
        .unwrap_or(fnn::watchtower::DEFAULT_WATCHTOWER_CHECK_INTERVAL_SECONDS);
      watchtower_actor.send_interval(std::time::Duration::from_secs(interval), || {
        fnn::watchtower::WatchtowerMessage::PeriodicCheck
      });
    }

    tracker.spawn(async move {
      while let Some(event) = event_receiver.recv().await {
        if let Some(client) = watchtower_client.as_ref() {
          if let Err(err) = fnn::event_handler::forward_event_to_client(event, client).await {
            log::error!("Failed to forward event to standalone watchtower: {err}");
          }
        }
      }
    });

    // RPC server.
    let rpc_handle = {
      #[cfg(debug_assertions)]
      {
        fnn::rpc::server::start_rpc(
          rpc_config,
          cfg.ckb.clone(),
          cfg.fiber.clone(),
          Some(network_actor.clone()),
          None,
          store,
          Some(store_actor.clone()),
          Some(network_graph),
          root_actor.get_cell(),
          Some(store_change_port),
          Some(ckb_chain_actor.clone()),
          None,
        )
        .await
        .map_err(|e| CommandError::internal(format!("rpc server: {e}")))?
      }
      #[cfg(not(debug_assertions))]
      {
        fnn::rpc::server::start_rpc(
          rpc_config,
          cfg.ckb.clone(),
          cfg.fiber.clone(),
          Some(network_actor.clone()),
          None,
          store,
          Some(store_actor.clone()),
          Some(network_graph),
          root_actor.get_cell(),
          Some(store_change_port),
        )
        .await
        .map_err(|e| CommandError::internal(format!("rpc server: {e}")))?
      }
    };

    Ok(Self {
      root_actor,
      tracker,
      token,
      rpc_handle: Some(rpc_handle),
      _network_actor: network_actor,
      _store_actor: store_actor,
      _base_dir: cfg.base_dir.clone(),
    })
  }

  /// Shut the node down cleanly and release the RPC port.
  pub async fn stop(self) -> Result<(), CommandError> {
    if let Some((handle, _)) = self.rpc_handle {
      handle
        .stop()
        .map_err(|e| CommandError::internal(format!("stop rpc: {e}")))?;
      handle.stopped().await;
    }
    self.token.cancel();
    self.root_actor.stop(None);
    self.tracker.close();
    self.tracker.wait().await;
    Ok(())
  }
}
