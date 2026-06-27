<script lang="ts">
  import { getLang } from "$lib/stores/lang.svelte";
  import { getServices } from "$lib/data";

  let lang = $derived(getLang());
  let svc = $derived(getServices(lang));
</script>

<section id="servicios" class="scroll-mt-24">
  <div class="mx-auto max-w-6xl px-6 py-20">
    <h2
      class="section-title text-center font-sans text-3xl font-bold text-text dark:text-text-dark sm:text-4xl"
    >
      {svc.title}
    </h2>

    <!-- Featured course -->
    <div
      class="mx-auto mt-10 max-w-3xl rounded-2xl border border-accent/30 bg-accent/5 p-8 text-center dark:border-accent-dark/30 dark:bg-accent-dark/10"
    >
      <h3 class="font-sans text-2xl font-bold text-accent dark:text-accent-dark">
        {svc.featured.emoji}
        {svc.featured.title}
      </h3>
      <h4 class="mt-1 font-sans text-lg font-semibold text-text dark:text-text-dark">
        {svc.featured.subtitle}
      </h4>
      <p class="mx-auto mt-3 max-w-xl font-sans text-muted dark:text-muted-dark">
        {svc.featured.description}
      </p>
      <span
        class="mt-4 inline-block rounded-full bg-accent px-4 py-1 font-sans text-sm font-medium text-white dark:bg-accent-dark"
      >
        {svc.featured.badge}
      </span>
      <p class="mt-4 font-sans text-3xl font-bold text-text dark:text-text-dark">
        {svc.featured.price}
      </p>
      <p class="mt-2 font-sans text-sm text-muted dark:text-muted-dark">{svc.featured.perks}</p>
    </div>

    <!-- Plans grid -->
    <h2
      id="planes"
      class="section-title mt-20 scroll-mt-24 text-center font-sans text-3xl font-bold text-text dark:text-text-dark sm:text-4xl"
    >
      {svc.plansTitle}
    </h2>
    <div class="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {#each svc.plans as plan, i (i)}
        <!-- Original .service-card: white, 15px radius, soft shadow, 4px
             bright-teal top border, lifts on hover. Title + subtitle centered;
             bulleted list left-aligned; orange price. -->
        <div
          class="flex h-full flex-col rounded-2xl border-t-4 border-brand-teal bg-surface p-8 text-center shadow-card transition-transform hover:-translate-y-2 dark:bg-surface-dark dark:shadow-card-dark"
        >
          <h3 class="font-sans text-xl font-bold text-text dark:text-text-dark">{plan.title}</h3>
          <p class="mt-2 font-sans font-semibold text-text dark:text-text-dark">
            {plan.subtitle}
          </p>
          <ul
            class="mt-5 flex-1 list-disc space-y-2 pl-5 text-left font-sans text-sm text-muted dark:text-muted-dark"
          >
            {#each plan.items as li, j (j)}
              <li>{li}</li>
            {/each}
          </ul>
          {#if plan.price}
            <p class="mt-6 font-sans text-2xl font-bold text-brand-orange">
              {plan.price}
            </p>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Discount callout — original .discount-box: warm cream panel,
         orange heading with an underlined TREPA link, teal body text. -->
    <div class="mt-14 rounded-xl bg-brand-cream px-6 py-8 text-center">
      <h3 class="font-sans text-xl font-bold text-brand-orange sm:text-2xl">
        {svc.discount.title}
        <a
          href={svc.discount.linkHref}
          target="_blank"
          rel="noopener noreferrer"
          class="text-brand-orange underline underline-offset-4">{svc.discount.linkLabel}</a
        >
      </h3>
      <p class="mt-3 font-sans text-text">{svc.discount.body}</p>
    </div>
  </div>
</section>
