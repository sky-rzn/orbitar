#!/usr/bin/env bash
# Запуск Claude Code в Docker-контейнере с этим проектом, смонтированным в /workspace.
#
#   ./claude-container.sh                 # запустить claude (интерактивно)
#   ./claude-container.sh -p "вопрос"     # любые аргументы уходят в claude как есть
#   ./claude-container.sh shell           # bash внутри контейнера
#   ./claude-container.sh build           # (пере)собрать образ
#   ./claude-container.sh login           # запустить claude, чтобы войти через /login
#   ./claude-container.sh reset           # удалить конфиг-том контейнера (и логин)
#
# Переменные окружения:
#   CLAUDE_VERSION   версия @anthropic-ai/claude-code для сборки (по умолчанию latest)
#   CLAUDE_PORT      порт хоста, проброшенный на 8000 в контейнере (по умолчанию 8000)
#   CLAUDE_YOLO=1    добавить --dangerously-skip-permissions (внутри контейнера это безопаснее)
#   ANTHROPIC_API_KEY если задан — прокидывается в контейнер вместо OAuth-логина

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
IMAGE="claude-code-${PROJECT_NAME}:local"
CONFIG_VOLUME="claude-config-${PROJECT_NAME}"   # ~/.claude контейнера: логин, история, memory
CONTAINER_HOME=/home/claude
HOST_PORT="${CLAUDE_PORT:-8000}"

usage() { sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

build_image() {
    echo ">> Собираю образ $IMAGE"
    docker build \
        --build-arg UID="$(id -u)" \
        --build-arg GID="$(id -g)" \
        --build-arg CLAUDE_VERSION="${CLAUDE_VERSION:-latest}" \
        -t "$IMAGE" "$PROJECT_DIR/.claude-container"
}

port_busy() {
    if command -v ss >/dev/null; then ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1\$"
    else (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; fi
}

ensure_image() {
    docker image inspect "$IMAGE" >/dev/null 2>&1 || build_image
}

# Первый запуск: если на хосте есть OAuth-логин, копируем его в том контейнера,
# чтобы не логиниться заново. Дальше контейнер живёт со своей копией (токены обновляются в томе).
seed_credentials() {
    local host_creds="$HOME/.claude/.credentials.json"
    [[ -f "$host_creds" ]] || return 0
    # Том монтируем в ~/.claude контейнера: новый том наследует владельца этой папки из образа.
    if ! docker run --rm --entrypoint sh -v "$CONFIG_VOLUME:$CONTAINER_HOME/.claude" "$IMAGE" \
            -c "test -f $CONTAINER_HOME/.claude/.credentials.json"; then
        echo ">> Копирую логин Claude с хоста в том $CONFIG_VOLUME"
        docker run --rm --entrypoint sh \
            -v "$CONFIG_VOLUME:$CONTAINER_HOME/.claude" \
            -v "$host_creds:/src/.credentials.json:ro" \
            "$IMAGE" -c "cp /src/.credentials.json $CONTAINER_HOME/.claude/.credentials.json && chmod 600 $CONTAINER_HOME/.claude/.credentials.json"
    fi
}

run_container() {
    local entrypoint="$1"; shift
    local -a args=(
        --rm -i
        --init
        --name "claude-${PROJECT_NAME}-$$"
        --hostname "claude-${PROJECT_NAME}"
        --security-opt no-new-privileges
        -v "$PROJECT_DIR:/workspace"
        -v "$CONFIG_VOLUME:$CONTAINER_HOME/.claude"
        -w /workspace
        -e TERM="${TERM:-xterm-256color}"
        -e COLORTERM="${COLORTERM:-truecolor}"
        -e GIT_AUTHOR_NAME="$(git config --global user.name || true)"
        -e GIT_AUTHOR_EMAIL="$(git config --global user.email || true)"
        -e GIT_COMMITTER_NAME="$(git config --global user.name || true)"
        -e GIT_COMMITTER_EMAIL="$(git config --global user.email || true)"
        --entrypoint "$entrypoint"
    )
    [[ -t 0 && -t 1 ]] && args+=(-t)   # TTY только если запущены из терминала
    # Проброс порта для `python3 -m http.server 8000` внутри контейнера. CLAUDE_PORT=0 — отключить.
    if [[ "$HOST_PORT" != "0" ]]; then
        if port_busy "$HOST_PORT"; then
            echo ">> Порт $HOST_PORT на хосте занят, запускаю без проброса (CLAUDE_PORT=<порт> чтобы сменить)" >&2
        else
            args+=(-p "127.0.0.1:${HOST_PORT}:8000")
        fi
    fi
    [[ -n "${ANTHROPIC_API_KEY:-}" ]] && args+=(-e ANTHROPIC_API_KEY)
    [[ -f "$HOME/.gitconfig" ]] && args+=(-v "$HOME/.gitconfig:$CONTAINER_HOME/.gitconfig:ro")
    exec docker run "${args[@]}" "$IMAGE" "$@"
}

cmd="${1:-}"
case "$cmd" in
    -h|--help|help)
        usage ;;
    build)
        build_image ;;
    reset)
        docker volume rm "$CONFIG_VOLUME" && echo ">> Том $CONFIG_VOLUME удалён" ;;
    shell)
        shift; ensure_image; seed_credentials
        run_container /bin/bash "$@" ;;
    login)
        ensure_image
        echo ">> Внутри Claude наберите /login, чтобы войти в аккаунт (сохранится в томе $CONFIG_VOLUME)"
        run_container claude ;;
    *)
        ensure_image; seed_credentials
        extra=()
        [[ "${CLAUDE_YOLO:-0}" == "1" ]] && extra+=(--dangerously-skip-permissions)
        run_container claude "${extra[@]}" "$@" ;;
esac
