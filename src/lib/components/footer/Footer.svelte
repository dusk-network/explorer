<svelte:options immutable={true} />

<script>
  import { networks } from "@dusk-network/networks";

  import { AppAnchor, AppImage } from "$lib/components";
  import { Anchor } from "$lib/dusk/components";
  import { networkOf } from "$lib/network";
  import { appStore } from "$lib/stores";
  import "./Footer.css";

  const currentYear = new Date().getFullYear();

  $: ({ darkMode, nodeInfo } = $appStore);
  $: network = networkOf(nodeInfo.chain_id);

  // The explorers of the other networks, and the terms of who runs this one.
  $: otherExplorers = Object.values(networks).flatMap(({ apps, label }) =>
    apps.explorer && apps.explorer !== network?.apps.explorer
      ? [{ label, url: apps.explorer }]
      : []
  );
  $: ({ privacyUrl, termsUrl } = (network ?? networks.mainnet).operator);
</script>

<div class="footer">
  <div class="footer__copyright-container">
    <p>© 2018 - {currentYear} Dusk Network B.V. All Rights Reserved.</p>
    <p>
      Explorer v{import.meta.env.APP_VERSION} ({import.meta.env.APP_BUILD_INFO})
    </p>
  </div>
  <div class="footer__explorers-links-container">
    {#each otherExplorers as { label, url } (url)}
      <Anchor onSurface={false} href={url} className="footer__link"
        >{label}</Anchor
      >
    {/each}
  </div>

  <div class="footer__misc-links-container">
    <Anchor onSurface={false} href={privacyUrl} className="footer__link"
      >Privacy policy</Anchor
    >
    <Anchor onSurface={false} href={termsUrl} className="footer__link"
      >Terms of use</Anchor
    >
  </div>

  <AppAnchor href="https://dusk.network" className="footer__logo">
    <picture>
      <AppImage
        src={darkMode ? "/dusk_logo_light.svg" : "/dusk_logo.svg"}
        alt="Dusk Logo"
        sizes="72px"
      />
    </picture>
  </AppAnchor>
</div>
