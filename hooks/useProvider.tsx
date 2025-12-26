import { Provider } from "@/types/conversations";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";

const useProvider = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [voiceProviders, setVoiceProviders] = useState<Provider[]>([]);
  const [smsProviders, setSmsProviders] = useState<Provider[]>([]);
  const [whatsappProviders, setWhatsappProviders] = useState<Provider[]>([]);
  const [emailProviders, setEmailProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("clinicToken") : null;

  const fetchProviders = useCallback(async () => {
    try {
      const { data } = await axios.get(`/api/providers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data && data?.success) {
        const providersData: Provider[] = data?.data;
        if (providersData?.length > 0) {
          const smsProviders = providersData?.filter((p) =>
            p?.type?.includes("sms")
          );
          const whatsappProviders = providersData?.filter((p) =>
            p?.type?.includes("whatsapp")
          );
          const voiceProviders = providersData?.filter((p) =>
            p?.type?.includes("voice")
          );
          const emailProviders = providersData?.filter((p) =>
            p?.type?.includes("email")
          );
          setProviders(providersData);
          setSmsProviders(smsProviders);
          setVoiceProviders(voiceProviders);
          setWhatsappProviders(whatsappProviders);
          setEmailProviders(emailProviders);
        }
      }
    } catch (error) {
      console.error("Error fetching providers:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, []);

  return {
    loading,
    providers,
    smsProviders,
    voiceProviders,
    whatsappProviders,
    emailProviders,
    setEmailProviders,
    fetchProviders,
  };
};

export default useProvider;
