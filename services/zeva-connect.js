export async function notifyZevaConnectOfDeactivation(zevaUserId) {
  try {
    const apiKey = process.env.ZEVA_CONNECT_INTERNAL_API_KEY || "";
    if (!apiKey) {
      console.warn("ZEVA_CONNECT_INTERNAL_API_KEY is not set");
    }

    const url = `${process.env.ZEVA_CONNECT_URL}/internal-api/user-deactivated`;
    const { data } = await axios.post(
      url,
      { zevaUserId },
      {
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": apiKey,
        },
      },
    );
    console.log("User deactivated successfully", data);
  } catch (err) {
    // log kar, but staff-deactivation ka main flow fail nahi hona chahiye isके wajah se
    console.error("Failed to notify ZevaConnect of deactivation", err);
  }
}
