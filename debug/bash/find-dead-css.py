# find-dead-css.py (v2)
import pathlib, re, subprocess

css_classes = set()
css_ids = set()

for css_file in pathlib.Path('.').rglob('*.css'):
    text = css_file.read_text()
    # Strip CSS comments
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
    # Strip hex colors so #ff5555 doesn't get captured as an ID
    text = re.sub(r'#[0-9a-fA-F]{3,8}\b', '', text)
    # Strip strings inside url() or quotes (avoid picking up font names etc)
    text = re.sub(r'url\([^)]*\)', '', text)
    text = re.sub(r'"[^"]*"', '', text)
    text = re.sub(r"'[^']*'", '', text)
    css_classes.update(re.findall(r'\.([a-zA-Z_][\w-]{2,})', text))
    css_ids.update(re.findall(r'#([a-zA-Z_][\w-]{2,})', text))

targets = [
    'src/', 'main.js', 'index.html', 'debug/',
    'mobile-dev-console/', 'releases/',
]

def in_use(needle):
    result = subprocess.run(
        ['grep', '-rq', needle, *targets],
        capture_output=True,
    )
    return result.returncode == 0

def has_template_prefix(name):
    # "log-entry--important" → check if "log-entry--" appears anywhere
    parts = name.rsplit('-', 1)
    if len(parts) == 2 and len(parts[0]) > 3:
        prefix = parts[0] + '-'
        return in_use(prefix)
    return False

dead = []
for name in sorted(css_classes | css_ids):
    if in_use(name):
        continue
    if has_template_prefix(name):
        continue
    dead.append(name)

print(f"Dead: {len(dead)}")
for name in dead:
    print(f"  {name}")
