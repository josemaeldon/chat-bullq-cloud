#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
ENV_EXAMPLE="${ROOT_DIR}/.env.example"
PUBLIC_URL="${PUBLIC_URL:-${1:-http://localhost:3000}}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Erro: o comando '$1' nao esta instalado." >&2
    exit 1
  fi
}

set_env_value() {
  local key="$1"
  local value="$2"
  local temp_file
  temp_file="$(mktemp)"
  awk -v key="${key}" -v value="${value}" '
    BEGIN { found = 0 }
    index($0, key "=") == 1 {
      print key "=" value
      found = 1
      next
    }
    { print }
    END {
      if (!found) print key "=" value
    }
  ' "${ENV_FILE}" > "${temp_file}"
  mv "${temp_file}" "${ENV_FILE}"
}

require_command docker
require_command openssl

if ! docker compose version >/dev/null 2>&1; then
  echo "Erro: Docker Compose v2 nao esta disponivel." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Erro: o Docker daemon nao esta em execucao." >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${ENV_EXAMPLE}" "${ENV_FILE}"

  db_password="$(openssl rand -hex 24)"
  minio_password="$(openssl rand -hex 24)"
  jwt_secret="$(openssl rand -hex 64)"
  jwt_refresh_secret="$(openssl rand -hex 64)"

  set_env_value "PUBLIC_URL" "${PUBLIC_URL%/}"
  set_env_value "POSTGRES_PASSWORD" "${db_password}"
  set_env_value \
    "DATABASE_URL" \
    "postgresql://chat_bullq:${db_password}@postgres:5432/chat_bullq"
  set_env_value "MINIO_ROOT_PASSWORD" "${minio_password}"
  set_env_value "JWT_SECRET" "${jwt_secret}"
  set_env_value "JWT_REFRESH_SECRET" "${jwt_refresh_secret}"

  # SMTP depende de um provedor externo. Deixamos vazio para a stack iniciar,
  # mas a recuperacao de senha em producao exige configuracao posterior.
  set_env_value "SMTP_HOST" ""
  set_env_value "SMTP_USER" ""
  set_env_value "SMTP_PASSWORD" ""
  set_env_value "SMTP_FROM" ""

  chmod 600 "${ENV_FILE}"
  echo "Arquivo .env criado com segredos aleatorios."
else
  echo "Arquivo .env existente preservado."
fi

if grep -Eq '^[A-Z0-9_]+=.*CHANGE_ME' "${ENV_FILE}"; then
  echo "Erro: ainda existem valores CHANGE_ME no arquivo .env." >&2
  exit 1
fi

if [[ -n "${GHCR_TOKEN:-}" ]]; then
  if [[ -z "${GHCR_USER:-}" ]]; then
    echo "Erro: defina GHCR_USER junto com GHCR_TOKEN." >&2
    exit 1
  fi
  printf '%s' "${GHCR_TOKEN}" |
    docker login ghcr.io -u "${GHCR_USER}" --password-stdin
fi

cd "${ROOT_DIR}"
docker compose config >/dev/null
docker compose pull
docker compose up -d
docker compose ps

echo
echo "Chat BullQ iniciado em: ${PUBLIC_URL%/}"
echo "Swagger: ${PUBLIC_URL%/}/docs"
