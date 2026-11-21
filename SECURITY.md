# Security Policy

## Supported versions

Security fixes are released on the latest stable `1.x` release of Builder Studio.

| Version                | Supported                                |
| ---------------------- | ---------------------------------------- |
| Latest release (`1.x`) | Yes                                      |
| Older releases         | No — please update to the latest release |

## Reporting a vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, report them privately using GitHub's private vulnerability reporting:

- Open a [GitHub Security Advisory](https://github.com/ModerNik/builder-studio/security/advisories/new) on this repository.

Please include as much detail as possible to help reproduce and assess the issue:

- Affected Builder Studio version and Windows version
- Steps to reproduce or a minimal proof of concept
- Potential impact (for example, arbitrary file write, credential exposure, command injection, or sandbox escape)

We will acknowledge receipt and work with you on a fix and coordinated disclosure.

## Security model overview

Builder Studio is designed around the following local safety boundaries:

- **API keys:** Anthropic API keys for the embedded Claude assistant are encrypted with Windows DPAPI via Electron's `safeStorage` in a separate file, never stored in `settings.json`, and never logged.
- **Local MCP server:** The external-agent MCP server (`http://127.0.0.1:7341/mcp`) binds to loopback only and rejects requests with an `Origin` header or non-loopback `Host` header so web pages cannot reach it.
- **Read-only Minecraft worlds:** Site terrain previews read saves only through temporary copies; Builder Studio never writes to Minecraft world folders.
- **Electron hardening:** Packaged builds enable ASAR integrity validation and disable `RunAsNode`, `NODE_OPTIONS`, and Node CLI inspect arguments via Electron fuses.
- **Checksum-verified runtimes:** Managed build engine and portable Git downloads are verified against pinned SHA-256 digests and exact byte sizes before extraction.
