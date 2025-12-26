import axios from "axios";

// Upload media file to server
export const uploadMedia = async (mediaBlob, ext) => {
  try {
    const filename = `${Date.now()}.${ext}`;

    // Convert Blob to Buffer
    const buffer = await mediaBlob.arrayBuffer(); // Convert to ArrayBuffer
    const nodeBuffer = Buffer.from(buffer); // Convert to Node.js Buffer

    const formData = new FormData();
    formData.append("file", nodeBuffer, { filename });

    const uploadResponse = await axios.post(
      `${config.SERVER_URL}/api/upload`,
      formData,
      {
        headers: {
          ...formData.getHeaders(), // Ensure correct headers
        },
      }
    );

    return uploadResponse.data.url || "";
  } catch (error) {
    console.error("Error uploading media:", error);
    return "";
  }
};
