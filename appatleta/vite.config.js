// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      plugins: [
        {
          name: 'replace-env-variables',
          transform(code, id) {
            if (id.includes('firebase-messaging-sw.js')) {
              return code.replace(/'VITE_(.*?)'/g, (match, p1) => {
                return JSON.stringify(process.env[`VITE_${p1}`] || match);
              });
            }
          }
        }
      ]
    }
  }
});