from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RELEASE_WORKFLOW = ROOT / ".github" / "workflows" / "release.yml"
INSTALLER_WORKFLOW = ROOT / ".github" / "workflows" / "windows-installer.yml"


def test_release_workflow_manual_dispatch_has_no_stale_default() -> None:
    content = RELEASE_WORKFLOW.read_text(encoding="utf-8")
    assert 'default: "v1.4.2"' not in content


def test_installer_workflow_does_not_create_github_release() -> None:
    content = INSTALLER_WORKFLOW.read_text(encoding="utf-8")
    assert "gh release create" not in content
