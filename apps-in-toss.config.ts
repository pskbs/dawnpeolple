import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'dawnpeople',
  brand: {
    primaryColor: '#8465f2', // src/styles/themes/hybrid.css의 --primary와 동일(라벤더 브랜드 컬러)
  },
  permissions: [],
  webBundleDir: 'dist',
});
