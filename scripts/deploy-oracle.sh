#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# The CI sends a built release; the existing systemd service keeps its paths,
# environment, user and database. No secrets or data are shipped from GitHub.
app=${ROTA_APP_DIR:-/home/opc/app}
service=${ROTA_SERVICE:-rota-app}
release=$(cd "$(dirname "$0")/.." && pwd)
backup_root=${ROTA_BACKUP_DIR:-/home/opc/.rota-deploy-backups}
node_bin=${ROTA_NODE:-/usr/local/bin/node}

[[ "$service" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo 'Serviço inválido.' >&2; exit 1; }
[[ "$app" = /* && "$app" != / && -d "$app/server" && "$release" != "$app" ]] || { echo 'Instalação existente inválida.' >&2; exit 1; }
[[ -x "$node_bin" && -f "$release/dist/index.html" && -f "$release/dist/deploy-version.json" ]] || { echo 'Release ou Node inválidos.' >&2; exit 1; }
for command in rsync tar flock curl cmp npm systemctl sudo; do command -v "$command" >/dev/null; done
mkdir -p "$backup_root"
exec 9>"$backup_root/deploy.lock"
flock -n 9 || { echo 'Outro deploy está em andamento.' >&2; exit 1; }

working_directory=$(systemctl show "$service" -p WorkingDirectory --value)
[[ "$working_directory" = "$app" ]] || { echo 'WorkingDirectory do serviço difere da instalação.' >&2; exit 1; }
systemctl is-active --quiet "$service"
pid=$(systemctl show "$service" -p MainPID --value)
[[ "$pid" =~ ^[1-9][0-9]*$ ]] || { echo 'PID do serviço inválido.' >&2; exit 1; }

# Install in the release before interrupting the application.
(cd "$release" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund)
"$node_bin" "$release/scripts/oracle-state.mjs" prepare "$app" "$release" "$pid"
port=$("$node_bin" -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).port)' "$release/deploy-state.json")
backup=$(mktemp -d "$backup_root/release-XXXXXXXX")
stopped=0
changed=0
success=0

sync_code() {
  local source=$1
  for directory in dist src node_modules; do
    rsync -ac --delete "$source/$directory/" "$app/$directory/" || return
  done
  # Preserve runtime files in server/, including databases, snapshots and .env.
  # Do not delete unknown files from that directory.
  rsync -ac --exclude='*.sqlite*' --exclude='*.db*' --exclude='backups/' --exclude='.env*' "$source/server/" "$app/server/" || return
  rsync -ac "$source/package.json" "$source/package-lock.json" "$app/" || return
}

cleanup() {
  local status=$?
  trap - EXIT HUP INT TERM
  if [[ "$success" = 0 && "$stopped" = 1 ]]; then
    echo 'Deploy falhou; recuperando o código anterior.' >&2
    sudo -n systemctl stop "$service" || true
    if [[ "$changed" = 1 ]]; then
      mkdir -p "$backup/previous"
      if tar -xzf "$backup/app.tar.gz" -C "$backup/previous" && sync_code "$backup/previous"; then
        echo 'Código anterior recuperado. O banco atual foi preservado.' >&2
      else
        echo "Falha no retorno do código. Backup preservado em $backup" >&2
      fi
    fi
    sudo -n systemctl start "$service" || true
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM

sudo -n systemctl stop "$service"
stopped=1
# The archive retains code, dependencies and configuration for rollback.
tar -czf "$backup/app.tar.gz" -C "$app" .
"$node_bin" "$release/scripts/oracle-state.mjs" snapshot "$app" "$release" "$backup/data.sqlite"
changed=1
sync_code "$release"
sudo -n systemctl start "$service"

for attempt in {1..15}; do
  if systemctl is-active --quiet "$service" &&
      curl --noproxy '*' --fail --silent --show-error --max-time 5 "http://127.0.0.1:$port/deploy-version.json" > "$backup/live-version.json" &&
      cmp -s "$release/dist/deploy-version.json" "$backup/live-version.json" &&
      [[ "$(curl --noproxy '*' --silent --show-error --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/api/me")" = 401 ]]; then
    success=1
    echo "DEPLOY_OK: $(cat "$release/dist/deploy-version.json")"
    echo "Backup: $backup"
    exit 0
  fi
  sleep 2
done
echo 'A nova versão não passou na verificação local de saúde.' >&2
exit 1
