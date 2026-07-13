import { defineConfig } from 'vite';

// Project is served from https://<user>.github.io/cca-exam-prep/, so all
// built asset URLs need that path prefix — Vite doesn't infer it.
export default defineConfig({
  base: '/cca-exam-prep/',
});
