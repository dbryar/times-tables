<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script lang="ts">
import { defineComponent, provide } from "vue";
import { useI18n } from "vue-i18n";

export default defineComponent({
  name: "MainLayout",
  setup() {
    const { t: i18n, locale } = useI18n();

    provide("i18n", i18n);
    provide("locale", locale);
  },
});
</script>
