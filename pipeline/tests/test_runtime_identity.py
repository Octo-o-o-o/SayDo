import hashlib
import re
import subprocess
from pathlib import Path

import pytest

from saydo_pipeline.__main__ import (
    loaded_runtime_sha,
    read_cap_token,
    read_env_key,
    saydo_state_root,
    state_root_digest,
)


def test_loaded_runtime_sha_matches_source_tree_head() -> None:
    runtime_root = Path(__file__).resolve().parents[2]
    expected = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=runtime_root,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    actual = loaded_runtime_sha()
    assert re.fullmatch(r"[0-9a-f]{40}", actual)
    assert actual == expected


def test_loaded_runtime_sha_prefers_build_injection(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SAYDO_SOURCE_REVISION", "abcdef123456")
    assert loaded_runtime_sha() == "abcdef123456"


def test_custom_saydo_home_is_shared_for_env_and_token(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    state_root = tmp_path / "state"
    state_root.mkdir()
    (state_root / ".env").write_text("VOLC_APP_ID=from-custom-root\n")
    (state_root / ".cap-token").write_text("custom-token\n")
    monkeypatch.setenv("SAYDO_HOME", str(state_root))

    assert saydo_state_root() == state_root
    assert state_root_digest() == hashlib.sha256(str(state_root).encode()).hexdigest()
    assert read_env_key("VOLC_APP_ID") == "from-custom-root"
    assert read_cap_token() == "custom-token"


def test_saydo_home_rejects_relative_and_symlink_parent(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SAYDO_HOME", "relative/state")
    with pytest.raises(RuntimeError, match="absolute"):
        saydo_state_root()

    real_parent = tmp_path / "real"
    state_root = real_parent / "state"
    state_root.mkdir(parents=True)
    alias = tmp_path / "alias"
    alias.symlink_to(real_parent, target_is_directory=True)
    monkeypatch.setenv("SAYDO_HOME", str(alias / "state"))
    with pytest.raises(RuntimeError, match="symlinks"):
        saydo_state_root()
