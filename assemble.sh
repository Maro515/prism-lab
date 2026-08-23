#!/bin/sh
# build/ の各パーツを結合して単一ファイル index.html を生成する
cd "$(dirname "$0")"
parts() {
  cat build/00_base.html
  for f in build/0[5-9]_*.js build/1[0-9]_*.js; do
    [ -f "$f" ] && cat "$f"
  done
}
{ parts; printf '\n</script>\n</body>\n</html>\n'; } > index.html
parts | sed -n '/^<script>$/,$p' | tail -n +2 > /tmp/prismlab_check.js
if command -v node >/dev/null 2>&1; then
  node --check /tmp/prismlab_check.js && echo "syntax OK"
fi
wc -l index.html
