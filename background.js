chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_CONVERSATION") {
    chrome.storage.local.set({ latest_conversation: message.data });
  } else if (message.type === "SAVE_AUTH_TOKEN") {
    chrome.storage.local.set({ auth_token: message.data });
  } else if (message.type === "SAVE_IMAGE_DATA") {
    const { fileId, base64 } = message.data;
    chrome.storage.local.get(["image_cache"], (result) => {
      const cache = result.image_cache || {};
      cache[fileId] = base64;
      // Keep cache size reasonable (last 50 images)
      const keys = Object.keys(cache);
      if (keys.length > 50) {
        delete cache[keys[0]];
      }
      chrome.storage.local.set({ image_cache: cache });
    });
  } else if (message.type === "SAVE_FILE_URL") {
    const { fileId, url } = message.data;
    chrome.storage.local.get(["file_url_map"], (result) => {
      const map = result.file_url_map || {};
      map[fileId] = url;
      chrome.storage.local.set({ file_url_map: map });
    });
  } else if (message.type === "SAVE_DOWNLOAD_URL") {
    const { fileId, url } = message.data;
    chrome.storage.local.get(["download_url_map"], (result) => {
      const map = result.download_url_map || {};
      map[fileId] = url;
      chrome.storage.local.set({ download_url_map: map });
    });
  }
});
