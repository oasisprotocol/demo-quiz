<script setup lang="ts">
import { useI18n } from "vue-i18n";
const { t } = useI18n();
</script>

<template>
  <div class="404">
    <h1 class="text-white text-center text-3xl mb-4">404</h1>
    <h1 class="text-white text-center text-2xl">{{ t("not_found") }}</h1>
  </div>
</template>
