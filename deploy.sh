#!/bin/bash
# 관리자 페이지에서 "GitHub 배포 내보내기" 후 이 스크립트를 실행하세요.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOWNLOAD_DIR="$HOME/Downloads"
ZIP_FILE="$DOWNLOAD_DIR/gallery-export.zip"

echo "📂 gallery-export.zip 확인 중..."

if [ ! -f "$ZIP_FILE" ]; then
    echo "  ⚠️  gallery-export.zip 없음"
    echo "     관리자 페이지 → 관리 → GitHub 배포 → 내보내기를 먼저 실행하세요."
    exit 1
fi

echo "  ✓ gallery-export.zip 발견"

echo ""
echo "📦 압축 해제 중..."

TEMP_DIR=$(mktemp -d)
unzip -q "$ZIP_FILE" -d "$TEMP_DIR"

# metadata.json 복사
cp "$TEMP_DIR/metadata.json" "$SCRIPT_DIR/metadata.json"
echo "  ✓ metadata.json"

# images/ 폴더 교체
rm -rf "$SCRIPT_DIR/images"
cp -r "$TEMP_DIR/images" "$SCRIPT_DIR/images"
touch "$SCRIPT_DIR/images/.metadata_never_index"
IMAGE_COUNT=$(ls "$SCRIPT_DIR/images" | wc -l | tr -d ' ')
echo "  ✓ images/ ($IMAGE_COUNT 장)"

rm -rf "$TEMP_DIR"

echo ""
echo "🚀 Git 커밋 & push 중..."
cd "$SCRIPT_DIR"

git config http.postBuffer 524288000

# 구 청크 파일 제거 (있을 경우)
if ls data-chunk-*.json 2>/dev/null | head -1 | grep -q .; then
    git rm -f data-chunk-*.json data-index.json 2>/dev/null || true
    echo "  ✓ 구 청크 파일 제거"
fi

git add metadata.json images/
git commit -m "이미지 업데이트 $(date '+%Y-%m-%d %H:%M')"
git push

echo ""
echo "✅ 완료! 약 1분 후 사이트에 반영됩니다."
echo "   https://philocsera.github.io/gogozy-gallery/"
