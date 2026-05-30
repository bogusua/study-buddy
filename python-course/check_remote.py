#!/usr/bin/env python3
"""
check_remote.py -- Перевірка віддаленого Git-репозиторію учня.

Використовується агентом-викладачем для верифікації роботи учня на GitHub/GitLab.
Токен зчитується з .env файлу (тільки read-only доступ).

Використання:
    python check_remote.py status           -- перевірити чи репо існує
    python check_remote.py commits [N]      -- показати останні N комітів
    python check_remote.py files [path]     -- список файлів у директорії
    python check_remote.py check-lesson N   -- перевірити чи є розв'язки уроку N
    python check_remote.py file-content path -- показати вміст файлу
"""

import os
import json
import sys
import base64
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


def load_env(env_path=None):
    """Завантажити змінні з .env файлу."""
    if env_path is None:
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(env_path):
        print(f"ERROR: .env not found at {env_path}")
        print("Create .env file with:")
        print("  GITHUB_TOKEN=ghp_...")
        print("  GITHUB_REPO=username/python-course")
        sys.exit(1)

    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ[key.strip()] = value.strip()


def github_api(endpoint, token):
    """Виклик GitHub API."""
    url = f"https://api.github.com{endpoint}"
    req = Request(url)
    req.add_header("Authorization", f"token {token}")
    req.add_header("Accept", "application/vnd.github.v3+json")
    req.add_header("User-Agent", "python-course-checker")

    try:
        with urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except HTTPError as e:
        if e.code == 404:
            return None
        if e.code == 401:
            print("ERROR: Invalid token or token expired")
            sys.exit(1)
        if e.code == 403:
            print("ERROR: Access denied. Check token permissions.")
            sys.exit(1)
        raise


# ---- Commands ----

def cmd_status(token, repo):
    """Перевірити стан репозиторію."""
    data = github_api(f"/repos/{repo}", token)
    if data is None:
        print(f"Repository '{repo}' not found or not accessible")
        return False

    print(f"Repo:     {data['full_name']}")
    print(f"Private:  {data.get('private', '?')}")
    print(f"Branch:   {data.get('default_branch', 'main')}")
    print(f"Created:  {data.get('created_at', '?')[:10]}")
    print(f"Updated:  {data.get('updated_at', '?')[:10]}")
    print(f"URL:      {data.get('html_url', '')}")
    return True


def cmd_commits(token, repo, limit=10):
    """Показати останні коміти."""
    data = github_api(f"/repos/{repo}/commits?per_page={limit}", token)
    if not data:
        print("No commits found")
        return

    print(f"Last {len(data)} commit(s):")
    for c in data:
        sha = c["sha"][:7]
        msg = c["commit"]["message"].split("\n")[0]
        date = c["commit"]["author"]["date"][:10]
        author = c["commit"]["author"]["name"]
        print(f"  {sha}  {date}  {author}: {msg}")


def cmd_files(token, repo, path=""):
    """Показати файли у директорії."""
    data = github_api(f"/repos/{repo}/contents/{path}", token)
    if not data:
        print(f"No files in '{path or '/'}'")
        return

    if isinstance(data, dict):
        # Single file, not a directory
        print(f"  {data['name']}  ({data.get('size', '?')} bytes)")
        return

    for f in sorted(data, key=lambda x: (x["type"] != "dir", x["name"])):
        icon = "dir " if f["type"] == "dir" else "file"
        size = f.get("size", "")
        size_str = f"  ({size} bytes)" if size and f["type"] != "dir" else ""
        print(f"  [{icon}] {f['name']}{size_str}")


def cmd_check_lesson(token, repo, lesson_num):
    """Перевірити чи є розв'язки уроку."""
    data = github_api(f"/repos/{repo}/contents/solutions", token)
    if not data:
        print("solutions/ directory not found in the repo")
        return False

    prefix = f"lesson_{lesson_num:02d}_"
    found = [f["name"] for f in data if f["name"].startswith(prefix)]

    if found:
        print(f"Found {len(found)} solution(s) for lesson {lesson_num:02d}:")
        for name in sorted(found):
            print(f"  {name}")
        return True
    else:
        print(f"No solutions found for lesson {lesson_num:02d}")
        return False


def cmd_file_content(token, repo, path):
    """Показати вміст файлу."""
    data = github_api(f"/repos/{repo}/contents/{path}", token)
    if data is None:
        print(f"File not found: {path}")
        return

    if data.get("encoding") == "base64":
        content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
        print(content)
    else:
        print(f"Cannot decode file (encoding: {data.get('encoding')})")


# ---- Main ----

def main():
    load_env()

    token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPO")

    if not token:
        print("ERROR: GITHUB_TOKEN not set in .env")
        sys.exit(1)
    if not repo:
        print("ERROR: GITHUB_REPO not set in .env (format: username/repo-name)")
        sys.exit(1)

    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "status":
        cmd_status(token, repo)
    elif cmd == "commits":
        limit = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        cmd_commits(token, repo, limit)
    elif cmd == "files":
        path = sys.argv[2] if len(sys.argv) > 2 else ""
        cmd_files(token, repo, path)
    elif cmd == "check-lesson":
        if len(sys.argv) < 3:
            print("Usage: python check_remote.py check-lesson <lesson_number>")
            sys.exit(1)
        cmd_check_lesson(token, repo, int(sys.argv[2]))
    elif cmd == "file-content":
        if len(sys.argv) < 3:
            print("Usage: python check_remote.py file-content <path>")
            sys.exit(1)
        cmd_file_content(token, repo, sys.argv[2])
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
