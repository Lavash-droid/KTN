// app.json-u genişləndirir. EXPO_WEB_BASE_URL yalnız vahid saytın build-ində təyin olunur
// (scripts/build-site.sh → "/panel"): veb panel suru.az/panel altında işləyir.
// Telefon tətbiqləri və `expo start` bundan təsirlənmir.
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_WEB_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};
