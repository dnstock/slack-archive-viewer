// A fresh notice replaces the previous timeout, so old timers never hide new text.
export function createNotice(
  element,
  textElement,
  closeButton,
  duration = 6000,
) {
  let timer;
  function dismiss() {
    clearTimeout(timer);
    element.hidden = true;
    textElement.textContent = "";
  }
  closeButton.addEventListener("click", dismiss);
  return function showNotice(text) {
    dismiss();
    if (!text) return;
    textElement.textContent = text;
    element.hidden = false;
    timer = setTimeout(dismiss, duration);
  };
}
