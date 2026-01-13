import { ConversationType, MessageType, Provider } from "@/types/conversations";
import axios from "axios";
import React, { useCallback, useEffect, useState } from "react";
import useProvider from "./useProvider";
import useTemplate from "./useTemplate";
import toast from "react-hot-toast";
import {
  formatFileSize,
  getMediaTypeFromFile,
  getMediaTypeFromMime,
  handleError,
  handleUpload,
} from "@/lib/helper";
import debounce from "lodash.debounce";
import { io, Socket } from "socket.io-client";
import { jwtDecode } from "jwt-decode";
import useAgents from "./useAgents";
import { User } from "@/types/users";
import { Template } from "@/types/templates";

export type VariableType = {
  type: "text";
  text: string;
};

interface IState {
  conversations: ConversationType[];
  filters: {
    status: string;
  };
}

interface DecodedToken {
  userId: string;
  [key: string]: unknown;
}

export const TAG_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-green-100 text-green-800 border-green-200",
  "bg-yellow-100 text-yellow-800 border-yellow-200",
  "bg-purple-100 text-purple-800 border-purple-200",
  "bg-pink-100 text-pink-800 border-pink-200",
  "bg-indigo-100 text-indigo-800 border-indigo-200",
  "bg-red-100 text-red-800 border-red-200",
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-cyan-100 text-cyan-800 border-cyan-200",
];

export const getTagColor = (tag: string) => {
  // Create a simple hash for consistent coloring
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TAG_COLORS.length;
  return TAG_COLORS[index];
};

export const tags = ["Important", "Follow-up", "Urgent", "Review", "Personal"];

let socket: Socket | null = null;

const useInbox = () => {
  const { providers } = useProvider();
  const { templates } = useTemplate();
  const agents = useAgents()?.state?.agents || [];
  const agentFetchLoading = useAgents()?.state?.loading || false;
  const [_userId, setUserId] = useState<string | null>(null);
  const [fetchConvLoading, setFetchConvLoading] = useState<boolean>(true);
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

  const [currentMsgPage, setCurrentMsgPage] = useState<number>(1);
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
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
  const [showScrollButton, setShowScrollButton] = useState<boolean>(false);
  const [whatsappRemainingTime, setWhatsappRemainingTime] =
    useState<string>("");

  // conversation status options
  const [conversationStatusOptions, setConversationStatusOptions] = useState<
    { label: string; value: string }[]
  >([
    { label: "All", value: "all" },
    { label: "Read", value: "read" },
    { label: "Unread", value: "unread" },
    { label: "Open", value: "open" },
    { label: "Closed", value: "closed" },
    { label: "Archived", value: "archived" },
    { label: "Blocked", value: "blocked" },
    { label: "Trashed", value: "trashed" },
  ]);
  const [filters, setFilters] = useState<IState["filters"]>({
    status: "all",
  });
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [isMobileView, setIsMobileView] = useState<boolean>(false);
  const [isAddTagModalOpen, setIsAddTagModalOpen] = useState<boolean>(false);
  const [isDeleteConversationModalOpen, setIsDeleteConversationModalOpen] =
    useState<boolean>(false);
  const [isDeletingConversation, setIsDeletingConversation] =
    useState<boolean>(false);

  const [isAddingTag, setIsAddingTag] = useState<boolean>(false);

  // Conversation assignment logic
  const [selectedAgent, setSelectedAgent] = useState<User | null>(null);

  // schedule message state
  const [isScheduleModalOpen, setIsScheduleModalOpen] =
    useState<boolean>(false);

  const statusDropdownRef = React.useRef<HTMLDivElement | null>(null);
  const statusBtnRef = React.useRef<HTMLButtonElement | null>(null);

  const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const conversationRef = React.useRef<HTMLDivElement | null>(null);
  const messageRef = React.useRef<HTMLDivElement | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("clinicToken") : null;

  // Scroll to bottom
  const handleScrollMsgsToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversations = useCallback(
    debounce(async (page = 1) => {
      if (!token) return;
      try {
        setFetchConvLoading(true);
        const res = await axios.get("/api/conversations", {
          params: {
            page: page,
            limit: 10,
            search: searchConvInput,
            status: filters.status,
          },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.success) {
          // If requesting first page, replace conversations; otherwise append
          const newConvs: ConversationType[] = res.data.conversations || [];
          if (page === 1) {
            const sortedConvs = newConvs.sort((a, b) => {
              const dateA = a.recentMessage?.createdAt
                ? new Date(a.recentMessage.createdAt).getTime()
                : 0;
              const dateB = b.recentMessage?.createdAt
                ? new Date(b.recentMessage.createdAt).getTime()
                : 0;
              return dateB - dateA;
            });
            setConversations(sortedConvs);
          } else {
            setConversations((prev) =>
              [...prev, ...newConvs]?.sort((a, b) => {
                const dateA = a.recentMessage?.createdAt
                  ? new Date(a.recentMessage.createdAt).getTime()
                  : 0;
                const dateB = b.recentMessage?.createdAt
                  ? new Date(b.recentMessage.createdAt).getTime()
                  : 0;
                return dateB - dateA;
              })
            );
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
    }, 300),
    [currentConvPage, token, searchConvInput, filters]
  );

  const fetchMessages = useCallback(
    debounce(async () => {
      if (!token) return;
      if (!selectedConversation) return;
      try {
        const res = await axios.get(
          `/api/messages/get-messages/${selectedConversation?._id}`,
          {
            params: { page: currentMsgPage, limit: 500 },
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
    }, 300),
    [selectedConversation, currentMsgPage, token]
  );

  const handleSendMessage = async () => {
    if (!selectedConversation) return;
    if (
      !textAreaRef?.current?.value &&
      !attachedFile &&
      attachedFiles.length === 0
    )
      return;
    if (!selectedProvider && !isLiveChatSelected) {
      toast.error("Please select a provider");
      return;
    }

    const channel = selectedProvider?.type[0];

    let mediaFileUrl = mediaUrl;
    let mediaFileType = mediaType;

    let attachmentFile = attachedFile;
    // Use attachedFiles (multiple) if present, otherwise fallback to single attachedFile
    const attachmentsFilesToUse =
      attachedFiles && attachedFiles.length
        ? attachedFiles
        : attachedFile
        ? [attachedFile]
        : [];
    console.log("Attachments to use:", attachmentsFilesToUse);
    setSendMsgLoading(true);

    // for attachments upload
    if (attachedFile) {
      const resData = await handleUpload(attachedFile);
      if (resData && resData?.success) {
        mediaFileUrl = resData?.url;
        mediaFileType = getMediaTypeFromFile(attachedFile);
        setMediaUrl(resData?.url);
      }
    }

    let attachments: any[] = [];
    if (mediaUrl && attachmentsFilesToUse.length) {
      attachments = attachmentsFilesToUse.map((f) => ({
        fileName: f?.name,
        fileSize: f?.size.toString(),
        mimeType: f?.type,
        mediaUrl: mediaFileUrl,
        mediaType: getMediaTypeFromMime(f?.type),
      }));
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
      mediaUrl: mediaFileUrl,
      mediaType: mediaFileType,
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
            attachments,
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
        // clear attached files after successful send
        setAttachedFile(null);
        setAttachedFiles([]);
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

  const handleScheduleMessage = async (scheduledData: {
    scheduledDate: string;
    scheduledTime: string;
    scheduledTimezone: string;
  }) => {
    console.log("Scheduling message:", scheduledData);

    if (!selectedConversation) return;
    if (
      !textAreaRef?.current?.value &&
      !attachedFile &&
      attachedFiles.length === 0
    )
      return;
    if (!selectedProvider && !isLiveChatSelected) {
      toast.error("Please select a provider");
      return;
    }

    const channel = selectedProvider?.type[0];

    let mediaFileUrl = "";
    let mediaFileType = "";

    let attachmentFile = attachedFile;
    // Use attachedFiles (multiple) if present, otherwise fallback to single attachedFile
    const attachmentsFilesToUse =
      attachedFiles && attachedFiles.length
        ? attachedFiles
        : attachedFile
        ? [attachedFile]
        : [];
    console.log("Attachments to use:", attachmentsFilesToUse);
    setSendMsgLoading(true);

    // for attachments upload
    if (attachedFile) {
      const resData = await handleUpload(attachedFile);
      if (resData && resData?.success) {
        mediaFileUrl = resData?.url;
        mediaFileType = getMediaTypeFromFile(attachedFile);
        setMediaUrl(resData?.url);
      }
    }

    let attachments: any[] = [];
    if (mediaUrl && attachmentsFilesToUse.length) {
      attachments = attachmentsFilesToUse.map((f) => ({
        fileName: f?.name,
        fileSize: f?.size.toString(),
        mimeType: f?.type,
        mediaUrl: mediaFileUrl,
        mediaType: getMediaTypeFromMime(f?.type),
      }));
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
      mediaUrl: mediaFileUrl,
      mediaType: mediaFileType,
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
          "/api/messages/schedule-message",
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
            attachments,
            ...scheduledData,
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
        // clear attached files after successful send
        setAttachedFile(null);
        setAttachedFiles([]);
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
      setIsScheduleModalOpen(false);
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

  // Infinite scroll handler
  const handleConvScroll = () => {
    const el = conversationRef.current;
    if (!el || !hasMoreConversations) return;
    const nearBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 60; // 60px threshold
    if (nearBottom) {
      setCurrentConvPage((p) => p + 1);
    }
  };

  // Infinite scroll handler
  const handleMsgScroll = () => {
    const el = messageRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= 60; // 60px threshold

    // Toggle the scroll-to-bottom button: show when user is not near bottom
    setShowScrollButton(!nearBottom);

    // Pagination: only load more when near bottom and there are more messages
    if (nearBottom && hasMoreMessages) {
      setCurrentMsgPage((p) => p + 1);
    }
  };

  const checkWhatsappAvailabilityWindow = useCallback(async () => {
    try {
      const { data } = await axios.get(
        `/api/conversations/whatsapp-window/${selectedConversation?._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (data && data?.success) {
        setWhatsappRemainingTime(data?.remainingTime);
      }
    } catch (error) {
      handleError(error);
    }
  }, [selectedConversation]);

  const handleDeleteConversation = async (conversationId: string) => {
    if (!token) return;
    try {
      setIsDeletingConversation(true);
      const { data } = await axios.delete(
        `/api/conversations/delete-conversation/${conversationId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (data && data?.success) {
        // Remove conversation from state
        const updatedConversations = conversations.filter(
          (conv) => conv._id !== conversationId
        );
        setConversations(updatedConversations);
        setSelectedConversation(null);
        setIsDeleteConversationModalOpen(false);
        setTotalConversations((prev) => prev - 1);
        toast.success("Conversation deleted successfully");
      }
    } catch (error) {
      handleError(error);
    } finally {
      setIsDeletingConversation(false);
    }
  };

  const handleAddTagToConversation = async (
    conversationId: string,
    tag: string
  ) => {
    if (!token) return;
    try {
      setIsAddingTag(true);
      const { data } = await axios.post(
        `/api/conversations/add-tags/${conversationId}`,
        { tags: [tag] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data && data?.success) {
        // Update conversation in state
        const updatedConversations = conversations.map((conv) =>
          conv._id === conversationId
            ? { ...conv, tags: data?.data?.tags || [] }
            : conv
        );
        console.log(
          "Updated Conversations after adding tag:",
          updatedConversations
        );
        setSelectedConversation((prev) =>
          prev && prev._id === conversationId
            ? { ...prev, tags: data?.data?.tags || [] }
            : prev
        );
        console.log({ t: data?.data?.tags });
        setConversations(updatedConversations);
        setIsAddTagModalOpen(false);
        toast.success("Tag added successfully");
      }
    } catch (error) {
      handleError(error);
    } finally {
      setIsAddingTag(false);
    }
  };

  const handleRemoveTagFromConversation = async (
    conversationId: string,
    tag: string
  ) => {
    if (!token) return;
    try {
      const { data } = await axios.post(
        `/api/conversations/remove-tag/${conversationId}`,
        { tag: tag },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data && data?.success) {
        // Update conversation in state
        const updatedConversations = conversations.map((conv) =>
          conv._id === conversationId
            ? { ...conv, tags: data?.data?.tags || [] }
            : conv
        );
        setSelectedConversation((prev) =>
          prev && prev._id === conversationId
            ? { ...prev, tags: data?.data?.tags || [] }
            : prev
        );
        setConversations(updatedConversations);
        toast.success("Tag removed successfully");
      }
    } catch (error) {
      handleError(error);
    }
  };

  const handleAgentSelect = async (
    agent: User | null,
    conversationId: string
  ) => {
    setSelectedAgent(agent);
    // Here you would typically make an API call to assign the conversation
    console.log("Assigned conversation to:", agent);
    if (!agent) return;
    try {
      const { data } = await axios.post(
        `/api/conversations/assign-conversation/${conversationId}`,
        {
          ownerId: agent?._id,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (data && data?.success) {
        // Update conversation in state
        const updatedConversations = conversations.map((conv) =>
          conv._id === conversationId ? { ...conv, ownerId: agent?._id } : conv
        );
        setSelectedConversation((prev) =>
          prev && prev._id === conversationId
            ? { ...prev, ownerId: agent?._id }
            : prev
        );
        setConversations(updatedConversations);
        toast.success("Conversation assigned successfully");
      }
    } catch (err) {
      handleError(err);
    }
  };

  // select agent by default based on selected conversation
  useEffect(() => {
    if (selectedConversation && agents?.length > 0) {
      const findConvOwner = agents?.find(
        (agent) => agent?._id === selectedConversation?.ownerId
      );
      if (findConvOwner) setSelectedAgent(findConvOwner);
      else setSelectedAgent(null);
    }
  }, [agents, selectedConversation]);

  // Check viewport on mount and window resize
  useEffect(() => {
    const checkMobileView = () => {
      // Using common mobile breakpoint (768px)
      setIsMobileView(window.innerWidth < 768);
    };

    // Initial check
    checkMobileView();

    // Add resize event listener
    window.addEventListener("resize", checkMobileView);

    // Cleanup
    return () => {
      window.removeEventListener("resize", checkMobileView);
    };
  }, []);

  // Socket connection
  useEffect(() => {
    if (!token) return;

    // Type assertion to satisfy TS
    const decoded = jwtDecode(token) as DecodedToken;
    setUserId(decoded.userId);

    socket = io({
      path: "/api/messages/socketio",
      query: { userId: decoded.userId },
    });
    socket.emit("register", decoded.userId);

    socket.on("incomingMessage", (message: MessageType) => {
      console.log("Incoming message via socket:", message);
      console.log({
        selectedConversationId: selectedConversation?._id,
        messageConversationId: message.conversationId,
      });

      // Update conversations list
      setConversations((prevConversations) => {
        let convExists = false;
        const updatedConversations = prevConversations.map((conv) => {
          if (conv._id === message.conversationId) {
            convExists = true;
            return {
              ...conv,
              recentMessage: message,
              unreadMessages: [...conv.unreadMessages, message._id],
            };
          }
          return conv;
        });

        // If conversation doesn't exist, optionally fetch it from server
        if (!convExists) {
          // TODO: For simplicity, we won't fetch the full conversation here. In a real app, you might want to do that.
          // TODO: You can also show a toast notification for new conversation message
          // TODO: For now, just return previous conversations
          // TODO: Alternatively, you could add the new conversation to the list if you have its details or you can fetch it.
          return prevConversations;
        }
        // Move the updated conversation to the front
        updatedConversations.sort((a, b) =>
          a._id === message.conversationId
            ? -1
            : b._id === message.conversationId
            ? 1
            : 0
        );
        return updatedConversations;
      });

      // Update messages if it belongs to the selected conversation
      if (message.conversationId === selectedConversation?._id) {
        if (message?.channel === "whatsapp") checkWhatsappAvailabilityWindow();
        setMessages((prev) => [...prev, message]);
      }
    });

    socket.on("messageStatusUpdate", (message: any) => {
      console.log("Message status update:", message);
      console.log({
        selectedConversationId: selectedConversation?._id,
        messageConversationId: message.conversationId,
        status: message.status,
      });
      if (message.conversationId === selectedConversation?._id) {
        const updatedMessages = messages.map((msg) =>
          msg._id === message._id ? { ...msg, status: message.status } : msg
        );
        setMessages(updatedMessages);
      }
    });

    return () => {
      socket?.disconnect();
    };
  }, [token, selectedConversation, messages]);

  // status filter dropdown click outside handler
  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(e.target as Node) &&
        statusBtnRef.current &&
        !statusBtnRef.current.contains(e.target as Node)
      ) {
        setShowStatusDropdown(false);
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowStatusDropdown(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  useEffect(() => {
    fetchConversations(currentConvPage);
  }, [currentConvPage, token, searchConvInput, fetchConversations]);

  useEffect(() => {
    setCurrentConvPage(1);
    fetchConversations(1);
  }, [filters]);

  useEffect(() => {
    if (!selectedConversation) return;
    setMessages([]);
    setCurrentMsgPage(1);
  }, [selectedConversation]);

  useEffect(() => {
    if (!selectedConversation) return;
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    handleScrollMsgsToBottom();
  }, [messages]);

  // Add scroll event listener
  useEffect(() => {
    const container = messageRef.current;
    if (container) {
      container.addEventListener("scroll", handleMsgScroll);
      return () => container.removeEventListener("scroll", handleMsgScroll);
    }
  }, []);

  useEffect(() => {
    if (!selectedConversation) return;
    checkWhatsappAvailabilityWindow();
  }, [selectedConversation]);

  useEffect(() => {
    if (
      selectedTemplate?.headerFileUrl &&
      selectedTemplate?.headerType !== "text"
    ) {
      let mediaFileType = selectedTemplate?.headerType;
      setMediaUrl(selectedTemplate?.headerFileUrl);
      setMediaType(mediaFileType);
    } else {
      setMediaType("");
      setMediaUrl("");
    }
  }, [selectedTemplate]);

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
    attachedFiles,
    selectedTemplate,
    message,
    textAreaRef,
    mediaType,
    mediaUrl,
    sendMsgLoading,
    messages,
    messageRef,
    messagesEndRef,
    totalMessages,
    hasMoreMessages,
    isScrolledToBottom,
    subject,
    bodyParameters,
    headerParameters,
    isLiveChatSelected,
    searchConvInput,
    showScrollButton,
    whatsappRemainingTime,
    selectedMessage,
    conversationStatusOptions,
    // conversation status
    filters,
    showStatusDropdown,
    statusDropdownRef,
    statusBtnRef,
    isMobileView,
    isAddTagModalOpen,
    isDeleteConversationModalOpen,
    isDeletingConversation,
    isAddingTag,
    agents,
    selectedAgent,
    agentFetchLoading,
    isScheduleModalOpen,
  };

  return {
    state,
    setConversations,
    setFetchConvLoading,
    setSelectedConversation,
    setSelectedProvider,
    setAttachedFile,
    setAttachedFiles,
    setSelectedTemplate,
    setMessage,
    setMediaType,
    setMediaUrl,
    setBodyParameters,
    setHeaderParameters,
    setIsLiveChatSelected,
    setSearchConvInput,
    setShowScrollButton,
    setSelectedMessage,
    setConversationStatusOptions,
    // conversation filters
    setFilters,
    setShowStatusDropdown,
    setIsMobileView,
    setIsAddTagModalOpen,
    setIsDeleteConversationModalOpen,
    setIsDeletingConversation,
    setIsAddingTag,
    setSelectedAgent,
    setIsScheduleModalOpen,
    fetchConversations,
    fetchMessages,
    handleSendMessage,
    handleReadConversation,
    handleConvScroll,
    handleMsgScroll,
    handleScrollMsgsToBottom,
    handleDeleteConversation,
    handleAddTagToConversation,
    handleRemoveTagFromConversation,
    handleAgentSelect,
    handleScheduleMessage,
  };
};

export default useInbox;
