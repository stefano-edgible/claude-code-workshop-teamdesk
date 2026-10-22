# teamdesk

## Why

A small team needs one place to book rooms, hand out tasks and post announcements, and a shared spreadsheet or chat thread gets double-booked. Teamdesk (this repository) does it with one SQLite file on a machine you own, and no hosted service or account.

## What

One app, `teamdesk`, on `org`. Teamdesk has no sign-in of its own, and anyone who reaches it can act as any member of the team, so it must not be open to the internet. `org` lets in only members of your Edgible organisation, who pick who they are on the page. The image is `ghcr.io/stefano-edgible/teamdesk:1.0.0`, built from this repository's `Dockerfile` for arm64 and amd64, and runs as a non-root user on Bun.

Everything lives in one SQLite file, `/data/teamdesk.db`, in the volume `teamdesk-data`. Back it up. The first start creates the tables, and the address in `TEAMDESK_ADMIN_EMAIL` becomes the first admin, who adds the rest of the team. Minimum recommended for the place `teamdesk`: 128 MB of memory and 1 GB of disk, on an arm64 or amd64 machine, with no GPU.

The Compose file is [docker-compose.yml](docker-compose.yml), the settings [card.env](card.env), the card [card.yml](card.yml).

## How

Five steps. Edit [card.env](card.env) before you start.

### 1. Fetch

```bash
mkdir -p teamdesk
curl -fsSL https://github.com/stefano-edgible/claude-code-workshop-teamdesk/archive/refs/heads/main.tar.gz \
  | tar -xz --strip-components=3 -C teamdesk --wildcards '*/card/teamdesk'
```

### 2. Edit card.env

Set `TEAMDESK_ADMIN_EMAIL` to the email you sign in to Edgible with (`edgible whoami` prints it) and `TEAMDESK_ADMIN_NAME` to your name.

```bash
nano teamdesk/card.env
```

### 3. Check

```bash
curl -fsSLo check-env.py https://raw.githubusercontent.com/edgible-org/card-kit/main/check-env.py
python3 check-env.py teamdesk
```

It fills each empty secret and moves a taken port, as lines to paste. Run it again until it says `no conflicts`.

### 4. Start

```bash
docker compose --env-file teamdesk/card.env -f teamdesk/docker-compose.yml up -d --wait
docker compose --env-file teamdesk/card.env -f teamdesk/docker-compose.yml ps
```

`--wait` returns when each service is running, and healthy when it has a healthcheck. 

### 5. Publish

```bash
set -euo pipefail
set -a
. teamdesk/card.env
set +a
device_id=$(edgible device list --json | jq -er --arg name "$DEVICE" '
  map(select(.name == $name))
  | if length == 1 then .[0].id
    else error("need exactly one device named " + $name + " (" + (map(.status + " " + .id) | join(", ")) + ")")
    end
')
edgible app create existing \
  --non-interactive \
  --name teamdesk \
  --port "$TEAMDESK_PORT" \
  --protocol https \
  --auth-modes org \
  --device-id "$device_id"
edgible app list
```

**Without Edgible:** only Publish is Edgible's. The app listens on `127.0.0.1` at the port in `card.env`, so any reverse proxy or tunnel on the machine, such as Caddy, nginx, Cloudflare Tunnel or Tailscale, can publish it instead, and sign-in is then that tool's to provide. Every other step stays the same.

## Verify

`teamdesk` uses `org`.

```bash
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' "https://<teamdesk hostname>"
```

That prints `302` and an `edgible.com/application-access/` address, so the org sign-in is in front. Open the address and sign in to Edgible. Teamdesk opens with its member picker: choose the admin, then add the rest of the team under Team and a room under Rooms.

The rest of the setup is in the [Teamdesk docs](https://github.com/stefano-edgible/claude-code-workshop-teamdesk).

## Tear down

Four steps, in this order. Step 1 runs wherever `edgible` is logged in. Steps 2 to 4 run on the machine that runs the containers. Steps 2 and 3 read `card.env`, so keep it until step 4.

### 1. Unpublish

```bash
edgible app delete teamdesk --yes
```

### 2. Stop

```bash
docker compose --env-file teamdesk/card.env -f teamdesk/docker-compose.yml down
```

### 3. Delete the data

Skip this step to keep the data. The loop copies each volume to a `.tgz` file in this directory first.

```bash
for volume in $(docker volume ls -q --filter label=com.docker.compose.project=teamdesk); do
  docker run --rm -v "$volume:/data:ro" -v "$PWD:/backup" alpine tar -czf "/backup/$volume.tgz" -C /data .
done
docker compose --env-file teamdesk/card.env -f teamdesk/docker-compose.yml down --volumes
```

### 4. Remove the card

```bash
rm -rf teamdesk
```
