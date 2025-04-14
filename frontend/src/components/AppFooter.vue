<script setup lang="ts">
import { useI18n } from "vue-i18n";
const currentYear = new Date().getFullYear();
const { t } = useI18n();
</script>

<template>
  <footer class="text-xs w-full absolute bottom-5 px-8">
    <p
      class="text-white text-center"
      v-html="t('copyright', { year: currentYear })"
    ></p>
  </footer>
</template>

<style lang="postcss" scoped></style>
