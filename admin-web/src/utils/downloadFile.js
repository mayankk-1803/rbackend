/**
 * Authenticated file download helper.
 */
export const downloadFile = async (api, url, filename, params = {}) => {
  let objectUrl = null;
  try {
    const response = await api.get(url, {
      params,
      responseType: 'blob',
    });

    // Verify blob content
    if (!(response.data instanceof Blob)) {
      throw new Error("Invalid response format: Expected Blob");
    }

    const blob = new Blob([response.data], { 
      type: response.headers['content-type'] || 'application/octet-stream' 
    });
    
    objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return true;
  } catch (error) {
    console.error("[Download Helper Error]:", error);
    throw error;
  } finally {
    if (objectUrl) {
      // Delay revocation to ensure click event finishes in some browsers
      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 100);
    }
  }
};
