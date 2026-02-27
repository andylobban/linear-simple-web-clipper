chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'GET_PAGE_CONTENT') return false;

  try {
    const pageUrl = window.location.href;
    const pageTitle = document.title;

    // If user has text selected, use that
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      sendResponse({
        success: true,
        pageTitle,
        pageUrl,
        markdown: selection.toString().trim()
      });
      return true;
    }

    // Otherwise use Readability + Turndown
    const docClone = document.cloneNode(true);
    const reader = new Readability(docClone);
    const article = reader.parse();

    if (!article || !article.content) {
      sendResponse({
        success: true,
        pageTitle,
        pageUrl,
        markdown: ''
      });
      return true;
    }

    const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
    const markdown = td.turndown(article.content);

    sendResponse({
      success: true,
      pageTitle: article.title || pageTitle,
      pageUrl,
      markdown
    });
  } catch (err) {
    sendResponse({
      success: false,
      error: err.message
    });
  }

  return true;
});
