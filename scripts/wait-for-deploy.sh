#!/usr/bin/env bash
# Follows CI for a commit (default: HEAD) until the change is live on the server, or says what failed.
# Uses GitHub's REST API through `gh` when it's available (it is in Claude Code web sessions), else plain curl.
# Usage: scripts/wait-for-deploy.sh [commit]
set -euo pipefail
sha=$(git rev-parse "${1:-HEAD}")
repo=${CHUSAY_REPO:-roncanfil/chusay}
api() { if command -v gh > /dev/null; then gh api "$1"; else curl -fsS "https://api.github.com/$1"; fi; }
field() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d);console.log($1)})"; }

echo "Waiting for CI on ${sha:0:7}…"
for _ in $(seq 1 90); do # up to 15 minutes
  run=$(api "repos/$repo/actions/runs?head_sha=$sha&event=push&per_page=1" | field "JSON.stringify(r.workflow_runs[0] || null)")
  if [ "$run" != null ]; then
    status=$(echo "$run" | field "r.status")
    if [ "$status" = completed ]; then
      id=$(echo "$run" | field "r.id")
      jobs=$(api "repos/$repo/actions/runs/$id/jobs" | field "r.jobs.map(j => j.name + '=' + j.conclusion).join(' ')")
      echo "Jobs: $jobs"
      case " $jobs " in
        *" deploy=success "*) echo "LIVE: the server now runs ${sha:0:7}."; exit 0 ;;
        *"=failure "*|*"=cancelled "*|*"=timed_out "*) echo "FAILED: see $(echo "$run" | field "r.html_url")"; exit 1 ;;
        *" deploy=skipped "*) echo "Image published, but deploying isn't set up (DEPLOY_URL / SITE_URL)."; exit 0 ;;
        *) echo "CI finished without deploying: $(echo "$run" | field "r.html_url")"; exit 1 ;;
      esac
    fi
  fi
  sleep 10
done
echo "Still not done after 15 minutes: https://github.com/$repo/actions"; exit 1
