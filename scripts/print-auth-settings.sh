#!/usr/bin/env bash
# Required Supabase Auth settings (technical/07 §6.3). Cannot be applied from here
# without the Management API token. Prints the checklist for the dashboard.
set -euo pipefail
cat <<'EOF'
Apply these in the Supabase dashboard (Authentication > Settings) before Phase 3 signup:

- OTP expiry: 900 seconds (default is 24 hours)
- Leaked password protection: On
- Minimum password length: 12
- JWT expiry: 3600 seconds
- Refresh token rotation: On, reuse detection On
- Signup email confirmation: Required

Evidence for 0.11 is a screenshot of those settings in the PR.

.env.local currently has NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (new format) and
NEXT_PUBLIC_SUPABASE_URL. SUPABASE_SECRET_KEY is not present. Add sb_secret_...
as a server-only var before any server path that bypasses RLS.
EOF
