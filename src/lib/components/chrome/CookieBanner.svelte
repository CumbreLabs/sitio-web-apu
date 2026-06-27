<script lang="ts">
  import { browser } from "$app/environment";
  import { getLang } from "$lib/stores/lang.svelte";
  import { t } from "$lib/i18n";

  let lang = $derived(getLang());
  let visible = $state(false);
  let acceptButton: HTMLButtonElement | undefined = $state();
  // Saved on appear so we can restore focus when the user dismisses the banner
  // (instead of leaving focus floating in document.body).
  let previouslyFocused: HTMLElement | null = null;

  $effect(() => {
    if (!browser) return;
    try {
      if (!localStorage.getItem("consent")) visible = true;
    } catch {
      // Storage disabled — never show the banner (we can't persist a choice anyway).
    }
  });

  // Move focus into the banner so keyboard / screen-reader users discover it
  // immediately instead of tabbing through the entire page first. WCAG SC 2.4.3
  // (Focus Order): focus should follow a sequence that preserves meaning, and
  // a banner asking for a decision deserves to be reachable in one keystroke.
  $effect(() => {
    if (visible && acceptButton) {
      previouslyFocused = (document.activeElement as HTMLElement | null) ?? null;
      acceptButton.focus();
    }
  });

  function setConsent(value: "granted" | "denied") {
    try {
      localStorage.setItem("consent", value);
    } catch {
      // Storage disabled — banner just won't reappear this session.
    }
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === "function") {
      gtag("consent", "update", { analytics_storage: value });
    }
    visible = false;
    // Restore focus to wherever the user was before the banner stole it.
    // Falls back to body if the previous element is no longer in the DOM.
    if (previouslyFocused && document.contains(previouslyFocused)) {
      previouslyFocused.focus();
    }
    previouslyFocused = null;
  }
</script>

{#if visible}
  <div
    role="region"
    aria-label="Cookie consent"
    class="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-bg/95 px-4 py-4 shadow-lg backdrop-blur dark:border-border-dark dark:bg-bg-dark/95"
  >
    <div
      class="mx-auto flex max-w-3xl flex-col items-center gap-3 sm:flex-row sm:justify-between"
    >
      <p class="font-sans text-sm text-text dark:text-text-dark">
        {t(lang, "consent.message")}
      </p>
      <div class="flex shrink-0 gap-2">
        <button
          type="button"
          onclick={() => setConsent("denied")}
          class="px-4 py-1.5 font-sans text-sm text-muted transition-colors hover:text-text dark:text-muted-dark dark:hover:text-text-dark"
        >
          {t(lang, "consent.decline")}
        </button>
        <button
          type="button"
          bind:this={acceptButton}
          onclick={() => setConsent("granted")}
          class="bg-accent px-4 py-1.5 font-sans text-sm text-white transition-opacity hover:opacity-90 dark:bg-accent-dark dark:text-bg-dark"
        >
          {t(lang, "consent.accept")}
        </button>
      </div>
    </div>
  </div>
{/if}
