<script setup lang="ts"></script>

<template>
  <header class="sticky top-0">
    <nav class="bg-primaryMedium border-gray-200 p-2 xl:py-4 xl:px-0">
      <div
        class="flex flex-wrap justify-between items-center mx-auto max-w-screen-md"
      >
        <RouterLink to="/">
          <img
            src="@/assets/logo.svg"
            class="h-6 sm:h-9"
            alt="Oasis logo"
          />
        </RouterLink>
        <a href="https://tekmovanja.acm.si/?q=upm">
          <img src="@/assets/images/upm-logo.png" class="h-6 sm:h-9" alt="UPM logo" />
        </a>
      </div>
    </nav>
    <p class="text-white text-right mt-3 mr-3">
      Težave, vprašanja, pohvale?<br/>
      Obiščite <a href="https://oasis.io/discord" target="_blank">Discord kanal #slovenia 🇸🇮 </a>
    </p>
  </header>
</template>

<style lang="postcss" scoped></style>
