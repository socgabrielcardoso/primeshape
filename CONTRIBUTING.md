# Contributing

Thank you for improving **primeshape**, a computer-vision study project.

## Working principles

- Keep changes small enough to review.
- Preserve the project's existing architecture and naming conventions.
- Prefer clear behavior over unnecessary abstraction.
- Do not add real credentials, production data or private identifiers.
- For security-related examples, use synthetic or explicitly authorized test data.
- Update documentation when behavior or operating steps change.

## Before opening a pull request

1. Run the existing tests or validation commands available in the repository.
2. Check that no secrets, build artifacts or temporary files were added.
3. Review the diff for unrelated formatting changes.
4. Explain the problem, the change and how it was validated.

## Commit style

Use short, descriptive commit messages such as:

- `feat: add incident severity filter`
- `fix: handle invalid authentication input`
- `docs: clarify local execution`
- `test: cover malformed event data`
- `ci: harden validation workflow`

## Security changes

Potential vulnerabilities should follow the process in `SECURITY.md` when that file is present. Avoid publishing sensitive exploit details in public issues.
