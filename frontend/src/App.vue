<script setup lang="ts">
import { RouterView } from "vue-router";
import AppHeader from "@/components/AppHeader.vue";
import AppFooter from "@/components/AppFooter.vue";
</script>

<template>
  <AppHeader />

  <main class="pt-12 lg:pt-16 pb-20 px-8 m-auto max-w-screen-sm lg:px-0">
    <RouterView el="main" />
  </main>

  <AppFooter />
</template>

<style lang="postcss"></style>
