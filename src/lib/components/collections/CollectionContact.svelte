<script lang="ts">
  import SocialLinks from "$lib/components/widgets/SocialLinks.svelte";
  import { getLang } from "$lib/stores/lang.svelte";
  import { getContact } from "$lib/data";

  let lang = $derived(getLang());
  let contact = $derived(getContact(lang));
</script>

<section id="contacto" class="scroll-mt-24 bg-accent text-white dark:bg-accent-dark">
  <div class="mx-auto max-w-3xl px-6 py-20 text-center">
    <h2 class="section-title font-sans text-3xl font-bold sm:text-4xl">{contact.title}</h2>
    <p class="mx-auto mt-4 max-w-xl font-sans text-lg text-white/90">{contact.subtitle}</p>

    <p class="mt-8 font-sans text-lg">
      <a href={`mailto:${contact.email}`} class="underline underline-offset-4 hover:text-white"
        >{contact.email}</a
      >
      <span class="px-2 text-white/60">|</span>
      <a
        href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}
        class="underline underline-offset-4 hover:text-white">{contact.phone}</a
      >
    </p>

    <div class="mt-6 flex justify-center">
      <SocialLinks size={24} tone="inverse" />
    </div>
  </div>
</section>
