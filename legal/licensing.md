# Licensing and distribution

| Component                                         | Terms                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Original Builder Studio app code and renderer     | AGPL-3.0-only with ADDITIONAL_PERMISSIONS.md and ADDITIONAL_TERMS.md; see LICENSE and NOTICE          |
| BS Engine implementation                          | Proprietary; only compiled implementation is distributed under its Engine EULA                        |
| Schematica                                        | Third-party MIT; upstream attribution and local MIT changes remain identified                         |
| npm, Python, fonts, native libraries and browsers | Their original component licenses; preserve all bundled notices                                       |
| Minecraft assets                                  | Not granted by this repository; textures come from the user's own game installation                   |
| Builder Studio and BS Engine names, logo and icon | Not licensed; modified versions are renamed, marked as changed and credit the original                |
| Third-party names and logos                       | Not licensed by the source-code license; third-party marks keep their owners' rights                  |
| User-created projects and outputs                 | No ownership claimed by the app license; separately licensed copied template material keeps its terms |

## What the terms allow and require

- Anyone may use, study, change, and share the app under **AGPL-3.0-only**.
- **No closed-source forks:** every conveyed version, modified or not, must ship its complete
  Corresponding Source under AGPL-3.0-only together with the additional terms.
- **Commercial copies remain open:** AGPL-3.0 does not forbid charging for a copy, but any paid
  copy must still publish its complete source (which anyone may share freely), use its own name
  and icon, state clearly that it was changed, credit `"Based on Builder Studio by ModerNik"`,
  and never present itself as official (`ADDITIONAL_TERMS.md`, under AGPL section 7(b)–7(e)).
- **BS Engine is separate:** no fork or modified copy may include BS Engine. Its EULA licenses
  it only as part of the official Builder Studio application from official releases. Forks can
  implement the documented engine contract or request separate engine permission.

The complete official product is therefore a combination of an open-source application and
separately licensed components.

The integration permission in [ADDITIONAL_PERMISSIONS.md](ADDITIONAL_PERMISSIONS.md) permits the
named combinations without granting rights in BS Engine or Anthropic components. Contributions
to this repository are licensed under the same application license, integration permission, and
additional terms. Builder Studio's 3D renderer remains covered by AGPL-3.0-only when the engine
uses it; its exact source and build instructions accompany the engine's copy.

## Distribution and release compliance

- **Publisher and contact:** ModerNik (`https://github.com/ModerNik/builder-studio/issues`).
  `npm run legal:check` verifies that all required legal files are present and contain no
  unresolved placeholders before a release is built.
- **Complete third-party notices:** every release generates `THIRD_PARTY_NOTICES.txt` from the
  exact installed npm dependencies, staged runtime packages, fonts, and native subcomponents
  (`npm run licences`).
- **Corresponding Source:** each release publishes the corresponding application and renderer
  source, build scripts, and license files in this repository. Proprietary engine source stays
  private.
- **No embedded credentials:** official public releases contain no embedded GitHub credentials
  or API keys (`scripts/check-package.mts`).
- **User creations:** the engine EULA does not replace the application's AGPL-3.0-only license
  or any dependency's terms. User projects and generated outputs can be used commercially,
  subject to any third-party assets or content they incorporate.

---

NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
