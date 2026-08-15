//! Lightweight JSON-RPC 2.0 client — vendored from rust-server (fiber-cli).
//!
//! Talks to the Fiber Network Node (FNN) JSON-RPC API over `reqwest`. Generic
//! JSON transport; typed helpers on top. The `FiberRpcExt` extension maps
//! `anyhow::Error` → `CommandError::chain` so callers use `?` directly.

use std::net::IpAddr;

use anyhow::{anyhow, Result};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;

use crate::wire::CommandError;

/// A lightweight JSON-RPC 2.0 client for communicating with FNN.
#[derive(Clone, Debug)]
pub struct RpcClient {
  url: String,
  client: reqwest::Client,
  raw_data: bool,
  auth_token: Option<String>,
}

#[derive(Serialize)]
struct JsonRpcRequest {
  jsonrpc: &'static str,
  method: String,
  params: Vec<Value>,
  id: u64,
}

#[derive(Deserialize)]
struct JsonRpcResponse {
  result: Option<Value>,
  error: Option<JsonRpcError>,
  #[allow(dead_code)]
  id: Option<u64>,
}

#[derive(Deserialize, Debug)]
struct JsonRpcError {
  code: i64,
  message: String,
  #[allow(dead_code)]
  data: Option<Value>,
}

impl RpcClient {
  pub fn new(url: &str, raw_data: bool, auth_token: Option<String>) -> Result<Self> {
    // Strip all whitespace/newlines from auth token (common when pasting or reading from file).
    let auth_token = auth_token
      .map(|t| t.chars().filter(|c| !c.is_whitespace()).collect::<String>())
      .filter(|t| !t.is_empty());
    let has_auth_token = auth_token.is_some();
    let has_explicit_scheme = url.starts_with("http://") || url.starts_with("https://");

    // Auto-prepend http:// if no scheme is provided.
    let url = if has_explicit_scheme {
      url.to_string()
    } else {
      format!("http://{url}")
    };
    let parsed_url = Self::validate_url(&url)?;
    if has_auth_token {
      Self::validate_authenticated_url(&parsed_url, has_explicit_scheme)?;
    }

    Ok(Self {
      url,
      client: reqwest::Client::new(),
      raw_data,
      auth_token,
    })
  }

  /// Validate the URL, catching common mistakes like duplicate schemes.
  fn validate_url(url: &str) -> Result<reqwest::Url> {
    let after_scheme = url
      .strip_prefix("http://")
      .or_else(|| url.strip_prefix("https://"));
    if let Some(rest) = after_scheme {
      if rest.starts_with("http://") || rest.starts_with("https://") {
        return Err(anyhow!(
          "Invalid URL '{}': duplicate scheme detected. Did you mean '{}'?",
          url,
          rest
        ));
      }
    }

    let parsed = reqwest::Url::parse(url).map_err(|e| anyhow!("Invalid URL '{}': {}", url, e))?;

    if parsed.host().is_none() {
      return Err(anyhow!(
        "Invalid URL '{}': missing host. Expected format: http://host:port",
        url
      ));
    }

    Ok(parsed)
  }

  fn validate_authenticated_url(url: &reqwest::Url, has_explicit_scheme: bool) -> Result<()> {
    if url.scheme() == "https" || Self::is_loopback_url(url) {
      return Ok(());
    }

    if !has_explicit_scheme {
      let mut https_url = url.clone();
      let _ = https_url.set_scheme("https");
      return Err(anyhow!(
        "Refusing to send RPC auth token over implicit plaintext HTTP to '{}'. Use '{}' or specify 'http://' explicitly if plaintext transport is intentional.",
        url,
        https_url
      ));
    }

    eprintln!(
      "warning: sending RPC auth token over plaintext HTTP to '{}'; use HTTPS unless this is intentional",
      url
    );
    Ok(())
  }

  fn is_loopback_url(url: &reqwest::Url) -> bool {
    let Some(host) = url.host_str() else {
      return false;
    };
    let host = host
      .strip_prefix('[')
      .and_then(|host| host.strip_suffix(']'))
      .unwrap_or(host);

    host.eq_ignore_ascii_case("localhost")
      || host
        .parse::<IpAddr>()
        .map(|addr| addr.is_loopback())
        .unwrap_or(false)
  }

  pub fn url(&self) -> &str {
    &self.url
  }

  pub fn raw_data(&self) -> bool {
    self.raw_data
  }

  pub fn auth_token(&self) -> Option<&str> {
    self.auth_token.as_deref()
  }

  /// Sends a JSON-RPC request and returns the raw result.
  pub async fn call(&self, method: &str, params: Vec<Value>) -> Result<Value> {
    let request = JsonRpcRequest {
      jsonrpc: "2.0",
      method: method.to_string(),
      params,
      id: 1,
    };

    let mut req_builder = self.client.post(&self.url).json(&request);

    if let Some(token) = &self.auth_token {
      req_builder = req_builder.bearer_auth(token);
    }

    let response = req_builder
      .send()
      .await
      .map_err(|e| anyhow!("Failed to send request to {}: {}", self.url, e))?;

    let status = response.status();
    if !status.is_success() {
      let body = response.text().await.unwrap_or_default();
      // Keep the full error body — the 200-char slice hid contract/chain error
      // codes (the debugging signal) that live in the tail of the response.
      return Err(anyhow!("HTTP error {}: {}", status, body));
    }

    let body: JsonRpcResponse = response
      .json()
      .await
      .map_err(|e| anyhow!("Failed to parse JSON-RPC response: {}", e))?;

    if let Some(error) = body.error {
      return Err(anyhow!(
        "RPC error (code {}): {}",
        error.code,
        error.message
      ));
    }

    Ok(body.result.unwrap_or(Value::Null))
  }

  /// Typed JSON-RPC request with positional params.
  pub async fn call_typed_with_values<R>(&self, method: &str, params: Vec<Value>) -> Result<R>
  where
    R: DeserializeOwned,
  {
    let value = self.call(method, params).await?;
    serde_json::from_value(value).map_err(|e| {
      anyhow!(
        "Failed to deserialize JSON-RPC result for {}: {}",
        method,
        e
      )
    })
  }

  /// Typed JSON-RPC request with a single param object.
  pub async fn call_typed<P, R>(&self, method: &str, params: &P) -> Result<R>
  where
    P: Serialize,
    R: DeserializeOwned,
  {
    let value = serde_json::to_value(params)
      .map_err(|e| anyhow!("Failed to serialize JSON-RPC params for {}: {}", method, e))?;
    self.call_typed_with_values(method, vec![value]).await
  }

  /// Typed JSON-RPC request with no params.
  pub async fn call_typed_no_params<R>(&self, method: &str) -> Result<R>
  where
    R: DeserializeOwned,
  {
    self.call_typed_with_values(method, vec![]).await
  }

  /// JSON-RPC request with no params, raw result.
  pub async fn call_no_params(&self, method: &str) -> Result<Value> {
    self.call(method, vec![]).await
  }
}

/// Extension trait — `CommandError`-returning wrappers for `RpcClient`.
#[async_trait::async_trait]
pub trait FiberRpcExt {
  async fn call_fiber<P, R>(&self, method: &str, params: &P) -> Result<R, CommandError>
  where
    P: Serialize + Sync,
    R: DeserializeOwned;

  async fn call_fiber_no_params<R>(&self, method: &str) -> Result<R, CommandError>
  where
    R: DeserializeOwned;
}

#[async_trait::async_trait]
impl FiberRpcExt for RpcClient {
  async fn call_fiber<P, R>(&self, method: &str, params: &P) -> Result<R, CommandError>
  where
    P: Serialize + Sync,
    R: DeserializeOwned,
  {
    self
      .call_typed(method, params)
      .await
      .map_err(|e| CommandError::chain(format!("Fiber RPC {method}: {e}")))
  }

  async fn call_fiber_no_params<R>(&self, method: &str) -> Result<R, CommandError>
  where
    R: DeserializeOwned,
  {
    self
      .call_typed_no_params(method)
      .await
      .map_err(|e| CommandError::chain(format!("Fiber RPC {method}: {e}")))
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_new_auto_prepends_http() {
    let client = RpcClient::new("127.0.0.1:8227", false, None).unwrap();
    assert_eq!(client.url(), "http://127.0.0.1:8227");
  }

  #[test]
  fn test_new_auto_prepends_http_for_remote_without_auth() {
    let client = RpcClient::new("example.com:8227", false, None).unwrap();
    assert_eq!(client.url(), "http://example.com:8227");
  }

  #[test]
  fn test_new_rejects_implicit_http_for_remote_with_auth() {
    let result = RpcClient::new(
      "example.com:8227",
      false,
      Some("my-secret-token".to_string()),
    );
    assert!(result.is_err());
    let err = result.unwrap_err().to_string();
    assert!(
      err.contains("implicit plaintext HTTP"),
      "expected 'implicit plaintext HTTP' in error: {}",
      err
    );
    assert!(
      err.contains("https://example.com:8227/"),
      "expected HTTPS suggestion in error: {}",
      err
    );
  }

  #[test]
  fn test_new_accepts_implicit_http_for_loopback_with_auth() {
    let client = RpcClient::new(
      "127.8.9.10:8227",
      false,
      Some("my-secret-token".to_string()),
    )
    .unwrap();
    assert_eq!(client.url(), "http://127.8.9.10:8227");

    let client =
      RpcClient::new("localhost:8227", false, Some("my-secret-token".to_string())).unwrap();
    assert_eq!(client.url(), "http://localhost:8227");

    let client = RpcClient::new("[::1]:8227", false, Some("my-secret-token".to_string())).unwrap();
    assert_eq!(client.url(), "http://[::1]:8227");
  }

  #[test]
  fn test_new_preserves_http_scheme() {
    let client = RpcClient::new("http://example.com:8227", false, None).unwrap();
    assert_eq!(client.url(), "http://example.com:8227");
  }

  #[test]
  fn test_new_preserves_https_scheme() {
    let client = RpcClient::new("https://example.com:8227", false, None).unwrap();
    assert_eq!(client.url(), "https://example.com:8227");
  }

  #[test]
  fn test_new_accepts_https_for_remote_with_auth() {
    let client = RpcClient::new(
      "https://example.com:8227",
      false,
      Some("my-secret-token".to_string()),
    )
    .unwrap();
    assert_eq!(client.url(), "https://example.com:8227");
  }

  #[test]
  fn test_new_accepts_explicit_http_for_remote_with_auth() {
    let client = RpcClient::new(
      "http://example.com:8227",
      false,
      Some("my-secret-token".to_string()),
    )
    .unwrap();
    assert_eq!(client.url(), "http://example.com:8227");
  }

  #[test]
  fn test_raw_data_flag() {
    let client = RpcClient::new("http://localhost", true, None).unwrap();
    assert!(client.raw_data());

    let client = RpcClient::new("http://localhost", false, None).unwrap();
    assert!(!client.raw_data());
  }

  #[test]
  fn test_has_auth_with_token() {
    let client = RpcClient::new(
      "http://localhost",
      false,
      Some("my-secret-token".to_string()),
    )
    .unwrap();
    assert!(client.auth_token().is_some());
    assert_eq!(client.auth_token().unwrap(), "my-secret-token");
  }

  #[test]
  fn test_has_auth_without_token() {
    let client = RpcClient::new("http://localhost", false, None).unwrap();
    assert!(client.auth_token().is_none());
  }

  #[test]
  fn test_auth_token_trimmed() {
    let client = RpcClient::new(
      "http://localhost",
      false,
      Some("  my-token  \n".to_string()),
    )
    .unwrap();
    assert_eq!(client.auth_token().unwrap(), "my-token");
  }

  #[test]
  fn test_auth_token_strips_internal_whitespace() {
    let client = RpcClient::new(
      "http://localhost",
      false,
      Some("abc123\ndef456".to_string()),
    )
    .unwrap();
    assert_eq!(client.auth_token().unwrap(), "abc123def456");
  }

  #[test]
  fn test_auth_token_empty_after_trim() {
    let client = RpcClient::new("http://localhost", false, Some("  \n".to_string())).unwrap();
    assert!(client.auth_token().is_none());
  }

  #[test]
  fn test_duplicate_http_scheme_rejected() {
    let result = RpcClient::new("http://http://127.0.0.1:8227", false, None);
    assert!(result.is_err());
    let err = result.unwrap_err().to_string();
    assert!(
      err.contains("duplicate scheme"),
      "expected 'duplicate scheme' in error: {}",
      err
    );
    assert!(
      err.contains("http://127.0.0.1:8227"),
      "expected suggestion in error: {}",
      err
    );
  }

  #[test]
  fn test_duplicate_https_scheme_rejected() {
    let result = RpcClient::new("https://http://127.0.0.1:8227", false, None);
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("duplicate scheme"));
  }

  #[test]
  fn test_duplicate_scheme_without_initial_scheme_rejected() {
    let result = RpcClient::new("http://https://example.com", false, None);
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("duplicate scheme"));
  }

  #[test]
  fn test_valid_url_accepted() {
    let client = RpcClient::new("http://127.0.0.1:8227", false, None).unwrap();
    assert_eq!(client.url(), "http://127.0.0.1:8227");
  }

  #[test]
  fn test_valid_localhost_url_accepted() {
    let client = RpcClient::new("http://localhost:8227", false, None).unwrap();
    assert_eq!(client.url(), "http://localhost:8227");
  }

  #[tokio::test]
  async fn jsonrpc_roundtrip_over_http() {
    use std::io::{Read, Write};
    use std::net::TcpListener;

    // Minimal canned JSON-RPC HTTP server on an ephemeral port.
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let server = std::thread::spawn(move || {
      let (mut stream, _) = listener.accept().unwrap();
      let mut buf = [0u8; 4096];
      let _ = stream.read(&mut buf).unwrap();
      let body = r#"{"jsonrpc":"2.0","result":{"version":"0.9.0","ok":true},"id":1}"#;
      let resp = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
      );
      stream.write_all(resp.as_bytes()).unwrap();
    });

    let client = RpcClient::new(&format!("http://{addr}"), false, None).unwrap();
    let value: serde_json::Value = client
      .call_typed_no_params("node_info")
      .await
      .expect("json-rpc call succeeds");
    assert_eq!(value["version"], "0.9.0");
    assert_eq!(value["ok"], true);
    server.join().unwrap();
  }

  #[tokio::test]
  async fn jsonrpc_returns_rpc_error() {
    use std::io::{Read, Write};
    use std::net::TcpListener;

    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let server = std::thread::spawn(move || {
      let (mut stream, _) = listener.accept().unwrap();
      let mut buf = [0u8; 4096];
      let _ = stream.read(&mut buf).unwrap();
      let body = r#"{"jsonrpc":"2.0","error":{"code":-32601,"message":"method not found"},"id":1}"#;
      let resp = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
      );
      stream.write_all(resp.as_bytes()).unwrap();
    });

    let client = RpcClient::new(&format!("http://{addr}"), false, None).unwrap();
    let err = client.call("bogus", vec![]).await.unwrap_err().to_string();
    assert!(err.contains("method not found"), "err: {err}");
    server.join().unwrap();
  }
}
