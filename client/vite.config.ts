
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const monacoEditorApi = fileURLToPath(
  new URL(
    "./node_modules/monaco-editor/esm/vs/editor/editor.api.js",
    import.meta.url
  )
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "monaco-editor/esm/vs/editor/editor.api.js",
        replacement: monacoEditorApi,
      },
    ],
  },
});
