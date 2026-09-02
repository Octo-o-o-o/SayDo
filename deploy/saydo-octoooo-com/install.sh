#!/bin/sh
# SayDo 一键安装(macOS / Linux)。
#   curl -fsSL https://saydo.octoooo.com/install.sh | sh
# 只在用户目录内安装,不需要 sudo,不改系统 Node:
#   ~/.saydo/toolchain/   本脚本下载的 Node 22(仅当本机没有 Node 22 时)与 saydo 包
#   ~/.saydo/bin/saydo    启动器
# 可选环境变量:
#   SAYDO_INSTALL_NO_MODIFY_PATH=1   不改 shell 启动文件(默认追加一行 PATH,带标记、可重复执行)
#   SAYDO_INSTALL_RUN=1              安装完成后直接 `saydo up`
#   SAYDO_HOME=<dir>                 数据与安装根目录(默认 ~/.saydo;必须在 $HOME 之下,除非 SAYDO_INSTALL_ALLOW_OUTSIDE_HOME=1)
#   SAYDO_INSTALL_MIRROR=1           直接用官网镜像下载 SayDo 包(默认先 GitHub Release,连不上时自动改用镜像;两者 SHA-256 相同)
#   SAYDO_INSTALL_NPM_REGISTRY=<url> 安装依赖用的 npm registry(默认 registry.npmjs.org;国内可设 https://registry.npmmirror.com)
# 卸载:rm -rf ~/.saydo/toolchain ~/.saydo/bin 并删除 shell 启动文件里带 "# saydo" 标记的那一行。
set -eu

SAYDO_VERSION="0.1.0-rc.12"
SAYDO_TGZ_SHA256="8e31998c2757b584e2f5fb848eee4e4bce4667c7429dd3e8a84c7df6ffd9eac0"
SAYDO_TGZ_URL="https://github.com/Octo-o-o-o/SayDo/releases/download/v${SAYDO_VERSION}/saydo-cli-${SAYDO_VERSION}.tgz"
SAYDO_TGZ_MIRROR_URL="https://dl.saydo.octoooo.com/releases/v${SAYDO_VERSION}/saydo-cli-${SAYDO_VERSION}.tgz"
BETTER_SQLITE3_MIRROR="https://npmmirror.com/mirrors/better-sqlite3"
NODE_MAJOR="22"
NODE_DIST="https://nodejs.org/dist"

ok() { printf '[ok] %s\n' "$*"; }
info() { printf '[..] %s\n' "$*"; }
fail() { printf '[fail] %s\n' "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || fail "缺少命令 $1(需要 curl 与 tar)"; }
need curl
need tar

[ -n "${HOME:-}" ] || fail "缺少 HOME 环境变量,无法确定用户目录"
case "$HOME" in /*) ;; *) fail "HOME 必须是绝对路径:$HOME" ;; esac
SAYDO_HOME="${SAYDO_HOME:-$HOME/.saydo}"
case "$SAYDO_HOME" in /*) ;; *) fail "SAYDO_HOME 必须是绝对路径:$SAYDO_HOME" ;; esac
# 只在用户目录内写文件:安装根目录必须位于 $HOME 之下;确需其他位置须显式 SAYDO_INSTALL_ALLOW_OUTSIDE_HOME=1。
# 词法约束在任何写入之前做:含 ".." 的路径一律拒绝(否则 $HOME/../../var 之类会绕过前缀判断);
# 再用 POSIX 自带的 `cd -P && pwd -P`(不依赖 realpath)按解析后的真实路径复核一次:symlink 越出 HOME 同样拒绝。
case "/$SAYDO_HOME/" in */../*) fail "SAYDO_HOME 不得包含 .. 路径段:$SAYDO_HOME" ;; esac
case "/$HOME/" in */../*) fail "HOME 不得包含 .. 路径段:$HOME" ;; esac
if [ "${SAYDO_INSTALL_ALLOW_OUTSIDE_HOME:-0}" != "1" ]; then
  case "$SAYDO_HOME" in
    "$HOME"|"$HOME"/*) ;;
    *) fail "SAYDO_HOME 不在用户目录 $HOME 之下:$SAYDO_HOME(本脚本只在用户目录内安装;确需其他位置请设 SAYDO_INSTALL_ALLOW_OUTSIDE_HOME=1)" ;;
  esac
  [ -d "$HOME" ] || fail "HOME 不是目录:$HOME"
  real_home="$(cd -P -- "$HOME" 2>/dev/null && pwd -P)" || fail "无法解析 HOME 的真实路径:$HOME"
  existing="$SAYDO_HOME"
  while [ ! -d "$existing" ] && [ "$existing" != "/" ]; do existing="$(dirname "$existing")"; done
  real_existing="$(cd -P -- "$existing" 2>/dev/null && pwd -P)" || fail "无法解析 SAYDO_HOME 已存在祖先的真实路径:$existing"
  case "$real_existing" in
    "$real_home"|"$real_home"/*) ;;
    *) fail "SAYDO_HOME 解析后不在用户目录之下:$real_existing(symlink 越出 $real_home)" ;;
  esac
fi
TOOLCHAIN="$SAYDO_HOME/toolchain"
PREFIX="$TOOLCHAIN/prefix"
BIN_DIR="$SAYDO_HOME/bin"
mkdir -p "$TOOLCHAIN" "$BIN_DIR"

os="$(uname -s)"
arch="$(uname -m)"
case "$os" in
  Darwin) node_os="darwin" ;;
  Linux) node_os="linux" ;;
  *) fail "不支持的系统:$os(Windows 请用 install.ps1)" ;;
esac
case "$arch" in
  arm64|aarch64) node_arch="arm64" ;;
  x86_64|amd64) node_arch="x64" ;;
  *) fail "不支持的 CPU 架构:$arch" ;;
esac

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | cut -d' ' -f1
  else fail "缺少 sha256sum / shasum,无法校验下载"; fi
}

node_major_of() { "$1" -p 'process.versions.node.split(".")[0]' 2>/dev/null || true; }

# 1. 选 Node:本机已有 Node 22 直接用;否则下载官方 Node 22 到 toolchain(用户目录内)。
NODE_BIN=""
if command -v node >/dev/null 2>&1 && [ "$(node_major_of "$(command -v node)")" = "$NODE_MAJOR" ]; then
  NODE_BIN="$(command -v node)"
  ok "使用本机 Node $("$NODE_BIN" -v)($NODE_BIN)"
else
  for d in "$TOOLCHAIN"/node-v"$NODE_MAJOR".*; do
    [ -x "$d/bin/node" ] && [ "$(node_major_of "$d/bin/node")" = "$NODE_MAJOR" ] && NODE_BIN="$d/bin/node"
  done
  if [ -z "$NODE_BIN" ]; then
    info "本机没有 Node $NODE_MAJOR,下载官方 Node $NODE_MAJOR 到 $TOOLCHAIN(不改系统)"
    node_ver="$(curl -fsSL "$NODE_DIST/index.json" | tr -d ' \n' | grep -o '"version":"v'"$NODE_MAJOR"'\.[0-9]*\.[0-9]*"' | head -1 | cut -d'"' -f4)"
    [ -n "$node_ver" ] || fail "无法从 nodejs.org 解析 Node $NODE_MAJOR 版本"
    node_pkg="node-${node_ver}-${node_os}-${node_arch}.tar.gz"
    tmp="$(mktemp -d "${TMPDIR:-/tmp}/saydo-node.XXXXXX")"
    curl -fsSL -o "$tmp/$node_pkg" "$NODE_DIST/$node_ver/$node_pkg"
    curl -fsSL -o "$tmp/SHASUMS256.txt" "$NODE_DIST/$node_ver/SHASUMS256.txt"
    expected="$(grep " $node_pkg\$" "$tmp/SHASUMS256.txt" | cut -d' ' -f1)"
    [ -n "$expected" ] || fail "SHASUMS256.txt 里没有 $node_pkg"
    actual="$(sha256_of "$tmp/$node_pkg")"
    [ "$actual" = "$expected" ] || fail "Node 下载校验失败:$actual != $expected"
    tar -xzf "$tmp/$node_pkg" -C "$TOOLCHAIN"
    rm -rf "$tmp"
    NODE_BIN="$TOOLCHAIN/node-${node_ver}-${node_os}-${node_arch}/bin/node"
    [ -x "$NODE_BIN" ] || fail "Node 解压后未找到 $NODE_BIN"
  fi
  ok "使用 toolchain Node $("$NODE_BIN" -v)($NODE_BIN)"
fi
NODE_DIR="$(cd "$(dirname "$NODE_BIN")" && pwd)"
NPM_CLI="$NODE_DIR/../lib/node_modules/npm/bin/npm-cli.js"
[ -f "$NPM_CLI" ] || NPM_CLI="$(cd "$NODE_DIR/.." && pwd)/lib/node_modules/npm/bin/npm-cli.js"
[ -f "$NPM_CLI" ] || fail "找不到与 Node 配套的 npm:$NPM_CLI"

# 2. 下载 SayDo CLI 包(固定版本 + SHA-256 校验),装进用户目录内的独立 prefix。
tgz="$TOOLCHAIN/saydo-cli-${SAYDO_VERSION}.tgz"
used_mirror=0
if [ ! -f "$tgz" ] || [ "$(sha256_of "$tgz")" != "$SAYDO_TGZ_SHA256" ]; then
  rm -f "$tgz.part"
  if [ "${SAYDO_INSTALL_MIRROR:-0}" != "1" ] && curl -fsSL --connect-timeout 10 -o "$tgz.part" "$SAYDO_TGZ_URL"; then
    info "已从 GitHub Release 下载 SayDo CLI ${SAYDO_VERSION}"
  else
    info "GitHub Release 不可达或已指定镜像,改用官网镜像下载 SayDo CLI ${SAYDO_VERSION}"
    rm -f "$tgz.part"
    curl -fsSL --connect-timeout 20 -o "$tgz.part" "$SAYDO_TGZ_MIRROR_URL"
    used_mirror=1
  fi
  mv "$tgz.part" "$tgz"
fi
actual="$(sha256_of "$tgz")"
[ "$actual" = "$SAYDO_TGZ_SHA256" ] || fail "SayDo 包校验失败:$actual != $SAYDO_TGZ_SHA256"
ok "SayDo CLI ${SAYDO_VERSION} 包校验通过"
info "安装到 $PREFIX(npm install --global --prefix,不需要 sudo)"
# 依赖里的 better-sqlite3 预构建二进制默认从 GitHub 下载;GitHub 不可达(已回退镜像)时改用 npmmirror 的同名镜像。
if [ "$used_mirror" = "1" ] && [ -z "${npm_config_better_sqlite3_binary_host_mirror:-}" ]; then
  export npm_config_better_sqlite3_binary_host_mirror="$BETTER_SQLITE3_MIRROR"
fi
if [ -n "${SAYDO_INSTALL_NPM_REGISTRY:-}" ]; then
  export npm_config_registry="$SAYDO_INSTALL_NPM_REGISTRY"
fi
PATH="$NODE_DIR:$PATH" "$NODE_BIN" "$NPM_CLI" install --global --prefix "$PREFIX" --no-fund --no-audit --loglevel=error "$tgz"
CLI_MJS="$PREFIX/lib/node_modules/@saydo/cli/dist/cli.mjs"
[ -f "$CLI_MJS" ] || fail "安装后未找到 $CLI_MJS"

# 3. 启动器:固定用上面选定的 Node,不依赖当时 PATH 上是哪个 node。
cat > "$BIN_DIR/saydo" <<EOF
#!/bin/sh
# SayDo 启动器(由 install.sh 生成;重新运行 install.sh 可重建)
export PATH="$NODE_DIR:\$PATH"
exec "$NODE_BIN" "$CLI_MJS" "\$@"
EOF
chmod +x "$BIN_DIR/saydo"
"$BIN_DIR/saydo" status >/dev/null 2>&1 || true
ok "已安装:$BIN_DIR/saydo"

# 4. PATH:默认在 shell 启动文件追加一行(带 "# saydo" 标记;整行精确匹配已存在则跳过,可重复执行);
#    SAYDO_INSTALL_NO_MODIFY_PATH=1 跳过。路径一律加引号,HOME 含空格也安全。
append_path_line() {
  rc_file="$1"
  rc_line="$2"
  if [ -f "$rc_file" ] && grep -Fxq -- "$rc_line" "$rc_file"; then
    return 0
  fi
  mkdir -p "$(dirname "$rc_file")"
  printf '\n%s\n' "$rc_line" >> "$rc_file"
  ok "已把 $BIN_DIR 写入 $rc_file(下次打开终端生效)"
}
if [ "${SAYDO_INSTALL_NO_MODIFY_PATH:-0}" != "1" ]; then
  shell_name="$(basename "${SHELL:-sh}")"
  posix_line="export PATH=\"$BIN_DIR:\$PATH\" # saydo"
  case "$shell_name" in
    zsh) append_path_line "$HOME/.zshrc" "$posix_line" ;;
    bash) append_path_line "$HOME/.bashrc" "$posix_line"; append_path_line "$HOME/.bash_profile" "$posix_line" ;;
    fish) append_path_line "$HOME/.config/fish/config.fish" "set -gx PATH \"$BIN_DIR\" \$PATH # saydo" ;;
    *) append_path_line "$HOME/.profile" "$posix_line" ;;
  esac
fi

printf '\n'
ok "安装完成。启动:"
printf '    %s up\n' "$BIN_DIR/saydo"
printf '  新终端里可直接:saydo up(浏览器会打开 http://localhost:47100);远程终端加 --no-open;Ctrl+C 优雅停止。\n'
printf '  该包只含 daemon 与 Web 控制台;语音 pipeline 与系统常驻不在其中。\n'
if [ "${SAYDO_INSTALL_RUN:-0}" = "1" ]; then
  exec "$BIN_DIR/saydo" up
fi
