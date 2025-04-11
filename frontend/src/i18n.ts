// src/i18n.ts
import { createI18n } from "vue-i18n";

import en from "./locales/en.json";
import sl from "./locales/sl.json";

const i18n = createI18n({
  legacy: false,
  locale: "en",
  fallbackLocale: "en",
  messages: {
    en,
    sl,
  },
  allowComposition: true,
  globalInjection: true,
} as any);

export default i18n;
