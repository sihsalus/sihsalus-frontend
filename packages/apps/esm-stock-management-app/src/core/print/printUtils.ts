const printDocumentInternal = (content: string) => {
  const printDocument = new Blob([content], { type: 'text/html' });
  const printUrl = URL.createObjectURL(printDocument);
  const newWin = window.open(printUrl, 'Print-Window');
  if (newWin) {
    newWin.addEventListener('afterprint', () => URL.revokeObjectURL(printUrl), { once: true });
    // setTimeout(function () {
    //     if (newWin) {
    //         newWin.close();
    //     }
    // }, 10);
  } else {
    URL.revokeObjectURL(printUrl);
  }
};

export const printDocument = (content: string) => {
  setTimeout(() => {
    printDocumentInternal(content);
  }, 300);
};
