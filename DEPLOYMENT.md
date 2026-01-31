
MapViewer.ai --- Production Deployment Documentation -- 1.30.26
============================================================

Overview
--------

**MapViewer.ai** is deployed as a **lightweight, read-only GeoJSON viewer** running on a dedicated Ubuntu host and exposed publicly via **Cloudflare Tunnel**.

This setup is intentionally:

-   Stateless / best-effort

-   Low-maintenance

-   No inbound ports

-   No database

-   No authentication

-   Independent from BlocNav infrastructure

The system is designed to behave like an **appliance**, not an evolving service.

* * * * *

Architecture Summary
--------------------

```
Internet
```

### Key properties

-   No firewall holes

-   No reverse proxy

-   No TLS management on the host

-   Cloudflare terminates HTTPS

-   Node runs under systemd as a long-lived service

* * * * *

Host Requirements
-----------------

-   Ubuntu 20.04 LTS (or newer)

-   Dedicated machine (not running BlocNav)

-   Outbound internet access

-   Cloudflare account with domain access (`mapviewer.ai`)

* * * * *

Base System Setup
-----------------

### Update system and install core utilities

```
sudo apt update
```

### Firewall (Cloudflare Tunnel requires no inbound ports)

```
sudo ufw default deny incoming
```

* * * * *

Node.js Installation (LTS)
--------------------------

Node 20 LTS via NodeSource:

```
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
```

Verify:

```
node -v
```

* * * * *

Application Directory Layout
----------------------------

All MapViewer files live under:

```
/opt/mapviewer
```

Create base directory:

```
sudo mkdir -p /opt/mapviewer
```

* * * * *

Clone and Install the App
-------------------------

```
cd /opt/mapviewer
```

Install backend dependencies:

```
cd /opt/mapviewer/app/server
```

* * * * *

Manual Sanity Check (One Time)
------------------------------

Run backend manually:

```
node index.js
```

Expected output:

```
Server running on http://localhost:3001
```

Test:

```
curl -I http://localhost:3001
```

You should receive `HTTP/1.1 200 OK`.

Stop the process (`Ctrl+C`) before continuing.

* * * * *

systemd Service (Node Backend)
------------------------------

### Create service file

```
sudo nano /etc/systemd/system/mapviewer.service
```

Paste:

```
[Unit]
```

### Enable and start

```
sudo systemctl daemon-reexec
```

Verify:

```
sudo systemctl status mapviewer
```

Expected:

```
Active: active (running)
```

* * * * *

Cloudflare Tunnel Setup
-----------------------

### Install cloudflared

```
sudo apt install -y cloudflared
```

### Authenticate with Cloudflare

```
cloudflared tunnel login
```

(Select the `mapviewer.ai` zone in the browser.)

* * * * *

### Create named tunnel

```
cloudflared tunnel create mapviewer
```

### Route DNS to tunnel

```
cloudflared tunnel route dns mapviewer mapviewer.ai
```

* * * * *

### Tunnel configuration

```
nano ~/.cloudflared/config.yml
```

* * * * *

### Run tunnel manually (sanity check)

```
cloudflared tunnel run mapviewer
```

Verify externally:

```
https://mapviewer.ai
```

Stop with `Ctrl+C` once confirmed.

* * * * *

### Run tunnel as a service

```
sudo cloudflared service install
```

Verify:

```
sudo systemctl status cloudflared
```

* * * * *

Final Verification Checklist
----------------------------

-   ✅ `systemctl status mapviewer` → active

-   ✅ `systemctl status cloudflared` → active

-   ✅ `https://mapviewer.ai` loads externally

-   ✅ Drag-and-drop GeoJSON works

-   ✅ Share links (`/v/:id`) work in incognito

* * * * *

Operational Notes
-----------------

### Intentional Non-Goals

-   No authentication

-   No persistence guarantees

-   No database

-   No monitoring stack

-   No autoscaling

-   No HA

### Data Semantics

-   Share links are **best-effort**

-   Bundles are stored in memory

-   Server restarts may invalidate links

This is by design.

* * * * *

Maintenance Philosophy
----------------------

This service should:

-   Run unattended

-   Survive reboots

-   Require no regular interaction

If you find yourself "tuning" it often, the setup has drifted.

* * * * *

Release Freeze
--------------

Once deployed and verified:

```
git tag mapviewer-v0.1-deployed
```

From that point forward, **production should not move** unless explicitly planned.

* * * * *

Summary
-------

This deployment prioritizes:

-   Simplicity

-   Isolation

-   Reliability

-   Low cognitive load

MapViewer.ai is intentionally treated as a **public utility**, not a platform.

* * * * *

What happens on power loss → reboot (exactly)
---------------------------------------------

When the machine boots:

### 1️⃣ systemd starts

This is the Linux init system. It's responsible for everything that matters here.

* * * * *

### 2️⃣ `mapviewer.service` starts automatically ✅

Because you ran:

```
sudo systemctl enable mapviewer
```

systemd will:

-   Start Node

-   Run `/usr/bin/node index.js`

-   Bind to `localhost:3001`

-   Restart it if it crashes

You already confirmed it's enabled.

* * * * *

### 3️⃣ `cloudflared.service` starts automatically ✅

Because you ran:

```
sudo systemctl enable cloudflared
```

systemd will:

-   Start cloudflared

-   Read `/etc/cloudflared/config.yml`

-   Reconnect the tunnel

-   Re-establish multiple connections to Cloudflare

This happens **without DNS changes, logins, or prompts**.

* * * * *

### 4️⃣ Traffic resumes automatically 🌐

Once both services are up:

```
https://mapviewer.ai
```

works again, even if:

-   Your home IP changed

-   Power was out for hours

-   Router rebooted

-   ISP reassigned addresses

That's the **core value of Cloudflare Tunnel**.

* * * * *

What you do NOT need to do after a reboot
-----------------------------------------

❌ No SSH commands\
❌ No `npm start`\
❌ No `cloudflared tunnel run`\
❌ No browser logins\
❌ No DNS changes

The box is now an **appliance**.

* * * * *

How to sanity-check after a reboot (optional)
---------------------------------------------

If you ever want reassurance, SSH in and run **only these**:

```
sudo systemctl status mapviewer
```

You want to see:

```
Active: active (running)
```

That's it.

* * * * *

Failure scenarios (and what actually happens)
---------------------------------------------

### 🔌 Power loss

-   Machine reboots

-   systemd restarts both services

-   Tunnel reconnects

-   Site comes back

### 🌐 ISP IP change

-   Tunnel reconnects

-   Cloudflare doesn't care

-   Site stays up

### 💥 Node crashes

-   systemd restarts it automatically

-   Tunnel never drops

### 🔁 cloudflared crashes

-   systemd restarts it

-   Connections re-established

You've covered **all the common failure modes**.

* * * * *

----

The only time you'd need to intervene
-------------------------------------

Very rare cases:

-   Disk corruption

-   OS update requiring manual intervention

-   You manually disabled a service

-   Hardware failure

Normal outages? **No action required.**

* * * * *

One-liner summary (worth remembering)
-------------------------------------

> **If the box boots, MapViewer.ai boots.**

You've done this the *right* way --- boring, reliable, and forgettable.\
That's exactly what you want.

blockquote { margin-left: 0.39in; margin-right: 0.39in; background: transparent }h3 { margin-top: 0.1in; margin-bottom: 0.08in; background: transparent; page-break-after: avoid }h3.western { font-family: "Liberation Serif", serif; font-size: 14pt; font-weight: bold }h3.cjk { font-family: "Noto Serif CJK SC"; font-size: 14pt; font-weight: bold }h3.ctl { font-family: "Lohit Devanagari"; font-size: 14pt; font-weight: bold }pre { background: transparent }pre.western { font-family: "Liberation Mono", monospace; font-size: 10pt }pre.cjk { font-family: "Noto Sans Mono CJK SC", monospace; font-size: 10pt }pre.ctl { font-family: "Liberation Mono", monospace; font-size: 10pt }h2 { margin-top: 0.14in; margin-bottom: 0.08in; background: transparent; page-break-after: avoid }h2.western { font-family: "Liberation Serif", serif; font-size: 18pt; font-weight: bold }h2.cjk { font-family: "Noto Serif CJK SC"; font-size: 18pt; font-weight: bold }h2.ctl { font-family: "Lohit Devanagari"; font-size: 18pt; font-weight: bold }h1 { margin-bottom: 0.08in; background: transparent; page-break-after: avoid }h1.western { font-family: "Liberation Serif", serif; font-size: 24pt; font-weight: bold }h1.cjk { font-family: "Noto Serif CJK SC"; font-size: 24pt; font-weight: bold }h1.ctl { font-family: "Lohit Devanagari"; font-size: 24pt; font-weight: bold }p { margin-bottom: 0.1in; line-height: 115%; background: transparent }em { font-style: italic }code.western { font-family: "Liberation Mono", monospace }code.cjk { font-family: "Noto Sans Mono CJK SC", monospace }code.ctl { font-family: "Liberation Mono", monospace }strong { font-weight: bold }
