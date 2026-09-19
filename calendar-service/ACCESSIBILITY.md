# Calendar accessibility review - 19 September 2026

Target: WCAG 2.2 AA. Reference: https://www.w3.org/WAI/WCAG22/quickref/
This is an engineering review, not a certification of complete conformance.

## Verified

- axe-core WCAG 2 A/AA, 2.1 AA and 2.2 AA checks returned zero violations in the tested states: public English and Hebrew home markup, signed-in workspace (light and dark), booking landing, date/time selection, guest details, booking management, local preview and Calendar policy page.
- Hebrew booking and home, workspace, preview and policy layouts checked at 320 CSS pixels without horizontal page overflow. This tests narrow reflow, not every browser zoom behavior.
- Profile, availability, landing settings, meeting editor and display dialogs have names and labeled visible form controls. Escape closes them and restores focus to their openers.
- A sample-only booking confirmed that focus moves to the confirmation heading. No real invitations were sent.
- Crop controls provide labeled native sliders as an alternative to dragging.
- Existing skip links, disabled/unavailable dates, full date labels and error/status regions reviewed.
- 52 service and regression tests pass, including custom color contrast cases.

## Changes

- Correct time-zone input foreground/background; retain readable weekday and progress text.
- Contrast-aware booking colors, including contrasting selected-control text.
- Strong visible focus, form boundaries, reduced motion, forced-color support and small-screen date sizing.
- Valid guest-field autocomplete, descriptive time-slot names, day announcements and confirmation focus.
- Name the manual calendar-link dialog and mark English workspace content within the Hebrew page.
- Load the timezone component before calendar connections to prevent a startup race.

## Remaining manual checks

Run NVDA/Firefox and VoiceOver/Safari through real sign-in, calendar authorization, booking, rescheduling and cancellation. Review third-party Firebase, Google, Microsoft and Turnstile flows; automatic checks cannot establish their usability. Check uploaded host images and instructions, keyboard crop controls with a real image, 200% text resizing, 400% browser zoom, text spacing and mobile assistive technology. Repeat checks after changes to generated pages or styling.

Automated scans used a temporary local-only axe proxy and isolated sample provider. Public home markup was scanned without authentication bootstrap. Additional audit server launches were denied by automatic approval review; the existing server was used. Audit code is not shipped to production.
