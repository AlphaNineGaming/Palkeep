# Security and binary provenance

## Source repository policy

Palkeep does not intentionally track executable or native binary files inside
`single-player`. A CI check fails if a DLL, EXE, PYD, SO, DYLIB, ZIP, or CAT is
added there.

Single-player release support requires two native components:

1. The official CPython Windows embedded runtime. CI downloads the exact URL in
   `dependencies.lock.json`, verifies its published SHA-256 digest, and checks
   the Python Software Foundation Authenticode signature.
2. The Oodle-compatible `ooz` compression extension. CI clones exact `pyooz`,
   `ooz`, and `simde` commits and compiles the Windows extension from source.

The generated `single-player/runtime-manifest.json` records the source commits
and SHA-256 digest of every generated native file. It is included in packaged
builds but generated files are not committed to the repository.

The optional live bridge uses the Palworld-specific UE4SS build published by
Okaetsu. Its upstream GitHub release asset and both extracted DLLs are pinned by
SHA-256 in `dependencies.lock.json`. The DLLs are reconstructed during the
build and are not stored in the source tree. Generated bridge provenance is
recorded in `live-bridge/runtime-manifest.json`.

## Local data boundary

The single-player helper operates as a separate local process. Its readable
Python source does not include HTTP clients, sockets, telemetry, uploading, or
automatic execution of downloaded code. Save files remain on the local
machine. Palkeep creates a backup and validates the rewritten save before
replacing it.

## Installer signing

Public Beta installers currently publish SHA-256 digests through GitHub
Releases but are not yet Authenticode-signed. Windows may therefore show an
unknown-publisher warning. Do not download Palkeep installers from mirrors or
unofficial reposts. Authenticode signing is planned once a protected code-
signing certificate and CI signing identity are available.

## Reporting a vulnerability

Please report suspected vulnerabilities privately through the repository's
GitHub security advisory page. Do not include real save files, passwords,
bridge tokens, or private server addresses in a public issue.
