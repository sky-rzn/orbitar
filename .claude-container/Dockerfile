# Образ с Claude Code для работы над проектом внутри контейнера.
# Собирается скриптом ../claude-container.sh
FROM node:22-bookworm-slim

ARG UID=1000
ARG GID=1000
ARG CLAUDE_VERSION=latest

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
        git ca-certificates curl less procps ripgrep python3 openssh-client \
        sudo \
    && rm -rf /var/lib/apt/lists/*

# Claude Code ставим глобально через npm — версия фиксируется аргументом сборки.
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_VERSION} && npm cache clean --force

# Пользователь с тем же UID/GID, что и на хосте, чтобы файлы в примонтированном
# проекте не становились root-овыми. Образ node уже содержит uid 1000 (node) — переиспользуем его.
RUN set -eux; \
    if getent passwd "${UID}" >/dev/null; then \
        old="$(getent passwd "${UID}" | cut -d: -f1)"; usermod -l claude -d /home/claude -m "$old"; \
    else \
        useradd -m -u "${UID}" -s /bin/bash claude; \
    fi; \
    if ! getent group "${GID}" >/dev/null; then groupadd -g "${GID}" claude; fi; \
    usermod -g "${GID}" claude; \
    echo 'claude ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/claude; \
    mkdir -p /home/claude/.claude /workspace; \
    chown -R "${UID}:${GID}" /home/claude /workspace

USER claude
WORKDIR /workspace
ENV HOME=/home/claude \
    SHELL=/bin/bash \
    DISABLE_AUTOUPDATER=1

ENTRYPOINT ["claude"]
