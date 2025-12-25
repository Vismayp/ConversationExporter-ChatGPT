class ImageFetcher {
  constructor(authToken) {
    this.authToken = authToken;
    this.imageMap = {};
  }

  setAuthToken(token) {
    this.authToken = token;
  }

  async fetchImageAsBase64(fileId, conversationId) {
    // 1. Check cache first
    const cached = await new Promise((resolve) => {
      chrome.storage.local.get(["image_cache"], (res) => {
        resolve(res.image_cache ? res.image_cache[fileId] : null);
      });
    });
    if (cached) return cached;

    // 2. Check for download URL
    const downloadUrl = await new Promise((resolve) => {
      chrome.storage.local.get(["download_url_map"], (res) => {
        resolve(res.download_url_map ? res.download_url_map[fileId] : null);
      });
    });

    // 3. If no download URL, fetch it from the download endpoint
    let imageUrl = downloadUrl;
    if (!imageUrl && conversationId) {
      const downloadEndpoint = `https://chatgpt.com/backend-api/files/download/${fileId}?conversation_id=${conversationId}&inline=false`;
      try {
        const headers = this.authToken ? { Authorization: this.authToken } : {};
        const dlResponse = await fetch(downloadEndpoint, { headers });
        if (dlResponse.ok) {
          const dlData = await dlResponse.json();
          if (dlData.download_url) {
            imageUrl = dlData.download_url;
          }
        }
      } catch (err) {
        // Silent error
      }
    }

    // 4. Fallback to standard URL
    if (!imageUrl) {
      imageUrl = `https://chatgpt.com/backend-api/files/${fileId}/content`;
      if (conversationId) {
        imageUrl += `?conversation_id=${conversationId}`;
      }
    }

    try {
      const headers = {};
      if (this.authToken) {
        headers["Authorization"] = this.authToken;
      }
      let response = await fetch(imageUrl, { headers });

      const contentType = response.headers.get("content-type") || "";
      if (response.ok && contentType.includes("application/json")) {
        const jsonData = await response.json();
        if (jsonData.download_url) {
          response = await fetch(jsonData.download_url, { headers });
        }
      }

      if (!response.ok) {
        if (response.status === 404 && imageUrl.includes("?")) {
          return this.fetchImageAsBase64_Simple(fileId);
        }
        throw new Error("Failed to fetch image");
      }
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result);
        };
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      return null;
    }
  }

  async fetchImageAsBase64_Simple(fileId) {
    const imageUrl = `https://chatgpt.com/backend-api/files/${fileId}/content`;
    try {
      const headers = this.authToken ? { Authorization: this.authToken } : {};
      let response = await fetch(imageUrl, { headers });

      const contentType = response.headers.get("content-type") || "";
      if (response.ok && contentType.includes("application/json")) {
        const jsonData = await response.json();
        if (jsonData.download_url) {
          response = await fetch(jsonData.download_url, { headers });
        }
      }

      if (!response.ok) return null;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return null;
    }
  }

  extractAllFileIds(conversationData) {
    const fileIds = new Set();
    if (!conversationData || !conversationData.mapping) return fileIds;

    const mapping = conversationData.mapping;
    for (const nodeId in mapping) {
      const node = mapping[nodeId];
      const message = node.message;
      if (!message) continue;

      // 1. Check content parts
      if (message.content && message.content.parts) {
        message.content.parts.forEach((part) => {
          if (typeof part === "string") {
            const matches = part.matchAll(/file_[a-zA-Z0-9]+/g);
            for (const match of matches) {
              fileIds.add(match[0]);
            }
          } else if (typeof part === "object") {
            const partType = part.type || part.content_type;
            if (partType === "image_asset_pointer") {
              const assetId = (part.asset_pointer || "").replace("sediment://", "");
              if (assetId) fileIds.add(assetId);
            } else if (partType === "multimodal_text") {
              (part.content || []).forEach((subPart) => {
                if (typeof subPart === "object" && subPart.type === "image_asset_pointer") {
                  const assetId = (subPart.asset_pointer || "").replace("sediment://", "");
                  if (assetId) fileIds.add(assetId);
                }
              });
            }
          }
        });
      }

      // 2. Metadata attachments
      const attachments = (message.metadata && message.metadata.attachments) || [];
      attachments.forEach((att) => {
        if (att.id) fileIds.add(att.id);
      });

      // 3. Content references
      const contentRefs = (message.metadata && message.metadata.content_references) || [];
      contentRefs.forEach((ref) => {
        if (ref.type === "image" && ref.file_id) {
          fileIds.add(ref.file_id);
        } else if (ref.type === "image_group" && ref.images) {
          ref.images.forEach((img) => {
            if (img.image_result && img.image_result.file_id) {
              fileIds.add(img.image_result.file_id);
            }
          });
        }
      });
    }

    return fileIds;
  }

  async preFetchMissingDownloadUrls(conversationData) {
    if (!conversationData || !this.authToken) return;

    const allFileIds = this.extractAllFileIds(conversationData);
    if (allFileIds.size === 0) return;

    // Get existing download URLs
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(["download_url_map"], resolve);
    });
    const downloadUrlMap = result.download_url_map || {};

    // Find missing download URLs
    const missingFileIds = Array.from(allFileIds).filter(
      (id) => !downloadUrlMap[id]
    );

    if (missingFileIds.length === 0) return;

    // Fetch missing download URLs
    const fetchPromises = missingFileIds.map(async (fileId) => {
      try {
        const downloadEndpoint = `https://chatgpt.com/backend-api/files/download/${fileId}?conversation_id=${conversationData.id}&inline=false`;
        const response = await fetch(downloadEndpoint, {
          headers: { Authorization: this.authToken },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.download_url) {
            downloadUrlMap[fileId] = data.download_url;
            return true;
          }
        }
      } catch (err) {
        // Silent error
      }
      return false;
    });

    const results = await Promise.all(fetchPromises);
    const successCount = results.filter(Boolean).length;

    // Save updated map to storage
    if (successCount > 0) {
      await new Promise((resolve) => {
        chrome.storage.local.set({ download_url_map: downloadUrlMap }, resolve);
      });
    }
  }

  async getAllImages(data, statusCallback) {
    const imageMap = {};
    const conversationId = data.id;

    const fileIds = this.extractAllFileIds(data);

    if (fileIds.size > 0 && statusCallback) {
      statusCallback(fileIds.size);
    }

    const promises = Array.from(fileIds).map(async (id) => {
      const base64 = await this.fetchImageAsBase64(id, conversationId);
      if (base64) imageMap[id] = base64;
    });

    await Promise.all(promises);
    return imageMap;
  }
}
