#!/bin/sh
set -eu
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH
case "${SSH_ORIGINAL_COMMAND-}" in
  'deploy '*) sha=${SSH_ORIGINAL_COMMAND#deploy } ;;
  *) exit 64 ;;
esac
case "$sha" in ''|*[!0-9a-f]*) exit 64;; esac
[ "${#sha}" -eq 40 ] || exit 64
exec sudo -n /usr/local/bin/janus-deploy "$sha"
