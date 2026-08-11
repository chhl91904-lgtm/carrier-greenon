#!/bin/sh
set -eu

# Render 환경변수로 브라우저용 설정 파일을 생성합니다.
# 두 값은 공개 가능한 URL/publishable key이며 secret key는 사용하지 않습니다.
: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_PUBLISHABLE_KEY:?SUPABASE_PUBLISHABLE_KEY is required}"

printf '%s\n' \
  '// Render 빌드에서 자동 생성된 공개 런타임 설정입니다.' \
  'window.GREENON_CONFIG = {' \
  "  supabaseUrl: \"${SUPABASE_URL}\"," \
  "  supabasePublishableKey: \"${SUPABASE_PUBLISHABLE_KEY}\"," \
  '};' > config.js
