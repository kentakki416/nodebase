#!/bin/bash
set -euo pipefail

# ============================================
# copy-template.sh
# project-template を新しいプロジェクトにコピーする
#
# 注意:
#   新規プロジェクト作成用のスクリプトです。
#   コピー先に同名ファイルが存在する場合は上書きされます。
#   (必要な場合は --ignore-existing や --update オプションを検討してください)
# ============================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

usage() {
  cat <<EOF
Usage: $(basename "$0") <destination-path> [project-name]

Arguments:
  destination-path  コピー先ディレクトリのパス
  project-name      プロジェクト名（省略時はディレクトリ名を使用）

Examples:
  $(basename "$0") ../my-new-app
  $(basename "$0") ~/workspace/my-new-app my-new-app
  $(basename "$0") ../my-new-app my-new-app
EOF
  exit 1
}

if [ -z "${1:-}" ]; then
  usage
fi

DEST="$1"
PROJECT_NAME="${2:-$(basename "$DEST")}"

# コピー先が既に存在する場合の確認
if [ -d "$DEST" ] && [ "$(ls -A "$DEST" 2>/dev/null)" ]; then
  echo -e "${YELLOW}Warning: $DEST は既に存在し、空ではありません。${NC}"
  read -p "上書きしますか？ (y/N): " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "中止しました。"
    exit 1
  fi
fi

echo -e "${GREEN}Copying template to: $DEST${NC}"
echo "Project name: $PROJECT_NAME"
echo ""

rsync -av \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.turbo' \
  --exclude='dist' \
  --exclude='.next' \
  --exclude='.expo' \
  --exclude='.terraform' \
  --exclude='*.tfstate' \
  --exclude='*.tfstate.backup' \
  --exclude='.terraform.lock.hcl' \
  --exclude='*.tfvars' \
  --exclude='.env.keys' \
  --exclude='secret' \
  --exclude='.secret' \
  --exclude='.DS_Store' \
  --exclude='*.tsbuildinfo' \
  --exclude='next-env.d.ts' \
  --exclude='expo-env.d.ts' \
  --exclude='coverage' \
  --exclude='build' \
  --exclude='web-build' \
  --exclude='*.log' \
  --exclude='pnpm-lock.yaml' \
  --exclude='.vercel' \
  --exclude='.vscode' \
  --exclude='.idea' \
  --exclude='.serena' \
  "$TEMPLATE_DIR/" "$DEST/"

# package.json のプロジェクト名を置換
if [ -f "$DEST/package.json" ]; then
  if command -v sed &>/dev/null; then
    sed -i '' "s/\"name\": \".*\"/\"name\": \"$PROJECT_NAME\"/" "$DEST/package.json" 2>/dev/null || \
    sed -i "s/\"name\": \".*\"/\"name\": \"$PROJECT_NAME\"/" "$DEST/package.json"
  fi
fi

echo ""
echo -e "${GREEN}Done!${NC}"
echo ""
echo "Next steps:"
echo "  cd $DEST"
echo "  git init"
echo "  pnpm install"
echo "  pnpm dev"
