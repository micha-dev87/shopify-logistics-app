/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ignoredRouteFiles: ["**/.*"],
  appDirectory: "app",
  serverBuildPath: "build/index.js",
  publicPath: "/build/",
  assetsDirectory: "public/build",
  serverModuleFormat: "cjs",
  devServerPort: 3000,
  future: {
    v2_errorBoundary: true,
    v2_meta: true,
    v2_normalizeFormMethod: true,
    v2_routeConvention: true,
  },
};