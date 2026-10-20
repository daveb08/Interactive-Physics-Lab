# Reference image provenance

Windows references are platform/project specific and use the locked Playwright Chromium version. They are regression references, not proof of accessibility or pedagogical quality.

- The initial 117 images were captured on `feature/builder-load-file` at `9b4d94f`. They remain intact.
- E1 adds 15 initial/free/running/completed-incorrect/grounded-induction images across three viewports, captured after integrating `55fe4b2`.
- The E1 feature intentionally changes the electromagnetism hub from “Coming soon” to “Available,” adds its entry link and description, and changes page height. All three resulting hub images were inspected. Active hub references use the new name `electromagnetism-hub-e1-available.png`; the three former `-modules-electromagnetism-index-html.png` images remain as historical references.

The screenshot tolerance and all other comparison assertions are unchanged. The desktop detailed-editor stability failure is not accepted as a new reference. Remaining accessibility failures are not masked. Review screenshots on the intended physical devices as well.
