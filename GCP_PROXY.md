# GCP SOCKS Proxy

This server uses a persistent SSH SOCKS tunnel through the GCP VM to avoid region-blocked AI API egress.

## Endpoint

- Local SOCKS proxy: `socks5h://127.0.0.1:1080`
- GCP VM SSH user: `hortmes2002`
- GCP VM public IP: `35.198.197.98`
- Local SSH key: `/root/.ssh/id_ed25519`
- systemd service: `gcp-socks-proxy.service`

Use `socks5h`, not `socks5`, so DNS lookup also happens through the proxy.

## Service Commands

```bash
systemctl status gcp-socks-proxy.service
systemctl restart gcp-socks-proxy.service
journalctl -u gcp-socks-proxy.service -n 100 --no-pager
```

The service is installed at:

```text
/etc/systemd/system/gcp-socks-proxy.service
```

It starts this tunnel:

```bash
/usr/bin/ssh -N \
  -D 127.0.0.1:1080 \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o StrictHostKeyChecking=accept-new \
  -i /root/.ssh/id_ed25519 \
  hortmes2002@35.198.197.98
```

## Verify

Without the proxy, this server currently exits from Vietnam:

```bash
curl -s https://ifconfig.me
```

Through the proxy, it should exit from the GCP VM:

```bash
curl --socks5-hostname 127.0.0.1:1080 -s https://ifconfig.me
```

Expected proxy result:

```text
35.198.197.98
```

## App Configuration

For tools that honor standard proxy environment variables:

```bash
export ALL_PROXY=socks5h://127.0.0.1:1080
export HTTPS_PROXY=socks5h://127.0.0.1:1080
export HTTP_PROXY=socks5h://127.0.0.1:1080
```

For `curl`:

```bash
curl --socks5-hostname 127.0.0.1:1080 https://example.com
```

For clients that accept a proxy URL directly, use:

```text
socks5h://127.0.0.1:1080
```

## SSH Access

To SSH to the VM manually from this server:

```bash
ssh -i /root/.ssh/id_ed25519 -o IdentitiesOnly=yes hortmes2002@35.198.197.98
```
