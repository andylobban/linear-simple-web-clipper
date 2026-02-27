chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Linear Web Clipper installed.');
  }
});
