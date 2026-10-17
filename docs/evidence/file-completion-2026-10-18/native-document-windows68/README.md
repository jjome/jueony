# Actual native document windows, engine68

See `actual-validation.json` for observed GUI actions and limits. The packaged fixture is self-authored. The supplied executable is identified by its SHA256 but is not included.

The `readback-verifier.mjs` copy seals the verifier version. Reproduce from the repository's `apps/editor/scripts/verify-native-window-readback.mjs` with absolute environment variables `JUEONY_ENGINE_PACKAGE`, `JUEONY_NATIVE_SAVED_FILE`, `JUEONY_TEST_OUTPUT` and `JUEONY_EXPECTED_TEXT=CHILD WINDOW RECOVERY 68`. Use the engine68 package named in `frontend-build.json` to reproduce this exact GUI pairing. Later-engine compatibility requires its own report.

The earlier absolute-path executable opened a directory listing. Its failed status was retained; only the relative-path executable received the successful GUI review documented here. Screenshots contain only an isolated synthetic workspace.
