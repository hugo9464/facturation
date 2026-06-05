#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def update_package_json(path: Path, version: str) -> bool:
    data = json.loads(path.read_text())
    if data.get("version") == version:
        return False
    data["version"] = version
    path.write_text(json.dumps(data, indent=2, ensure_ascii=True) + "\n")
    return True


def update_package_lock(path: Path, version: str) -> bool:
    data = json.loads(path.read_text())
    changed = False

    if data.get("version") != version:
        data["version"] = version
        changed = True

    packages = data.get("packages")
    if isinstance(packages, dict):
        root_pkg = packages.get("")
        if isinstance(root_pkg, dict) and root_pkg.get("version") != version:
            root_pkg["version"] = version
            changed = True

    if changed:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=True) + "\n")

    return changed


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Align package.json and package-lock.json to a target version."
    )
    parser.add_argument("--root", required=True, help="Project root containing package.json")
    parser.add_argument("--version", required=True, help="Target semver, for example 2.15.2")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    package_json = root / "package.json"
    package_lock = root / "package-lock.json"

    if not package_json.exists():
        raise SystemExit(f"Missing package.json in {root}")

    changed_files = []

    if update_package_json(package_json, args.version):
        changed_files.append(str(package_json))

    if package_lock.exists() and update_package_lock(package_lock, args.version):
        changed_files.append(str(package_lock))

    if changed_files:
        print("\n".join(changed_files))
    else:
        print("No version changes needed.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
