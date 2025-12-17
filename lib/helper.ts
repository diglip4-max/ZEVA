import { OptionType } from "@/components/shared/CustomAsyncSelect";
import axios from "axios";

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
