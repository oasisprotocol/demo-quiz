<script setup lang="ts">
const currentYear = new Date().getFullYear();
</script>

<template>
  <footer class="">
    <p class="text-white text-center">
      Copyright © {{ currentYear }}
      <a href="https://oasisprotocol.org" target="_blank"
        >Oasis Protocol Foundation</a
      >. Licensed under
      <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank"
        >Apache 2.0</a
      >.
    </p>
  </footer>
</template>

<style lang="postcss" scoped></style>
