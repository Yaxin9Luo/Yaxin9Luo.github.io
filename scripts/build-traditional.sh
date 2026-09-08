#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# A local development runtime is optional; CI uses ruby/setup-ruby.
if [[ -x "$ROOT/work/runtime/ruby/bin/ruby" ]]; then
  export PATH="$ROOT/work/runtime/ruby/bin:$PATH"
fi

if ! bundle check; then
  echo 'Install the original Jekyll dependencies with Ruby 3.3: bundle install' >&2
  exit 1
fi

mkdir -p "$ROOT/work/traditional-source"
# Build from a disposable copy so the original academic website stays intact.
# These exclusions also prevent recursively publishing dependencies/builds.
rsync -a --delete \
  --exclude='/.git/' --exclude='/.bundle/' --exclude='/vendor/' \
  --exclude='/node_modules/' --exclude='/world/' --exclude='/scripts/' \
  --exclude='/docs/' --exclude='/work/' --exclude='/dist/' --exclude='/_site/' \
  "$ROOT/" "$ROOT/work/traditional-source/"

export WORLD_SITE_URL="${SITE_URL:-https://yaxin9luo.github.io}"
ruby -ryaml -e '
  config = YAML.load_file("_config.yml", aliases: true)
  overlay = {
    "url" => ENV.fetch("WORLD_SITE_URL").sub(%r{/+$}, ""),
    "baseurl" => "/traditional",
    "exclude" => (config.fetch("exclude", []) + %w[world scripts docs work dist Gemfile.lock]).uniq
  }
  File.write("work/traditional-config.yml", YAML.dump(overlay))
  # Keep navigational/resource links portable between local previews and Pages;
  # site.url is still available to SEO and feed plugins for canonical URLs.
  File.write("work/traditional-source/_includes/base_path", "{% assign base_path = site.baseurl %}\n")
  File.open("work/traditional-source/_includes/footer/custom.html", "a") do |file|
    file.puts %q{<p><a href="/">✦ Enter the enchanted world · 进入魔法世界</a></p>}
  end

  # The inherited theme names several favicon variants absent from this repo.
  # Keep its real favicon and omit only declarations pointing at missing files.
  head = "work/traditional-source/_includes/head/custom.html"
  lines = File.readlines(head).reject do |line|
    icon = line.match(%r{href="[^"]*/images/([^"?]+)})
    line.include?("<link") && icon && !File.file?("images/#{icon[1]}")
  end
  File.write(head, lines.join)

  # The old navigation already contains this route, but no page was committed.
  # Mark the missing material honestly instead of inventing research claims.
  has_notes = Dir.glob("work/traditional-source/{_pages,_posts}/**/*").any? do |file|
    File.file?(file) && File.read(file).match?(%r{^permalink:\s*"?/long-horizon-research-thoughts/?"?\s*$})
  end
  unless has_notes
    File.write("work/traditional-source/_pages/world-research-notes.md", <<~MARKDOWN)
      ---
      title: "Long-Horizon Research Thoughts"
      permalink: /long-horizon-research-thoughts/
      layout: single
      author_profile: true
      ---

      **Research notes — forthcoming / 研究笔记待补充**

      This section is reserved for future research notes. The original website linked here, but the repository did not contain a page. For now, explore the [research overview](/traditional/) and [publications](/traditional/publications/).

      这里预留给后续的研究思考。原网站的导航已包含这个入口，但仓库中暂未提供对应内容。目前可以阅读[研究概览](/traditional/zh/)与[论文列表](/traditional/publications/)。

      [Enter the enchanted world · 进入魔法世界](/)
    MARKDOWN
  end
'

JEKYLL_ENV=production bundle exec jekyll build \
  --safe \
  --source "$ROOT/work/traditional-source" \
  --config "$ROOT/_config.yml,$ROOT/work/traditional-config.yml" \
  --destination "$ROOT/work/traditional-site" \
  --trace

# GitHub Pages resolves extensionless .html links; simple local static servers
# do not. Directory aliases keep the original publication links portable.
ruby -rfileutils -e '
  Dir.glob("work/traditional-site/publication/*.html").each do |file|
    directory = file.delete_suffix(".html")
    FileUtils.mkdir_p(directory)
    FileUtils.cp(file, File.join(directory, "index.html"))
  end
'

test -s "$ROOT/work/traditional-site/index.html"
test -s "$ROOT/work/traditional-site/zh/index.html"
test -s "$ROOT/work/traditional-site/assets/css/main.css"
test -s "$ROOT/work/traditional-site/files/CV_YaxinLuo.pdf"
echo 'Traditional website built at work/traditional-site (mount at /traditional/).'
