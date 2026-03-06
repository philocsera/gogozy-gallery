#!/bin/bash
# 내보내기한 데이터 파일을 자동으로 커밋하고 push하는 스크립트
# 사용법: 관리자 페이지에서 내보내기 후 이 스크립트를 실행하세요

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOWNLOAD_DIR="$HOME/Downloads"

echo "📂 다운로드 폴더에서 데이터 파일 복사 중..."

# data-index.json 복사
if [ -f "$DOWNLOAD_DIR/data-index.json" ]; then
    cp "$DOWNLOAD_DIR/data-index.json" "$SCRIPT_DIR/"
    echo "  ✓ data-index.json"
else
    echo "  ⚠️  data-index.json 없음 — 내보내기를 먼저 실행하세요"
    exit 1
fi

# data-chunk-*.json 복사
CHUNK_COUNT=0
for f in "$DOWNLOAD_DIR"/data-chunk-*.json; do
    [ -f "$f" ] || break
    cp "$f" "$SCRIPT_DIR/"
    echo "  ✓ $(basename "$f")"
    CHUNK_COUNT=$((CHUNK_COUNT + 1))
done

if [ "$CHUNK_COUNT" -eq 0 ]; then
    echo "  ⚠️  청크 파일 없음 — 내보내기를 먼저 실행하세요"
    exit 1
fi

echo ""
echo "📦 Git 커밋 & push 중..."
cd "$SCRIPT_DIR"
git config http.postBuffer 524288000
git add data-index.json data-chunk-*.json
git commit -m "이미지 업데이트 $(date '+%Y-%m-%d %H:%M')"
git push

echo ""
echo "✅ 완료! 약 1분 후 사이트에 반영됩니다."
