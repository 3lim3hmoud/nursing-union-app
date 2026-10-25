#!/bin/sh
# بيغيّر رقم نسخة الكاش في sw.js لتوقيت دلوقتي، عشان المتصفحات تاخد التحديث وتظهر لهم رسالة "فيه تحديث".
# الاستخدام (من جذر المشروع قبل الـ commit):  sh scripts/bump-sw.sh
cd "$(dirname "$0")/.." || exit 1
V="union-app-$(date +%Y%m%d%H%M)"
sed -i "s/^const CACHE_NAME = .*/const CACHE_NAME = '$V';/" sw.js
echo "sw.js -> $V"
