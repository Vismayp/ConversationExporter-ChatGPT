(function () {
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  // Intercept fetch
  window.fetch = async (...args) => {
    let url = args[0];
    let options = args[1] || {};
    if (url instanceof Request) {
      options = args[0];
      url = options.url;
    }

    const urlString = url.toString();
    const response = await originalFetch(...args);

    // Capture Authorization header
    let auth = null;
    try {
      if (args[1] && args[1].headers) {
        if (args[1].headers instanceof Headers) {
          auth = args[1].headers.get("Authorization");
        } else {
          auth =
            args[1].headers["Authorization"] ||
            args[1].headers["authorization"];
        }
      }
      if (!auth && args[0] instanceof Request) {
        auth = args[0].headers.get("Authorization");
      }
    } catch (e) {}

    if (auth && urlString.includes("/backend-api/")) {
      window.postMessage({ type: "CHATGPT_AUTH_TOKEN", payload: auth }, "*");
    }

    // Handle file download endpoint (gets signed URL)
    if (urlString.includes("/backend-api/files/download/file_")) {
      const match = urlString.match(/\/download\/(file_[a-zA-Z0-9]+)/);
      const fileId = match ? match[1] : null;

      if (fileId) {
        const clone = response.clone();
        clone
          .json()
          .then((data) => {
            if (data.download_url) {
              window.postMessage(
                {
                  type: "CHATGPT_DOWNLOAD_URL",
                  payload: { fileId, url: data.download_url },
                },
                "*"
              );
            }
          })
          .catch(() => {});
      }
      return response;
    }

    // Handle direct image requests
    if (
      (urlString.includes("id=file_") || urlString.includes("/file_")) &&
      !urlString.includes("/download/")
    ) {
      try {
        let fileId = null;
        try {
          const urlObj = new URL(urlString);
          fileId = urlObj.searchParams.get("id");
        } catch {}

        if (!fileId) {
          const match = urlString.match(/(?:id=|\/)(file_[a-zA-Z0-9]+)/);
          fileId = match ? match[1] : null;
        }

        if (fileId && fileId.startsWith("file_")) {
          const clone = response.clone();
          clone
            .blob()
            .then((blob) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                window.postMessage(
                  {
                    type: "CHATGPT_IMAGE_DATA",
                    payload: { fileId, base64: reader.result },
                  },
                  "*"
                );
              };
              reader.readAsDataURL(blob);
            })
            .catch(() => {});
        }
      } catch (e) {}
    }

    // Capture conversation data
    if (
      urlString.includes("/backend-api/conversation/") ||
      urlString.includes("/backend-api/conversations")
    ) {
      if (urlString.endsWith("/conversations")) return response;

      const clone = response.clone();
      clone
        .json()
        .then((data) => {
          if (data && (data.mapping || data.messages)) {
            window.postMessage(
              {
                type: "CHATGPT_CONVERSATION_DATA",
                payload: data,
              },
              "*"
            );
          }
        })
        .catch(() => {});
    }

    return response;
  };

  // Intercept XMLHttpRequest
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._url = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    const url = this._url;

    if (url && (url.includes("id=file_") || url.includes("/file_"))) {
      this.addEventListener("load", function () {
        try {
          let fileId = null;
          const match = url.match(/(?:id=|\/)(file_[a-zA-Z0-9]+)/);
          fileId = match ? match[1] : null;

          if (
            (fileId && this.responseType === "blob") ||
            this.response instanceof Blob
          ) {
            const blob = this.response;
            const reader = new FileReader();
            reader.onloadend = () => {
              window.postMessage(
                {
                  type: "CHATGPT_IMAGE_DATA",
                  payload: { fileId, base64: reader.result },
                },
                "*"
              );
            };
            reader.readAsDataURL(blob);
          }
        } catch (e) {}
      });
    }

    return originalXHRSend.apply(this, args);
  };
})();
