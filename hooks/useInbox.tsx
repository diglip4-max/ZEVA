import { ConversationType, MessageType, Provider } from "@/types/conversations";
import axios from "axios";
import React, { useCallback, useEffect, useState } from "react";
import useProvider from "./useProvider";
import useTemplate from "./useTemplate";
import toast from "react-hot-toast";
import {
  formatFileSize,
  getMediaTypeFromMime,
  handleError,
} from "@/lib/helper";

export type VariableType = {
  type: "text";
  text: string;
};

interface IState {
  conversations: ConversationType[];
}

const useInbox = () => {
  const { providers } = useProvider();
  const { templates } = useTemplate();
  const [conversations, setConversations] = useState<IState["conversations"]>(
    []
  );
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<ConversationType | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(
    null
  );
  const [currentConvPage, setCurrentConvPage] = useState<number>(1);
  const [totalConversations, setTotalConversations] = useState<number>(0);
  const [hasMoreConversations, setHasMoreConversations] =
    useState<boolean>(true);
  const [fetchConvLoading, setFetchConvLoading] = useState<boolean>(true);

  const [currentMsgPage, setCurrentMsgPage] = useState<number>(1);
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(true);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>("");
  const [mediaType, setMediaType] = useState<any>("");
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [bodyParameters, setBodyParameters] = useState<VariableType[]>([]);
  const [headerParameters, setHeaderParameters] = useState<VariableType[]>([]);
  const [sendMsgLoading, setSendMsgLoading] = useState<boolean>(false);
  const [isLiveChatSelected, setIsLiveChatSelected] = useState<boolean>(false);
  const [subject, setSubject] = useState<string>("");
  const [selectedMessage, setSelectedMessage] = useState<MessageType | null>(
    null
  );
  const [isScrolledToBottom, setIsScrolledToBottom] = useState<boolean>(false);

  const [searchConvInput, setSearchConvInput] = useState<string>("");

  const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const conversationRef = React.useRef<HTMLDivElement | null>(null);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("clinicToken") : null;

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      setFetchConvLoading(true);
      const res = await axios.get("/api/conversations", {
        params: { page: currentConvPage, limit: 20 },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) {
        // If requesting first page, replace conversations; otherwise append
        const newConvs = res.data.conversations || [];
        if (currentConvPage === 1) {
          setConversations(newConvs);
        } else {
          setConversations((prev) => [...prev, ...newConvs]);
        }
        setTotalConversations(res?.data?.pagination?.totalConversations || 0);
        setHasMoreConversations(Boolean(res?.data?.pagination?.hasMore));
      } else {
        setConversations([]);
      }
    } catch (error) {
      setConversations([]);
    } finally {
      setFetchConvLoading(false);
    }
  }, [currentConvPage, token]);

  const fetchMessages = useCallback(async () => {
    if (!token) return;
    if (!selectedConversation) return;
    try {
      const res = await axios.get(
        `/api/messages/get-messages/${selectedConversation?._id}`,
        {
          params: { page: currentConvPage, limit: 20 },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.data?.success) {
        // If requesting first page, replace conversations; otherwise append
        const newMsgs = res.data.messages || [];
        if (currentMsgPage === 1) {
          setMessages(newMsgs);
        } else {
          setMessages((prev) => [...prev, ...newMsgs]);
        }
        setTotalMessages(res?.data?.pagination?.totalMessages || 0);
        setHasMoreMessages(Boolean(res?.data?.pagination?.hasMore));
      } else {
        setMessages([]);
      }
    } catch (error) {
      setMessages([]);
    }
  }, [selectedConversation, currentConvPage, token]);

  const handleSendMessage = async () => {
    if (!selectedConversation) return;
    if (!textAreaRef?.current?.value && !attachedFile) return;
    if (!selectedProvider && !isLiveChatSelected) {
      toast.error("Please select a provider");
      return;
    }

    const channel = selectedProvider?.type[0];

    let mediaUrl;

    let attachmentFile = attachedFile;
    setSendMsgLoading(true);
    if (attachedFile) {
      //   const resData = await handleUpload(attachedFile);
      //   if (resData && resData?.success) {
      //     mediaUrl = resData?.url;
      //     setMediaUrl(resData?.url);
      //   }
    }

    let attachments: any[] = [];
    if (mediaUrl && attachedFile) {
      attachments = [
        {
          fileName: attachedFile?.name,
          fileSize: attachedFile?.size.toString(),
          mimeType: attachedFile?.type,
          mediaUrl: mediaUrl,
          mediaType: getMediaTypeFromMime(attachedFile?.type),
        },
      ];
    }
    const tempMessageId = Date.now()?.toString(); // Ensure a unique identifier
    const tempMessage = {
      _id: tempMessageId,
      conversationId: selectedConversation._id,
      senderId: "",
      recipientId: selectedConversation.leadId?._id,
      channel: isLiveChatSelected ? "chat" : channel,
      messageType: "conversational",
      direction: "outgoing",
      subject: subject,
      content: textAreaRef?.current?.value,
      provider: selectedProvider?._id,
      status: "sending", // Temporary status
      mediaUrl,
      mediaType,
      source: "Zeva",
      replyToMessageId: selectedMessage,
      attachments,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setSelectedMessage(null);

    // If the date group does not exist, add it at the end to preserve order
    const finalMessages = [...messages, tempMessage];

    // @ts-ignore
    setMessages(finalMessages);
    setIsScrolledToBottom(!isScrolledToBottom);
    setMessage("");
    setMediaType("");
    setMediaUrl("");
    setAttachedFile(null);
    setSubject("");

    try {
      let data;
      if (isLiveChatSelected) {
        const payload = {
          conversationId: selectedConversation._id,
          recipientId: selectedConversation.leadId?._id,
          channel: "chat",
          content: tempMessage.content,
          mediaUrl: tempMessage.mediaUrl,
          mediaType: tempMessage.mediaType,
          attachments: tempMessage?.attachments,
          source: "Zeva",
        };
        const response = await axios.post(
          "/api/messages/sendLiveMessage",
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        data = response?.data;
      } else if (selectedProvider?.type?.includes("email")) {
        const payload = {
          conversationId: selectedConversation._id,
          recipientIds: [selectedConversation.leadId?._id],
          channel: "email",
          subject: tempMessage.subject,
          content: tempMessage.content,
          source: "Zeva",
          providerId: selectedProvider?._id,
          replyToMessageId: tempMessage?.replyToMessageId?._id,
          quotedMessageId: tempMessage?.replyToMessageId?.providerMessageId,
          attachments: attachmentFile
            ? [
                {
                  fileName: attachmentFile?.name,
                  fileSize: formatFileSize(attachmentFile?.size),
                  mimeType: attachmentFile?.type,
                  mediaUrl,
                  mediaType: getMediaTypeFromMime(attachmentFile?.type),
                },
              ]
            : [],
        };

        const response = await axios.post(
          "/api/messages/sendEmailMessage",
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        data = response?.data;
      } else {
        const response = await axios.post(
          "/api/messages/send-message",
          {
            conversationId: selectedConversation._id,
            recipientId: selectedConversation.leadId?._id,
            providerId: selectedProvider?._id,
            channel,
            content: tempMessage.content,
            mediaUrl: tempMessage.mediaUrl,
            mediaType: tempMessage.mediaType,
            source: "Zeva",
            messageType: tempMessage?.messageType,
            templateId: selectedTemplate?._id,
            // for reply message
            replyToMessageId: tempMessage?.replyToMessageId?._id,
            quotedMessageId: tempMessage?.replyToMessageId?.providerMessageId,
            // for whatsapp template if body variables exist
            headerParameters,
            bodyParameters,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        data = response?.data;
      }

      if (data && data.success) {
        const newMessage = data.data;

        const updatedFinalMessages = finalMessages.map((msg) =>
          msg._id === tempMessageId ? newMessage : msg
        );

        setMessages(updatedFinalMessages);
        setSelectedTemplate(null);

        let updatedConversations = conversations?.map((c) =>
          c?._id === selectedConversation?._id
            ? { ...selectedConversation, recentMessage: newMessage }
            : c
        );

        // updatedConversations = getUniqueConversations(updatedConversations);

        // Move the updated conversation to the front
        const sortedConversations = updatedConversations?.sort((a) =>
          a?._id === selectedConversation?._id ? -1 : 1
        );

        setConversations(sortedConversations);

        // empty body and header variables
        setHeaderParameters([]);
        setBodyParameters([]);
      }
    } catch (error) {
      const errorHandledMessages = finalMessages.filter(
        (msg) => msg._id !== tempMessageId
      );
      //   @ts-ignore
      setMessages(errorHandledMessages);
      handleError(error);
    } finally {
      setSendMsgLoading(false);
    }
  };

  const handleReadConversation = async (conversationId: string) => {
    if (!token) return;
    if (!conversationId) return;
    try {
      const { data } = await axios.patch(
        `/api/conversations/read-conversation/${conversationId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (data && data?.success) {
        // Update conversations state to mark as read
        const updatedConversations = conversations.map((conv) =>
          conv._id === conversationId ? { ...conv, unreadMessages: [] } : conv
        );
        setConversations(updatedConversations);
      }
    } catch (error) {
      handleError(error);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [currentConvPage, token, fetchConversations]);

  useEffect(() => {
    if (!selectedConversation) return;
    setMessages([]);
    setCurrentMsgPage(1);
    fetchMessages();
  }, [selectedConversation, currentMsgPage, token, fetchMessages]);

  useEffect(() => {
    if (providers.length === 0) return;
    setSelectedProvider(providers[0]);
  }, [providers]);

  useEffect(() => {
    setCurrentConvPage(1);
  }, [searchConvInput]);

  useEffect(() => {
    if (selectedConversation) {
      handleReadConversation(selectedConversation._id);
    }
  }, [selectedConversation]);

  const state = {
    conversations,
    selectedConversation,
    selectedProvider,
    hasMoreConversations,
    fetchConvLoading,
    totalConversations,
    currentConvPage,
    setCurrentConvPage,
    conversationRef,
    providers,
    templates,
    attachedFile,
    selectedTemplate,
    message,
    textAreaRef,
    mediaType,
    mediaUrl,
    sendMsgLoading,
    messages,
    totalMessages,
    hasMoreMessages,
    isScrolledToBottom,
    subject,
    selectedMessage,
    bodyParameters,
    headerParameters,
    isLiveChatSelected,
    searchConvInput,
  };

  return {
    state,
    setConversations,
    setFetchConvLoading,
    setSelectedConversation,
    setSelectedProvider,
    setAttachedFile,
    setSelectedTemplate,
    setMessage,
    setMediaType,
    setBodyParameters,
    setHeaderParameters,
    setIsLiveChatSelected,
    setSearchConvInput,
    handleSendMessage,
    handleReadConversation,
  };
};

export default useInbox;
