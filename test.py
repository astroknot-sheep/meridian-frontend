import os

files = [
    "index.html",   # was landing.html
    "chat.html",    # was index.html
    "auth.html",
    "onboarding.html",
    "verified.html",
    "profile.html",
    "history.html"
]

for filename in files:
    if not os.path.exists(filename):
        print(f"⚠️  Skipping missing: {filename}")
        continue

    with open(filename, "r", encoding="utf-8") as f:
        content = f.read()

    original = content

    # Step 1: landing.html -> temporary placeholder
    content = content.replace('"landing.html"', '"__LANDING_PLACEHOLDER__"')
    content = content.replace("'landing.html'", "'__LANDING_PLACEHOLDER__'")

    # Step 2: old index.html (chat portal) -> chat.html
    content = content.replace('"index.html"', '"chat.html"')
    content = content.replace("'index.html'", "'chat.html'")

    # Step 3: placeholder -> index.html (the new landing page)
    content = content.replace('"__LANDING_PLACEHOLDER__"', '"index.html"')
    content = content.replace("'__LANDING_PLACEHOLDER__'", "'index.html'")

    # Also update JavaScript redirects like window.location.href = 'index.html'
    # They are already covered by the string replacements above.

    if content != original:
        with open(filename, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"✅ Updated {filename}")
    else:
        print(f"   No changes in {filename}")