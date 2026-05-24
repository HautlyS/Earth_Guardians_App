#!/bin/bash
# Sideloadly IPA Signing Script
# This script helps with Sideloadly CLI usage for GitHub Actions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Sideloadly is installed
check_sideloadly() {
    if [ -d "/Applications/Sideloadly.app" ]; then
        log_info "Sideloadly is installed"
        return 0
    else
        log_warn "Sideloadly not found in /Applications"
        return 1
    fi
}

# Download Sideloadly
download_sideloadly() {
    log_info "Downloading Sideloadly..."
    
    local temp_dir=$(mktemp -d)
    cd "$temp_dir"
    
    curl -sL -o sideloadly.zip "https://github.com/SideloadlyiOS/Sideloadly/releases/download/continuous/Sideloadly-macOS.zip"
    
    if [ ! -f sideloadly.zip ]; then
        log_error "Failed to download Sideloadly"
        return 1
    fi
    
    unzip -o sideloadly.zip -d /Applications/
    rm -rf "$temp_dir"
    
    log_info "Sideloadly installed to /Applications"
    return 0
}

# Sign IPA with Sideloadly (GUI-based, may require manual intervention)
sign_ipa_sideloadly() {
    local ipa_file="$1"
    local apple_id="${2:-}"
    local app_password="${3:-}"
    
    if [ ! -f "$ipa_file" ]; then
        log_error "IPA file not found: $ipa_file"
        return 1
    fi
    
    log_info "Signing IPA: $ipa_file"
    log_warn "Sideloadly is a GUI application and may require manual interaction"
    log_info "For automated CI/CD, consider using:"
    log_info "  1. Xcode command line tools (xcodebuild)"
    log_info "  2. Apple Developer Portal for certificate-based signing"
    log_info "  3. Alternative tools like ios-app-signer or libimobiledevice"
    
    # Return info for manual signing
    echo "IPA ready for Sideloadly signing: $ipa_file"
    echo "Manual steps:"
    echo "  1. Open Sideloadly"
    echo "  2. Select the IPA file"
    echo "  3. Sign with your Apple ID"
    
    return 0
}

# Alternative: Sign using xcodebuild (for development)
sign_with_xcode() {
    local app_path="$1"
    local identity="${2:-}"
    
    if [ ! -d "$app_path" ]; then
        log_error "App bundle not found: $app_path"
        return 1
    fi
    
    log_info "Signing with Xcode: $app_path"
    
    # Find signing identity if not provided
    if [ -z "$identity" ]; then
        identity=$(security find-identity -v -p codesigning 2>/dev/null | grep -i "apple" | head -1 | awk '{print $2}')
    fi
    
    if [ -z "$identity" ]; then
        log_warn "No signing identity found. Building for simulator only."
        return 1
    fi
    
    codesign -s "$identity" -f "$app_path" 2>/dev/null || {
        log_error "Code signing failed"
        return 1
    }
    
    log_info "Successfully signed: $app_path"
    return 0
}

# Package as IPA
create_ipa() {
    local app_path="$1"
    local output_ipa="$2"
    
    if [ ! -d "$app_path" ]; then
        log_error "App bundle not found: $app_path"
        return 1
    fi
    
    log_info "Creating IPA: $output_ipa"
    
    # Remove existing IPA
    rm -f "$output_ipa"
    
    # Create temp directory
    local temp_dir=$(mktemp -d)
    mkdir -p "$temp_dir/Payload"
    
    # Copy app bundle
    cp -R "$app_path" "$temp_dir/Payload/"
    
    # Create ZIP and rename to IPA
    cd "$temp_dir"
    zip -r -q "$output_ipa" Payload
    mv "$output_ipa" "$(dirname $app_path)/"
    
    # Cleanup
    rm -rf "$temp_dir"
    
    log_info "IPA created: $output_ipa"
    return 0
}

# Main entry point
main() {
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        install)
            download_sideloadly
            ;;
        check)
            check_sideloadly
            ;;
        sign)
            sign_ipa_sideloadly "$@"
            ;;
        xcode-sign)
            sign_with_xcode "$@"
            ;;
        create-ipa)
            create_ipa "$@"
            ;;
        help|*)
            echo "Sideloadly CI Helper Script"
            echo ""
            echo "Usage: $0 <command> [options]"
            echo ""
            echo "Commands:"
            echo "  install       Download and install Sideloadly"
            echo "  check         Check if Sideloadly is installed"
            echo "  sign <ipa>    Sign IPA with Sideloadly (manual)"
            echo "  xcode-sign    Sign app bundle with Xcode"
            echo "  create-ipa    Create IPA from app bundle"
            echo "  help          Show this help"
            ;;
    esac
}

main "$@"
