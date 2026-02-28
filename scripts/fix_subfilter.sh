#!/bin/bash
# Add sub_filter to fix the UI pairing screen issue
# The sub_filter rewrites /health response: "paired":false → "paired":true
# This makes UI skip the pairing screen when require_pairing:false

# Find where to insert (after line 154, before "# Configure nginx")
for i in {155..165}; do
    if sed -n "${i}p" scripts/entrypoint.sh | grep -q "# Configure nginx"; then
        # Insert at this line
        sed -i "${i}a\\
        # Nginx sub_filter to fix UI pairing screen (rewrites "paired":false to "paired":true)
        # shellcheck disable=SC2034
        NGINX_HEALTH_SUBFILTER='
        proxy_buffering on;
        sub_filter_types application/json;
        sub_filter '"paired":false,"require_pairing":false' '"paired":true,"require_pairing":false';
        sub_filter_once off;
'
" scripts/entrypoint.sh
        echo "Added sub_filter at line $i"
        exit 0
    fi
done

echo "ERROR: Could not find insertion point!"
exit 1
