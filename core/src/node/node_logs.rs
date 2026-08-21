//! Real node-log capture — a process-wide `tracing` ring buffer.
//!
//! The embedded fiber node logs via `tracing`; a custom `Layer` here records
//! INFO/WARN/ERROR events into a ring buffer that `node.get_logs` reads. The
//! shell's `tauri-plugin-log` implements the `log` facade, not a `tracing`
//! subscriber, so there is no conflict — core owns the only `tracing`
//! subscriber in the process.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use tracing::field::{Field, Visit};
use tracing::{Event, Level, Subscriber};
use tracing_subscriber::layer::{Context, Layer, SubscriberExt};
use tracing_subscriber::registry;

use crate::wire::{LogLevel, NodeLog};

// Large enough to survive a full node cold start (~2 min of boot logs) without
// evicting the early preparation lines the user needs to see.
const CAPACITY: usize = 5000;

/// Ring buffer of captured node logs.
#[derive(Default)]
pub struct NodeLogBuffer {
  inner: Mutex<VecDeque<NodeLog>>,
}

impl NodeLogBuffer {
  fn push(&self, level: LogLevel, msg: String) {
    let mut logs = self.inner.lock().unwrap();
    if logs.len() >= CAPACITY {
      logs.pop_front();
    }
    logs.push_back(NodeLog {
      ts_ms: now_ms(),
      level,
      msg,
    });
  }

  /// Drain the buffer, filtering by level / since-ts / limit.
  pub fn drain(
    &self,
    level: Option<LogLevel>,
    since_ts_ms: Option<u64>,
    limit: Option<u32>,
  ) -> Vec<NodeLog> {
    let logs = self.inner.lock().unwrap();
    let mut out: Vec<NodeLog> = logs
      .iter()
      .filter(|l| level.is_none_or(|lv| l.level == lv))
      .filter(|l| since_ts_ms.is_none_or(|ts| l.ts_ms >= ts))
      .cloned()
      .collect();
    if let Some(l) = limit {
      out.truncate(l as usize);
    }
    out
  }
}

fn now_ms() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis() as u64)
    .unwrap_or(0)
}

fn wire_level(level: &Level) -> Option<LogLevel> {
  match *level {
    Level::INFO => Some(LogLevel::Info),
    Level::WARN => Some(LogLevel::Warn),
    Level::ERROR => Some(LogLevel::Error),
    _ => None, // DEBUG / TRACE dropped
  }
}

/// A `tracing` layer that records events into the shared buffer.
struct NodeLogLayer {
  buffer: Arc<NodeLogBuffer>,
}

impl<S: Subscriber> Layer<S> for NodeLogLayer {
  fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
    let Some(level) = wire_level(event.metadata().level()) else {
      return;
    };
    let mut visitor = MessageVisitor::default();
    event.record(&mut visitor);
    self.buffer.push(level, visitor.message);
  }
}

#[derive(Default)]
struct MessageVisitor {
  message: String,
}

impl Visit for MessageVisitor {
  fn record_debug(&mut self, field: &Field, value: &dyn std::fmt::Debug) {
    if field.name() == "message" {
      self.message = format!("{value:?}");
    }
  }

  fn record_str(&mut self, field: &Field, value: &str) {
    if field.name() == "message" {
      self.message = value.to_string();
    }
  }

  fn record_error(&mut self, field: &Field, value: &(dyn std::error::Error + 'static)) {
    if field.name() == "message" {
      self.message = value.to_string();
    }
  }
}

/// Install the tracing log-capture layer once; returns the process-wide buffer.
pub fn install_log_capture() -> &'static Arc<NodeLogBuffer> {
  static BUF: OnceLock<Arc<NodeLogBuffer>> = OnceLock::new();
  static ONCE: std::sync::Once = std::sync::Once::new();
  ONCE.call_once(|| {
    let buffer = BUF
      .get_or_init(|| Arc::new(NodeLogBuffer::default()))
      .clone();
    let layer = NodeLogLayer { buffer };
    let subscriber = registry().with(tracing_subscriber::filter::LevelFilter::INFO.and_then(layer));
    let _ = tracing::subscriber::set_global_default(subscriber);
  });
  BUF.get_or_init(|| Arc::new(NodeLogBuffer::default()))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn buffer_drain_filters_by_level_ts_limit() {
    let buf = NodeLogBuffer::default();
    buf.push(LogLevel::Info, "one".to_string());
    buf.push(LogLevel::Warn, "two".to_string());
    buf.push(LogLevel::Error, "three".to_string());

    let all = buf.drain(None, None, None);
    assert_eq!(all.len(), 3);

    let warns = buf.drain(Some(LogLevel::Warn), None, None);
    assert_eq!(warns.len(), 1);
    assert_eq!(warns[0].msg, "two");

    let limited = buf.drain(None, None, Some(2));
    assert_eq!(limited.len(), 2);
  }

  #[test]
  fn buffer_caps_at_capacity() {
    let buf = NodeLogBuffer::default();
    for i in 0..(CAPACITY + 50) {
      buf.push(LogLevel::Info, format!("line {i}"));
    }
    assert!(buf.drain(None, None, None).len() <= CAPACITY);
  }

  #[test]
  fn capture_records_tracing_info_events() {
    let buf = install_log_capture();
    tracing::info!("hello node log capture");
    let logs = buf.drain(None, None, None);
    assert!(
      logs
        .iter()
        .any(|l| l.msg.contains("hello node log capture")),
      "tracing INFO events must reach the ring buffer"
    );
  }
}
