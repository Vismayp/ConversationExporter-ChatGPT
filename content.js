const script = document.createElement("script");
script.src = chrome.runtime.getURL("inject.js");
script.onload = function () {
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

window.addEventListener("message", function (event) {
  if (event.source !== window) return;

  if (event.data.type === "CHATGPT_CONVERSATION_DATA") {
    chrome.runtime.sendMessage({
      type: "SAVE_CONVERSATION",
      data: event.data.payload,
    });
  } else if (event.data.type === "CHATGPT_AUTH_TOKEN") {
    chrome.runtime.sendMessage({
      type: "SAVE_AUTH_TOKEN",
      data: event.data.payload,
    });
  } else if (event.data.type === "CHATGPT_IMAGE_DATA") {
    chrome.runtime.sendMessage({
      type: "SAVE_IMAGE_DATA",
      data: event.data.payload,
    });
  } else if (event.data.type === "CHATGPT_FILE_URL") {
    chrome.runtime.sendMessage({
      type: "SAVE_FILE_URL",
      data: event.data.payload,
    });
  } else if (event.data.type === "CHATGPT_DOWNLOAD_URL") {
    chrome.runtime.sendMessage({
      type: "SAVE_DOWNLOAD_URL",
      data: event.data.payload,
    });
  }
});
