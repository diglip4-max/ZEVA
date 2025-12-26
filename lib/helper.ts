import { OptionType } from "@/components/shared/CustomAsyncSelect";
import axios from "axios";
import moment from "moment";
import toast from "react-hot-toast";

export const loadSegmentOptions = async (
  inputValue: string,
  token: string
): Promise<OptionType[]> => {
  let options: OptionType[] = [];
  try {
    const { data } = await axios.get("/api/segments/get-segments", {
      params: {
        name: inputValue,
        status: "active",
      },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (data?.success) {
      const segments = data?.segments || [];
      options = segments?.map((s: any) => ({ label: s?.name, value: s?._id }));
    }
  } catch (error) {
    options = [];
  }
  return options;
};

export const getChannelTitle = (
  channel: "sms" | "whatsapp" | "voice" | "email" | "chat"
) => {
  switch (channel) {
    case "sms":
      return "SMS";
    case "whatsapp":
      return "WhatsApp";
    case "email":
      return "Email";
    case "chat":
      return "Live Chat";
    default:
      return "";
  }
};

export const getFormatedTime = (timestamp: string) => {
  if (!timestamp) return "";

  const now = moment();
  const createdAt = moment(timestamp);
  const diffInSeconds = now.diff(createdAt, "seconds");
  const diffInDays = now.diff(createdAt, "days");

  if (diffInSeconds < 60) {
    return diffInSeconds === 1 ? "1 sec ago" : `${diffInSeconds} sec ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = moment.duration(diffInSeconds, "seconds").minutes();
    return minutes === 1 ? "1 min ago" : `${minutes} min ago`;
  } else if (diffInDays === 0) {
    return createdAt.format("h:mm A"); // Show time if today
  } else if (diffInDays === 1) {
    return "Yesterday"; // Show "Yesterday" if it's from the previous day
  } else if (diffInDays < 7) {
    return createdAt.format("dddd"); // Show the weekday if within the last week
  } else {
    return createdAt.format("MM/DD/YYYY"); // Show full date for older timestamps
  }
};

export const capitalize = (s: string) => {
  if (typeof s !== "string") return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const handleError = (error: any) => {
  if (
    error &&
    error.response &&
    error.response.data &&
    error.response.data.message
  ) {
    toast.error(error.response.data.message);
  } else {
    toast.error(error?.message || "An unexpected error occurred");
  }
};

export const getMediaTypeFromMime = (mimetype: string) => {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  return "file";
};

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;

  if (bytes < mb) return `${(bytes / kb).toFixed(2)} KB`;
  if (bytes < gb) return `${(bytes / mb).toFixed(2)} MB`;
  return `${(bytes / gb).toFixed(2)} GB`;
};
