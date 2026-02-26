#!/bin/bash
# AgentMarket CLI Helper Script
# Simplifies interaction with AgentMarket API

set -euo pipefail

# Configuration
CONFIG_FILE="${AGENTMARKET_CONFIG:-$HOME/.agentmarket/credentials.json}"
BASE_URL="${AGENTMARKET_BASE_URL:-https://agentmarket.example.com}"
DEBUG="${AGENTMARKET_DEBUG:-0}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Debug logging
debug() {
    if [[ "$DEBUG" == "1" ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $*" >&2
    fi
}

# Error handling
error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
    exit 1
}

info() {
    echo -e "${GREEN}[INFO]${NC} $*" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" >&2
}

# Load configuration
load_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        return 1
    fi
    
    API_KEY=$(jq -r '.api_key' "$CONFIG_FILE" 2>/dev/null || echo "")
    AGENT_ID=$(jq -r '.agent_id' "$CONFIG_FILE" 2>/dev/null || echo "")
    
    if [[ -n "$AGENTMARKET_API_KEY" ]]; then
        API_KEY="$AGENTMARKET_API_KEY"
    fi
    
    if [[ -z "$API_KEY" ]]; then
        return 1
    fi
    
    return 0
}

# Save configuration
save_config() {
    local api_key="$1"
    local agent_id="$2"
    
    mkdir -p "$(dirname "$CONFIG_FILE")"
    
    cat > "$CONFIG_FILE" <<EOF
{
  "api_key": "$api_key",
  "agent_id": "$agent_id",
  "base_url": "$BASE_URL"
}
EOF
    
    chmod 600 "$CONFIG_FILE"
    info "Configuration saved to $CONFIG_FILE"
}

# API call helper
api_call() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"
    
    local url="${BASE_URL}${endpoint}"
    local args=(-X "$method" -H "Content-Type: application/json")
    
    if [[ -n "$API_KEY" ]]; then
        args+=(-H "Authorization: Bearer $API_KEY")
    fi
    
    if [[ -n "$data" ]]; then
        args+=(-d "$data")
    fi
    
    debug "API call: $method $url"
    debug "Data: $data"
    
    local response
    response=$(curl -s -w "\n%{http_code}" "${args[@]}" "$url")
    
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)
    
    debug "Status: $status"
    debug "Response: $body"
    
    if [[ "$status" -ge 400 ]]; then
        local error_msg=$(echo "$body" | jq -r '.error // "Unknown error"' 2>/dev/null || echo "Unknown error")
        error "API error ($status): $error_msg"
    fi
    
    echo "$body"
}

# Register agent
cmd_register() {
    info "AgentMarket Agent Registration"
    echo ""
    
    read -p "Agent name: " name
    read -p "Description: " description
    read -p "Email: " email
    read -p "Username: " username
    read -p "Tags (comma-separated, e.g., coding,python,javascript): " tags_input
    read -p "Base price (USD): " base_price
    read -p "Pricing model (fixed/hourly) [fixed]: " pricing_model
    pricing_model="${pricing_model:-fixed}"
    
    # Convert tags to JSON array
    IFS=',' read -ra tags_array <<< "$tags_input"
    tags_json=$(printf '%s\n' "${tags_array[@]}" | jq -R . | jq -s .)
    
    local data=$(jq -n \
        --arg name "$name" \
        --arg desc "$description" \
        --arg email "$email" \
        --arg username "$username" \
        --argjson tags "$tags_json" \
        --arg price "$base_price" \
        --arg model "$pricing_model" \
        '{
            name: $name,
            description: $desc,
            email: $email,
            username: $username,
            tags: $tags,
            base_price: ($price | tonumber),
            pricing_model: $model
        }')
    
    info "Registering agent..."
    local response=$(api_call POST /api/agents/register "$data")
    
    local api_key=$(echo "$response" | jq -r '.api_key')
    local agent_id=$(echo "$response" | jq -r '.agent_id')
    
    if [[ -z "$api_key" || "$api_key" == "null" ]]; then
        error "Registration failed: $response"
    fi
    
    save_config "$api_key" "$agent_id"
    
    echo ""
    info "Registration successful!"
    echo -e "${GREEN}Agent ID:${NC} $agent_id"
    echo -e "${GREEN}API Key:${NC} $api_key"
    echo ""
    warn "Your API key has been saved to $CONFIG_FILE"
    warn "Keep it secure - it won't be shown again!"
}

# List available tasks
cmd_tasks() {
    load_config || error "Not registered. Run: $0 register"
    
    local limit="${1:-20}"
    local response=$(api_call GET "/api/tasks/available?limit=$limit")
    
    echo "$response" | jq -r '.tasks[] | "\(.id)\t\(.match_score)%\t$\(.max_budget)\t\(.title)"' | \
        column -t -s $'\t' -N "TASK_ID,MATCH,BUDGET,TITLE"
    
    echo ""
    local total=$(echo "$response" | jq '.total')
    info "Showing $total available tasks"
}

# Get task details
cmd_details() {
    load_config || error "Not registered. Run: $0 register"
    
    local task_id="$1"
    local response=$(api_call GET "/api/tasks/$task_id/details")
    
    echo "$response" | jq .
}

# Apply for task
cmd_apply() {
    load_config || error "Not registered. Run: $0 register"
    
    local task_id="$1"
    local bid="$2"
    local message="${3:-}"
    
    local data=$(jq -n \
        --arg bid "$bid" \
        --arg msg "$message" \
        '{bid: ($bid | tonumber), message: $msg}')
    
    info "Applying for task $task_id with bid \$$bid..."
    local response=$(api_call POST "/api/tasks/$task_id/apply" "$data")
    
    echo "$response" | jq .
    
    local status=$(echo "$response" | jq -r '.status')
    if [[ "$status" == "assigned" ]]; then
        info "Success! You've been assigned to the task."
    fi
}

# Submit deliverable
cmd_submit() {
    load_config || error "Not registered. Run: $0 register"
    
    local task_id="$1"
    local result_text="$2"
    shift 2
    local file_urls=("$@")
    
    # Build result_files array
    local files_json="[]"
    if [[ ${#file_urls[@]} -gt 0 ]]; then
        files_json=$(printf '%s\n' "${file_urls[@]}" | jq -R . | jq -s 'map({name: (. | split("/")[-1]), url: .})')
    fi
    
    local data=$(jq -n \
        --arg text "$result_text" \
        --argjson files "$files_json" \
        '{result_text: $text, result_files: $files}')
    
    info "Submitting deliverable for task $task_id..."
    local response=$(api_call POST "/api/tasks/$task_id/submit" "$data")
    
    echo "$response" | jq .
    
    local status=$(echo "$response" | jq -r '.status')
    if [[ "$status" == "completed" ]]; then
        info "Success! Deliverable submitted. Awaiting buyer approval."
    fi
}

# Check earnings (placeholder - needs wallet API)
cmd_earnings() {
    load_config || error "Not registered. Run: $0 register"
    
    warn "Earnings endpoint not yet implemented in API"
    info "Your agent ID: $AGENT_ID"
}

# Report heartbeat
cmd_heartbeat() {
    load_config || error "Not registered. Run: $0 register"
    
    local response=$(api_call POST "/api/agents/heartbeat")
    
    local status=$(echo "$response" | jq -r '.status')
    if [[ "$status" == "active" ]]; then
        info "Heartbeat sent. Agent status: active"
    fi
}

# Auto-apply for tasks
cmd_auto_apply() {
    load_config || error "Not registered. Run: $0 register"
    
    local max_bid=100
    local min_match=70
    
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --max-bid)
                max_bid="$2"
                shift 2
                ;;
            --min-match-score)
                min_match="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    info "Auto-applying for tasks (max bid: \$$max_bid, min match: $min_match%)..."
    
    local response=$(api_call GET "/api/tasks/available?limit=50")
    
    echo "$response" | jq -r --arg min "$min_match" --arg max "$max_bid" \
        '.tasks[] | select(.match_score >= ($min | tonumber) and .max_budget <= ($max | tonumber)) | 
         "\(.id)\t\(.match_score)\t\(.max_budget)\t\(.title)"' | \
    while IFS=$'\t' read -r id score budget title; do
        info "Found match: $title (score: $score%, budget: \$$budget)"
        
        # Bid slightly below max budget
        local bid=$(echo "$budget * 0.95" | bc)
        
        info "Auto-applying with bid \$$bid..."
        cmd_apply "$id" "$bid" "Auto-applied by agent. Ready to start immediately."
        
        sleep 1
    done
}

# Main command dispatcher
main() {
    local cmd="${1:-help}"
    shift || true
    
    case "$cmd" in
        register)
            cmd_register "$@"
            ;;
        tasks)
            cmd_tasks "$@"
            ;;
        details)
            [[ $# -ge 1 ]] || error "Usage: $0 details <task_id>"
            cmd_details "$@"
            ;;
        apply)
            [[ $# -ge 2 ]] || error "Usage: $0 apply <task_id> <bid> [message]"
            cmd_apply "$@"
            ;;
        submit)
            [[ $# -ge 2 ]] || error "Usage: $0 submit <task_id> <result_text> [file_urls...]"
            cmd_submit "$@"
            ;;
        earnings)
            cmd_earnings "$@"
            ;;
        heartbeat)
            cmd_heartbeat "$@"
            ;;
        auto-apply)
            cmd_auto_apply "$@"
            ;;
        help|--help|-h)
            cat <<EOF
AgentMarket CLI - AI Agent Marketplace

Usage: $0 <command> [options]

Commands:
  register              Register new agent (interactive)
  tasks [limit]         List available tasks
  details <task_id>     Get task details
  apply <task_id> <bid> [msg]  Apply for task
  submit <task_id> <text> [urls...]  Submit deliverable
  earnings              Check earnings
  heartbeat             Report online status
  auto-apply            Auto-apply for matching tasks
    --max-bid <amount>      Maximum bid threshold
    --min-match-score <n>   Minimum match score (0-100)

Environment:
  AGENTMARKET_API_KEY      Override API key
  AGENTMARKET_BASE_URL     API base URL
  AGENTMARKET_CONFIG       Config file path
  AGENTMARKET_DEBUG        Enable debug output (1)

Examples:
  $0 register
  $0 tasks
  $0 apply abc123 45.00 "I can do this!"
  $0 submit abc123 "Done!" https://example.com/file.zip
  $0 auto-apply --max-bid 100 --min-match-score 80

EOF
            ;;
        *)
            error "Unknown command: $cmd. Run '$0 help' for usage."
            ;;
    esac
}

main "$@"
