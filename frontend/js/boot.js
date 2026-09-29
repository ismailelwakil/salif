/* Apply the saved language before first paint. */
(function () {
  try {
    var lang = localStorage.getItem('salif.lang');
    if (!lang) lang = 'en';
    document.documentElement.lang = lang === 'ar' ? 'ar' : 'en';
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  } catch (e) {}
})();
