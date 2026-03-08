#!/bin/bash

# Nstbrowser CLI 手动验证脚本
# 用于验证所有 CLI 命令是否正常工作
#
# 使用方法：
#   export NST_API_KEY=your-api-key
#   export NST_HOST=127.0.0.1
#   export NST_PORT=8848
#   bash test/nstbrowser-cli-manual.sh

set -e

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_success() {
    echo -e "${GREEN}✓${NC} $1"
}

echo_error() {
    echo -e "${RED}✗${NC} $1"
}

echo_info() {
    echo -e "${YELLOW}→${NC} $1"
}

# 检查环境变量
if [ -z "$NST_API_KEY" ]; then
    echo_error "NST_API_KEY environment variable is not set"
    echo "Please set it with: export NST_API_KEY=your-api-key"
    exit 1
fi

echo_info "Starting Nstbrowser CLI validation tests..."
echo ""

# 测试计数器
TOTAL=0
PASSED=0
FAILED=0

run_test() {
    local test_name="$1"
    local command="$2"
    
    TOTAL=$((TOTAL + 1))
    echo_info "Test $TOTAL: $test_name"
    
    if eval "$command" > /dev/null 2>&1; then
        echo_success "PASSED"
        PASSED=$((PASSED + 1))
    else
        echo_error "FAILED: $command"
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

# ==================== 浏览器管理测试 ====================

echo "=== Browser Management Tests ==="
echo ""

run_test "List browsers" \
    "nstbrowser-ai-agent nst browser list"

# 创建测试配置文件
echo_info "Creating test profile..."
TEST_PROFILE_NAME="cli-test-$(date +%s)"
nstbrowser-ai-agent nst profile create "$TEST_PROFILE_NAME" > /tmp/nst_profile_create.json 2>&1

if [ $? -eq 0 ]; then
    # 从输出中提取 profileId（假设 JSON 格式）
    TEST_PROFILE_ID=$(cat /tmp/nst_profile_create.json | grep -o '"profileId":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$TEST_PROFILE_ID" ]; then
        echo_success "Test profile created: $TEST_PROFILE_ID"
        
        run_test "Start browser" \
            "nstbrowser-ai-agent nst browser start $TEST_PROFILE_ID"
        
        sleep 2
        
        run_test "Stop browser" \
            "nstbrowser-ai-agent nst browser stop $TEST_PROFILE_ID"
    else
        echo_error "Failed to extract profile ID"
    fi
else
    echo_error "Failed to create test profile"
fi

run_test "Stop all browsers" \
    "nstbrowser-ai-agent nst browser stop-all"

echo ""

# ==================== 配置文件管理测试 ====================

echo "=== Profile Management Tests ==="
echo ""

run_test "List profiles" \
    "nstbrowser-ai-agent nst profile list"

run_test "Create profile with proxy" \
    "nstbrowser-ai-agent nst profile create cli-test-proxy-$(date +%s) --proxy-host proxy.example.com --proxy-port 8080 --proxy-type http"

if [ -n "$TEST_PROFILE_ID" ]; then
    run_test "Delete profile" \
        "nstbrowser-ai-agent nst profile delete $TEST_PROFILE_ID"
fi

echo ""

# ==================== 代理管理测试 ====================

echo "=== Proxy Management Tests ==="
echo ""

# 创建新的测试配置文件用于代理测试
TEST_PROXY_PROFILE="cli-test-proxy-$(date +%s)"
nstbrowser-ai-agent nst profile create "$TEST_PROXY_PROFILE" > /tmp/nst_proxy_profile.json 2>&1
TEST_PROXY_PROFILE_ID=$(cat /tmp/nst_proxy_profile.json | grep -o '"profileId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TEST_PROXY_PROFILE_ID" ]; then
    run_test "Update proxy" \
        "nstbrowser-ai-agent nst profile proxy update $TEST_PROXY_PROFILE_ID --host proxy.example.com --port 8080 --type http"
    
    run_test "Reset proxy" \
        "nstbrowser-ai-agent nst profile proxy reset $TEST_PROXY_PROFILE_ID"
    
    # 清理
    nstbrowser-ai-agent nst profile delete "$TEST_PROXY_PROFILE_ID" > /dev/null 2>&1
fi

echo ""

# ==================== 标签管理测试 ====================

echo "=== Tags Management Tests ==="
echo ""

run_test "List tags" \
    "nstbrowser-ai-agent nst profile tags list"

# 创建测试配置文件用于标签测试
TEST_TAG_PROFILE="cli-test-tag-$(date +%s)"
nstbrowser-ai-agent nst profile create "$TEST_TAG_PROFILE" > /tmp/nst_tag_profile.json 2>&1
TEST_TAG_PROFILE_ID=$(cat /tmp/nst_tag_profile.json | grep -o '"profileId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TEST_TAG_PROFILE_ID" ]; then
    run_test "Create tag" \
        "nstbrowser-ai-agent nst profile tags create $TEST_TAG_PROFILE_ID test-tag"
    
    run_test "Clear tags" \
        "nstbrowser-ai-agent nst profile tags clear $TEST_TAG_PROFILE_ID"
    
    # 清理
    nstbrowser-ai-agent nst profile delete "$TEST_TAG_PROFILE_ID" > /dev/null 2>&1
fi

echo ""

# ==================== 分组管理测试 ====================

echo "=== Groups Management Tests ==="
echo ""

run_test "List groups" \
    "nstbrowser-ai-agent nst profile groups list"

echo ""

# ==================== 数据清理测试 ====================

echo "=== Data Cleanup Tests ==="
echo ""

# 创建测试配置文件用于清理测试
TEST_CLEANUP_PROFILE="cli-test-cleanup-$(date +%s)"
nstbrowser-ai-agent nst profile create "$TEST_CLEANUP_PROFILE" > /tmp/nst_cleanup_profile.json 2>&1
TEST_CLEANUP_PROFILE_ID=$(cat /tmp/nst_cleanup_profile.json | grep -o '"profileId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TEST_CLEANUP_PROFILE_ID" ]; then
    run_test "Clear cache" \
        "nstbrowser-ai-agent nst profile cache clear $TEST_CLEANUP_PROFILE_ID"
    
    run_test "Clear cookies" \
        "nstbrowser-ai-agent nst profile cookies clear $TEST_CLEANUP_PROFILE_ID"
    
    # 清理
    nstbrowser-ai-agent nst profile delete "$TEST_CLEANUP_PROFILE_ID" > /dev/null 2>&1
fi

echo ""

# ==================== Provider 集成测试 ====================

echo "=== Provider Integration Tests ==="
echo ""

# 创建持久化配置文件
TEST_PROVIDER_PROFILE="cli-test-provider-$(date +%s)"
nstbrowser-ai-agent nst profile create "$TEST_PROVIDER_PROFILE" > /tmp/nst_provider_profile.json 2>&1
TEST_PROVIDER_PROFILE_ID=$(cat /tmp/nst_provider_profile.json | grep -o '"profileId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TEST_PROVIDER_PROFILE_ID" ]; then
    echo_info "Testing provider integration with profile: $TEST_PROVIDER_PROFILE_ID"
    
    # 设置环境变量
    export NST_PROFILE="$TEST_PROVIDER_PROFILE_ID"
    
    # 测试 provider 启动（这会实际启动浏览器）
    echo_info "Launching browser with -p nst..."
    if nstbrowser-ai-agent -p nst launch > /dev/null 2>&1; then
        echo_success "Browser launched successfully"
        
        # 测试基本导航
        echo_info "Testing navigation..."
        if nstbrowser-ai-agent navigate --url https://example.com > /dev/null 2>&1; then
            echo_success "Navigation successful"
        else
            echo_error "Navigation failed"
        fi
        
        # 关闭浏览器
        echo_info "Closing browser..."
        nstbrowser-ai-agent close > /dev/null 2>&1
        echo_success "Browser closed"
    else
        echo_error "Failed to launch browser with provider"
    fi
    
    # 清理
    unset NST_PROFILE
    nstbrowser-ai-agent nst profile delete "$TEST_PROVIDER_PROFILE_ID" > /dev/null 2>&1
fi

echo ""

# ==================== 测试总结 ====================

echo "==================================="
echo "Test Summary"
echo "==================================="
echo "Total tests: $TOTAL"
echo_success "Passed: $PASSED"
if [ $FAILED -gt 0 ]; then
    echo_error "Failed: $FAILED"
else
    echo "Failed: 0"
fi
echo ""

if [ $FAILED -eq 0 ]; then
    echo_success "All tests passed! ✨"
    exit 0
else
    echo_error "Some tests failed. Please check the output above."
    exit 1
fi
