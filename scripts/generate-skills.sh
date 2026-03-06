#!/bin/bash

# Agent Browser - Skills 生成脚本
# 用于从项目源码生成标准的 agent skills 目录

set -e

echo "=== Agent Browser Skills 生成器 ==="
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 目标目录
SKILLS_DIR="$PROJECT_ROOT/skills/nstbrowser-ai-agent"
OUTPUT_DIR="${1:-$PROJECT_ROOT/.cursor-skills}"

echo -e "${BLUE}项目根目录:${NC} $PROJECT_ROOT"
echo -e "${BLUE}源 Skills 目录:${NC} $SKILLS_DIR"
echo -e "${BLUE}输出目录:${NC} $OUTPUT_DIR"
echo ""

# 检查源目录是否存在
if [ ! -d "$SKILLS_DIR" ]; then
  echo -e "${YELLOW}错误: Skills 源目录不存在: $SKILLS_DIR${NC}"
  exit 1
fi

# 创建输出目录
echo -e "${GREEN}✓${NC} 创建输出目录..."
mkdir -p "$OUTPUT_DIR/nstbrowser-ai-agent"

# 复制核心 SKILL.md
echo -e "${GREEN}✓${NC} 复制核心 SKILL.md..."
cp "$SKILLS_DIR/SKILL.md" "$OUTPUT_DIR/nstbrowser-ai-agent/"

# 复制 references 目录（如果存在）
if [ -d "$SKILLS_DIR/references" ]; then
  echo -e "${GREEN}✓${NC} 复制 references 目录..."
  cp -r "$SKILLS_DIR/references" "$OUTPUT_DIR/nstbrowser-ai-agent/"
fi

# 复制 templates 目录（如果存在）
if [ -d "$SKILLS_DIR/templates" ]; then
  echo -e "${GREEN}✓${NC} 复制 templates 目录..."
  cp -r "$SKILLS_DIR/templates" "$OUTPUT_DIR/nstbrowser-ai-agent/"
fi

# 生成 README.md
echo -e "${GREEN}✓${NC} 生成 README.md..."
cat > "$OUTPUT_DIR/nstbrowser-ai-agent/README.md" << 'EOF'
# Agent Browser Skill

## 概述

nstbrowser-ai-agent 是一个强大的浏览器自动化工具，支持多种浏览器提供商，包括 Nstbrowser 指纹浏览器。

## 快速开始

### 环境设置

```bash
# 必需：设置 NST API Key（用于 Nstbrowser）
export NST_API_KEY="your-api-key"

# 可选：自定义配置
export NST_HOST="127.0.0.1"
export NST_PORT="8848"
```

### 基本命令

```bash
# Nstbrowser Profile 管理
nstbrowser-ai-agent nst profile list
nstbrowser-ai-agent nst profile create "my-profile"
nstbrowser-ai-agent nst profile delete <profile-id>

# 浏览器管理
nstbrowser-ai-agent nst browser list
nstbrowser-ai-agent nst browser start <profile-id>
nstbrowser-ai-agent nst browser stop <profile-id>
nstbrowser-ai-agent nst browser stop-all

# 浏览器自动化
nstbrowser-ai-agent -p nst open https://example.com
nstbrowser-ai-agent snapshot -i
nstbrowser-ai-agent screenshot output.png
nstbrowser-ai-agent close
```

## 文档

- **SKILL.md** - 完整的命令参考和功能说明
- **references/** - 深入的参考文档
- **templates/** - 可复用的脚本模板

## 更多信息

查看 [SKILL.md](SKILL.md) 获取完整文档。
EOF

# 生成环境变量模板
echo -e "${GREEN}✓${NC} 生成 .env.example..."
cat > "$OUTPUT_DIR/nstbrowser-ai-agent/.env.example" << 'EOF'
# Agent Browser 环境变量配置

# ==================== Nstbrowser 配置 ====================

# Nstbrowser API Key（必需）
NST_API_KEY=your-api-key-here

# Nstbrowser 服务器配置（可选）
NST_HOST=127.0.0.1
NST_PORT=8848

# 默认 Profile ID（可选）
# NST_PROFILE=your-default-profile-id

# ==================== Agent Browser 配置 ====================

# 调试模式（可选，默认：0）
NSTBROWSER_AI_AGENT_DEBUG=0

# 默认超时时间（可选，单位：毫秒）
# NSTBROWSER_AI_AGENT_DEFAULT_TIMEOUT=30000

# ==================== 安全配置 ====================

# 内容边界标记（可选，默认：0）
NSTBROWSER_AI_AGENT_CONTENT_BOUNDARIES=0

# 域名白名单（可选）
# NSTBROWSER_AI_AGENT_ALLOWED_DOMAINS=example.com,*.example.com

# 最大输出大小（可选）
# NSTBROWSER_AI_AGENT_MAX_OUTPUT=50000
EOF

# 生成顶层 README
echo -e "${GREEN}✓${NC} 生成顶层 README..."
cat > "$OUTPUT_DIR/README.md" << 'EOF'
# Agent Browser Skills

这是 nstbrowser-ai-agent 的标准 skills 目录，可用于 AI agent 集成。

## 使用方法

### 在 Cursor IDE 中使用

1. 复制此目录到您的项目：
   ```bash
   cp -r .cursor-skills /path/to/your-project/
   ```

2. 配置环境变量：
   ```bash
   cp nstbrowser-ai-agent/.env.example ~/.nstbrowser-ai-agent.env
   nano ~/.nstbrowser-ai-agent.env  # 填入您的配置
   source ~/.nstbrowser-ai-agent.env
   ```

3. 开始使用：
   ```bash
   nstbrowser-ai-agent nst profile list
   ```

### 在其他 IDE 中使用

参考 `nstbrowser-ai-agent/SKILL.md` 获取完整的命令参考和使用说明。

## 文档结构

```
nstbrowser-ai-agent/
├── SKILL.md           # 完整命令参考
├── README.md          # 快速开始
├── .env.example       # 环境变量模板
├── references/        # 深入参考文档
└── templates/         # 脚本模板
```

## 更多信息

- 项目主页: https://github.com/Nstbrowser/nstbrowser-ai-agent
- API 文档: https://apidocs.nstbrowser.io/
EOF

# 生成版本信息
VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}✓${NC} 生成版本信息..."
cat > "$OUTPUT_DIR/VERSION.txt" << EOF
Agent Browser Skills
Version: $VERSION
Generated: $(date '+%Y-%m-%d %H:%M:%S')
Source: $PROJECT_ROOT
EOF

echo ""
echo -e "${GREEN}=== 生成完成！ ===${NC}"
echo ""
echo "输出目录: $OUTPUT_DIR"
echo ""
echo "文件列表:"
find "$OUTPUT_DIR" -type f | sed 's|^|  |'
echo ""
echo -e "${BLUE}下一步:${NC}"
echo "1. 复制到您的项目: cp -r $OUTPUT_DIR /path/to/your-project/"
echo "2. 配置环境变量: cp $OUTPUT_DIR/nstbrowser-ai-agent/.env.example ~/.nstbrowser-ai-agent.env"
echo "3. 开始使用: nstbrowser-ai-agent nst profile list"
echo ""
