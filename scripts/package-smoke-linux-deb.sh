#!/usr/bin/env bash
set -euo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${EVIDENCE_ROOT:?EVIDENCE_ROOT is required}"
: "${EXPECTED_ARCHITECTURE:?EXPECTED_ARCHITECTURE is required}"
: "${MATRIX_LABEL:?MATRIX_LABEL is required}"
: "${PACKAGE_KIND:?PACKAGE_KIND is required}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"

package_installed="false"
temp_root=$(mktemp -d "$RUNNER_TEMP/deepseek-harness-deb.XXXXXX")
node_originals=()
node_hidden=()

restore_system_node_candidates() {
  local restore_failures=0
  local index
  for ((index=${#node_originals[@]}-1; index>=0; index--)); do
    if [[ (! -e "${node_hidden[index]}" && ! -L "${node_hidden[index]}") || -e "${node_originals[index]}" || -L "${node_originals[index]}" ]]; then
      restore_failures=$((restore_failures + 1))
    elif ! sudo mv -- "${node_hidden[index]}" "${node_originals[index]}" 2>/dev/null; then
      restore_failures=$((restore_failures + 1))
    fi
  done
  node_originals=()
  node_hidden=()
  if (( restore_failures != 0 )); then
    printf 'node quarantine cleanup failed (%s candidates)\n' "$restore_failures" >&2
    return 1
  fi
}

hide_system_node_candidates() {
  local index=0 candidate hidden
  for candidate in "$@"; do
    index=$((index + 1))
    hidden="${candidate}.deepseek-smoke-${GITHUB_RUN_ID}-${BASHPID:-$$}-${index}"
    if [[ -e "$hidden" || -L "$hidden" ]]; then
      printf 'node quarantine destination already exists (candidate %s)\n' "$index" >&2
      return 1
    fi
    if ! sudo mv -- "$candidate" "$hidden" 2>/dev/null; then
      printf 'failed to quarantine Node candidate %s\n' "$index" >&2
      return 1
    fi
    node_originals+=("$candidate")
    node_hidden+=("$hidden")
  done
}

cleanup() {
  local original_exit=$?
  local cleanup_exit=0
  set +e
  restore_system_node_candidates || cleanup_exit=$?
  if [[ "$package_installed" == "true" ]] || dpkg-query -W deepseek-harness-code >/dev/null 2>&1; then
    sudo dpkg --purge deepseek-harness-code || cleanup_exit=$?
  fi
  if dpkg-query -W -f='${Status}\n' deepseek-harness-code 2>/dev/null | grep -q .; then
    printf 'cleanup failed: deepseek-harness-code remains installed\n' >&2
    cleanup_exit=1
  fi
  rm -rf "$temp_root" || cleanup_exit=$?
  if (( cleanup_exit != 0 )); then
    printf 'cleanup failed with exit code %s\n' "$cleanup_exit" >&2
  fi
  if (( original_exit != 0 )); then
    exit "$original_exit"
  fi
  exit "$cleanup_exit"
}
trap cleanup EXIT

mkdir -p "$EVIDENCE_ROOT"
deb_filename_arch="$EXPECTED_ARCHITECTURE"
[[ "$deb_filename_arch" == x64 ]] && deb_filename_arch=amd64
deb=$(find release -maxdepth 1 -type f -name "DeepSeek-Harness-Code-*-linux-${deb_filename_arch}.deb" -print)
[[ "$(wc -l <<< "$deb")" -eq 1 ]]
deb=$(realpath "$deb")
expected_deb_arch=amd64
[[ "$EXPECTED_ARCHITECTURE" == arm64 ]] && expected_deb_arch=arm64
[[ "$(dpkg-deb -f "$deb" Package)" == deepseek-harness-code ]]
[[ -n "$(dpkg-deb -f "$deb" Version)" ]]
[[ "$(dpkg-deb -f "$deb" Architecture)" == "$expected_deb_arch" ]]
sudo apt-get update
sudo apt-get install -y "$deb"
package_installed="true"
[[ "$(dpkg-query -W -f='${Status}' deepseek-harness-code)" == "install ok installed" ]]
desktop=$(dpkg-query -L deepseek-harness-code | awk '/\/usr\/share\/applications\/.*\.desktop$/ { print; exit }')
[[ -n "$desktop" && -f "$desktop" ]]
executable=$(command -v deepseek-harness-code)
[[ -n "$executable" && -x "$executable" ]]
executable=$(realpath "$executable")
install_dir=$(dirname "$executable")
resources="$install_dir/resources"
[[ -d "$resources" ]]
hash=$(sha256sum "$deb" | cut -d' ' -f1)

xvfb-run -a pnpm smoke:package -- \
  --scenario runtime \
  --matrix-label "$MATRIX_LABEL" \
  --package-kind "$PACKAGE_KIND" \
  --expected-architecture "$EXPECTED_ARCHITECTURE" \
  --runner-architecture "$EXPECTED_ARCHITECTURE" \
  --artifact-filename "$(basename "$deb")" \
  --executable "$executable" \
  --resources "$resources" \
  --inventory "$install_dir" \
  --artifact "$deb" \
  --artifact-sha256 "$hash" \
  --evidence-root "$EVIDENCE_ROOT" \
  --evidence "$EVIDENCE_ROOT/smoke-evidence-linux-deb.json"

node_candidate_output=$(node scripts/smoke-packaged-runtime.mjs --print-node-quarantine-paths) || {
  printf 'node quarantine planning failed\n' >&2
  exit 1
}
node_candidates=()
if [[ -n "$node_candidate_output" ]]; then
  while IFS= read -r candidate; do node_candidates+=("$candidate"); done <<< "$node_candidate_output"
fi
hide_system_node_candidates "${node_candidates[@]}"

xvfb-run -a pnpm smoke:package -- \
  --scenario node-required \
  --matrix-label "$MATRIX_LABEL" \
  --package-kind "$PACKAGE_KIND" \
  --expected-architecture "$EXPECTED_ARCHITECTURE" \
  --runner-architecture "$EXPECTED_ARCHITECTURE" \
  --artifact-filename "$(basename "$deb")" \
  --executable "$executable" \
  --resources "$resources" \
  --inventory "$install_dir" \
  --artifact "$deb" \
  --artifact-sha256 "$hash" \
  --evidence-root "$EVIDENCE_ROOT" \
  --evidence "$EVIDENCE_ROOT/smoke-evidence-linux-deb-node-required.json"
