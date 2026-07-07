import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import debounce from "lodash.debounce";
import {
  formatFileSize,
  getMediaTypeFromMime,
  getTokenByPath,
  handleError,
} from "@/lib/helper";
import useProvider from "@/hooks/useProvider";
import { MessageType } from "@/types/conversations";

export type EmailFolderKey =
  | "all"
  | "incoming"
  | "starred"
  | "outgoing"
  | "unread"
  | "open"
  | "archived"
  | "trashed";

export const EMAIL_FOLDERS: { key: EmailFolderKey; label: string }[] = [
  { key: "all", label: "All Mail" },
  { key: "incoming", label: "Inbox" },
  { key: "starred", label: "Starred" },
  { key: "outgoing", label: "Sent" },
  { key: "unread", label: "Unread" },
  { key: "open", label: "Open" },
  { key: "archived", label: "Archived" },
  { key: "trashed", label: "Trash" },
];

export interface ComposeDraft {
  providerId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  replyToMessageId?: string;
  conversationId?: string;
  leadId?: string;
  savedAt?: string;
}

/**
 * useEmailInbox
 * --------------------------------------------------------------------
 * Business logic + API calls for the **email-only** inbox experience.
 * Kept fully separate from the shared `useInbox` hook (which drives the
 * multi-channel sms/whatsapp/email conversation view in the screenshot)
 * so the premium email UI can evolve independently.
 *
 * Backend notes / assumptions — please sanity-check these against your
 * actual API behaviour and adjust:
 *
 *  1. Conversations: GET /api/conversations is reused as-is. We pass
 *     `channel: "email"` as an extra query param (harmless if the route
 *     ignores it) AND filter client-side on
 *     `recentMessage.channel === "email"`, since the route currently
 *     only accepts page/limit/search/status/ownerId.
 *
 *  2. Thread messages: GET /api/messages/get-messages/:conversationId
 *     returns ALL channels for that conversation grouped by date. We
 *     flatten those groups and keep only channel === "email" messages,
 *     since there's no channel filter on that route today.
 *
 *  3. Sending / replying: POST /api/messages/send-email-message. This
 *     endpoint expects `recipientIds` (Lead _ids), not raw email
 *     addresses, and a `providerId`. Because this UI is conversation
 *     scoped (like your screenshot), we always send to the lead on the
 *     currently open conversation — composing a brand-new email with
 *     no conversation selected isn't supported by the current API
 *     surface (there's no "create conversation + send email" endpoint),
 *     so `sendEmail` requires `selectedConversation` to be set.
 *
 *  4. Scheduling: POST /api/messages/schedule-email-message, same
 *     shape as #3 plus scheduledDate/scheduledTime/scheduledTimezone.
 *
 *  5. "Folders": there's no Inbox/Sent/Drafts/Trash concept server
 *     side — only conversation.status (open/closed/archived/trashed)
 *     and conversation.unreadMessages. Folders in this hook map onto
 *     that status field via PATCH /api/conversations/update-conversation.
 *
 *  6. Drafts + starring have no backing schema field yet (Message has
 *     no `starred` flag, and there's no draft concept at all), so both
 *     are local-only state here. Swap these out once real endpoints
 *     exist — the surface area (toggleStar, drafts) is kept small on
 *     purpose so that's a quick change.
 */

const PAGE_LIMIT = 20;

export type MessageData = {
  date: string;
  messages: MessageType[];
};

export type Attachment = {
  id: string;
  name: string;
  size: number;
  url?: string;
  uploading?: boolean;
  originalFile?: File;
  progress?: number;
};

export default function useEmailInbox() {
  const token = getTokenByPath();
  const { emailProviders } = useProvider();

  // ---- conversation list --------------------------------------------------
  const [messagePage, setMessagePage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [folder, setFolder] = useState<EmailFolderKey>("all");
  const [search, setSearch] = useState("");
  const conversationListRef = useRef<HTMLDivElement | null>(null);

  //   attachments
  const [attachedFiles, setAttachedFiles] = useState<Attachment[]>([]);

  // ---- selected conversation / thread --------------------------------------
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [threadMessages, setThreadMessages] = useState<MessageType[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [selectedMessage, setSelectedMessage] = useState<MessageType | null>(
    null,
  );

  const [fetchThreadMsgsLoading, setFetchThreadMsgsLoading] = useState(false);
  const [fetchMsgLoading, setFetchMsgLoading] = useState(false);
  const [fetchMsgsLoading, setFetchMsgsLoading] = useState(false);

  // ---- compose --------------------------------------------------------------
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMinimized, setComposeMinimized] = useState(false);
  const [composeMaximized, setComposeMaximized] = useState(false);
  const [composeMode, setComposeMode] = useState<"new" | "reply" | "forward">(
    "new",
  );
  const [compose, setCompose] = useState<ComposeDraft>({
    from: "",
    to: "",
    subject: "",
    body: "",
    providerId: "",
    conversationId: undefined,
    leadId: undefined,
  });
  const [drafts, setDrafts] = useState<ComposeDraft[]>([]); // local-only, see notes above
  const [sending, setSending] = useState(false);

  // ---- starring (local only, see notes above) ------------------------------
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  // ---- toast ------------------------------------------------------------------
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 2600);
  }, []);

  const selectedProvider = useMemo(
    () => emailProviders?.find((p) => p._id === compose.providerId) || null,
    [emailProviders, compose.providerId],
  );

  // Set the provider in compose
  useEffect(() => {
    if (emailProviders?.length > 0) {
      setCompose((prev) => ({ ...prev, providerId: emailProviders[0]?._id }));
    }
  }, [emailProviders]);

  // --------------------------------------------------------------------------
  // Fetch messages for the selected conversation, keep only channel === email
  // --------------------------------------------------------------------------
  //   const fetchMessages = useCallback(
  //     async (conversationId: string) => {
  //       if (!token) return;
  //       try {
  //         setFetchMsgsLoading(true);
  //         const res = await axios.get(
  //           `/api/messages/get-messages/${conversationId}`,
  //           {
  //             params: { page: 1, limit: 50 },
  //             headers: { Authorization: `Bearer ${token}` },
  //           },
  //         );

  //         if (!res.data?.success) {
  //           setMessages([]);
  //           return;
  //         }

  //         const flat: MessageType[] = (res.data.data || [])
  //           .flatMap((group: { messages: MessageType[] }) => group.messages)
  //           .filter((m: any) => m.channel === "email")
  //           .sort(
  //             (a: any, b: any) =>
  //               new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  //           );

  //         setMessages(flat);
  //       } catch (error) {
  //         setMessages([]);
  //       } finally {
  //         setFetchMsgsLoading(false);
  //       }
  //     },
  //     [token],
  //   );

  // --------------------------------------------------------------------------
  // Fetch messages for the selected conversation, keep only channel === email
  // --------------------------------------------------------------------------
  const fetchEmailMessagesImmediate = useCallback(
    async (pageToFetch = 1) => {
      if (!token) return;
      const scrollEl = conversationListRef.current;
      const previousHeight =
        pageToFetch > 1 && scrollEl ? scrollEl.scrollHeight : 0;
      const previousScrollTop =
        pageToFetch > 1 && scrollEl ? scrollEl.scrollTop : 0;

      try {
        if (pageToFetch === 1) {
          setMessages([]);
        }
        setFetchMsgsLoading(true);
        const res = await axios.get(`/api/messages/get-email-messages`, {
          params: {
            page: pageToFetch,
            limit: PAGE_LIMIT || 20,
            status: folder === "all" ? "all" : folder,
            search,
          },
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.data?.success) {
          setMessages([]);
          setHasMoreMessages(false);
          return;
        }

        const incomingGroups: MessageData[] = res.data?.data || [];

        if (pageToFetch === 1) {
          setMessages(incomingGroups);
        } else {
          setMessages((prev) => {
            const merged = prev.map((g) => ({
              ...g,
              messages: [...g.messages],
            }));

            const existingMsgIds = new Set(
              merged.flatMap((g) => g.messages.map((m) => m._id)),
            );

            incomingGroups.forEach((newGroup) => {
              const index = merged.findIndex((g) => g.date === newGroup.date);

              const uniqueMessages = newGroup.messages.filter(
                (m) => !existingMsgIds.has(m._id),
              );

              if (!uniqueMessages.length) return;

              if (index !== -1) {
                merged[index].messages = [
                  ...uniqueMessages,
                  ...merged[index].messages,
                ];
              } else {
                merged.unshift({
                  ...newGroup,
                  messages: uniqueMessages,
                });
              }

              uniqueMessages.forEach((m) => existingMsgIds.add(m._id));
            });

            return merged;
          });

          requestAnimationFrame(() => {
            if (conversationListRef.current) {
              const newHeight = conversationListRef.current.scrollHeight;
              conversationListRef.current.scrollTop =
                previousScrollTop + (newHeight - previousHeight);
            }
          });
        }

        setHasMoreMessages(Boolean(res.data?.pagination?.hasMore));
      } catch (error) {
        setMessages([]);
        setHasMoreMessages(false);
      } finally {
        setFetchMsgsLoading(false);
      }
    },
    [token, search, folder],
  );

  const fetchEmailMessages = useMemo(
    () => debounce(fetchEmailMessagesImmediate, 300),
    [fetchEmailMessagesImmediate],
  );

  const fetchThreadMessages = useCallback(
    async (messageId: string) => {
      if (!token) return;
      try {
        setFetchThreadMsgsLoading(true);
        const res = await axios.get(
          `/api/messages/get-email-thread-messages/${messageId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!res.data?.success) {
          setThreadMessages([]);
          return;
        }
        const threadMsgs: MessageType[] = res.data?.data || [];
        setThreadMessages(threadMsgs);
      } catch (error) {
        setThreadMessages([]);
      } finally {
        setFetchThreadMsgsLoading(false);
      }
    },
    [token],
  );

  const selectMessage = async (messageId: string) => {
    setSelectedMessageId(messageId);

    try {
      setFetchMsgLoading(true);
      const { data } = await axios.get(`/api/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log({ data, messageId, messages });
      if (data && data?.success && data?.data) {
        let msg: MessageType | null = data?.data || null;

        console.log({ msg, messageId, messages });
        setSelectedMessage(msg || null);
      }
    } catch (error) {
      console.error("Error selecting message:", error);
      setSelectedMessage(null);
    } finally {
      setFetchMsgLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Conversation status actions -> map onto folders (archive / trash)
  // --------------------------------------------------------------------------
  const updateConversationStatus = useCallback(
    async (conversationId: string, status: string) => {
      if (!token) return;
      try {
        const { data } = await axios.patch(
          `/api/conversations/update-conversation/${conversationId}`,
          { status },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (data?.success) {
          if (["trashed", "archived", "closed"].includes(status)) {
            if (selectedConversationId === conversationId) {
              setSelectedConversationId(null);
              setMessages([]);
            }
          } else {
          }
        }
      } catch (error) {
        handleError(error);
      }
    },
    [token, selectedConversationId],
  );

  const archiveConversation = (id: string) => {
    updateConversationStatus(id, "archived");
    showToast("Archived");
  };
  const trashConversation = (id: string) => {
    updateConversationStatus(id, "trashed");
    showToast("Moved to trash");
  };

  // --------------------------------------------------------------------------
  // Star (local only — no backend field yet, see file header)
  // --------------------------------------------------------------------------
  const toggleStar = (id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // --------------------------------------------------------------------------
  // Compose lifecycle
  // --------------------------------------------------------------------------
  const startCompose = (
    mode: "new" | "reply" | "forward" = "new",
    sourceMessage?: MessageType,
  ) => {
    setComposeMode(mode);
    if (mode === "reply" && sourceMessage) {
      const leadEmail = (sourceMessage as any)?.recipientId?.email || "";
      const conversationId = (sourceMessage as any)?.conversationId || "";
      const leadId = (sourceMessage as any)?.recipientId?._id || "";
      setCompose({
        from: selectedProvider?.email || "",
        to: leadEmail,
        subject: sourceMessage.subject?.startsWith("Re:")
          ? sourceMessage.subject
          : `Re: ${sourceMessage.subject || ""}`,
        body: "",
        conversationId,
        leadId,
        replyToMessageId: sourceMessage._id,
        providerId: selectedProvider?._id || "",
      });
    } else if (mode === "forward" && sourceMessage) {
      setCompose({
        from: selectedProvider?.email || "",
        to: "",
        subject: sourceMessage.subject?.startsWith("Fwd:")
          ? sourceMessage.subject
          : `Fwd: ${sourceMessage.subject || ""}`,
        body: `<br/><br/>---- Forwarded message ----<br/>${(sourceMessage as any).content || ""}`,
        conversationId: undefined,
        leadId: undefined,
        providerId: selectedProvider?._id || "",
      });
    } else {
      setCompose({
        from: selectedProvider?.email || "",
        to: "",
        subject: "",
        body: "",
        conversationId: undefined,
        leadId: undefined,
        providerId: selectedProvider?._id || "",
      });
    }
    setComposeOpen(true);
    setComposeMinimized(false);
    setComposeMaximized(false);
  };

  const closeCompose = () => {
    if (compose.to || compose.subject || compose.body) {
      setDrafts((prev) => [
        { ...compose, savedAt: new Date().toISOString() },
        ...prev,
      ]);
      showToast("Draft saved");
    }
    setComposeOpen(false);
    setCompose({
      from: selectedProvider?.email || "",
      to: "",
      subject: "",
      body: "",
      conversationId: undefined,
      leadId: undefined,
      providerId: selectedProvider?._id || "",
    });
  };

  // --------------------------------------------------------------------------
  // Send / schedule email — always against the selected conversation's lead
  // --------------------------------------------------------------------------
  const sendEmail = async () => {
    console.log({
      selectedConversationId,
      selectedProvider,
      compose,
      selectedMessageId,
    });
    const effectiveConversationId =
      compose.conversationId || selectedConversationId;
    const effectiveLeadId = compose.leadId;

    if (!effectiveConversationId || !effectiveLeadId) {
      showToast(
        "Select a contact from the To field or open an existing conversation first",
      );
      return;
    }
    if (!compose.providerId || !selectedProvider) {
      showToast("No email provider configured");
      return;
    }
    if (!compose.subject.trim() && !compose.body.trim()) {
      showToast("Write a subject or message first");
      return;
    }

    setSending(true);
    try {
      const { data } = await axios.post(
        "/api/messages/send-email-message",
        {
          conversationId: effectiveConversationId,
          recipientIds: [effectiveLeadId],
          channel: "email",
          subject: compose.subject || "(no subject)",
          content: compose.body,
          source: "Zeva",
          providerId: compose.providerId || selectedProvider?._id,
          replyToMessageId: compose.replyToMessageId,
          attachments: attachedFiles.map((f) => ({
            fileName: f?.name,
            fileSize: formatFileSize(f?.originalFile?.size || 0),
            mimeType: f?.originalFile?.type || "",
            mediaUrl: f?.url,
            mediaType: getMediaTypeFromMime(f?.originalFile?.type || ""),
          })),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (data?.success && data?.data) {
        const currentMsg = data?.data;
        const currentMsgDate = new Date(currentMsg?.createdAt)
          .toISOString()
          .split("T")[0];
        let findGroup = messages?.find((g) => g?.date === currentMsgDate);
        let updatedMsgs = messages || [];
        if (findGroup) {
          updatedMsgs = updatedMsgs?.map((g) =>
            g?.date === currentMsgDate
              ? { ...g, messages: [currentMsg, ...g.messages] }
              : g,
          );
        } else {
          updatedMsgs = [
            { date: currentMsgDate, messages: [currentMsg] },
            ...updatedMsgs,
          ];
        }
        setMessages(updatedMsgs);
        setComposeOpen(false);
        setCompose({
          from: selectedProvider?.email || "",
          to: "",
          subject: "",
          body: "",
          conversationId: undefined,
          leadId: undefined,
          providerId: compose.providerId || selectedProvider?._id || "",
        });
        setAttachedFiles([]);
        showToast("Email sent successfully");
      } else {
        showToast("Failed to send message");
      }
    } catch (error) {
      handleError(error);
    } finally {
      setSending(false);
    }
  };

  const scheduleEmail = async (schedule: {
    scheduledDate: string;
    scheduledTime: string;
    scheduledTimezone: string;
  }) => {
    if (!selectedConversationId || !selectedProvider) {
      showToast("Open a conversation and configure an email provider first");
      return;
    }
    setSending(true);
    try {
      const { data } = await axios.post(
        "/api/messages/schedule-email-message",
        {
          conversationId: compose.conversationId || selectedConversationId,
          recipientIds: [(compose.leadId as any)?._id],
          channel: "email",
          subject: compose.subject || "(no subject)",
          content: compose.body,
          source: "Zeva",
          providerId: selectedProvider._id,
          replyToMessageId: compose.replyToMessageId,
          ...schedule,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data?.success) {
        setComposeOpen(false);
        setCompose({
          from: selectedProvider?.email || "",
          to: "",
          subject: "",
          body: "",
          providerId: selectedProvider?._id || "",
        });
        showToast("Message scheduled");
      }
    } catch (error) {
      handleError(error);
    } finally {
      setSending(false);
    }
  };

  // --------------------------------------------------------------------------
  // Effects
  // --------------------------------------------------------------------------
  useEffect(() => {
    setMessagePage(1);
    setHasMoreMessages(true);
    fetchEmailMessages(1);

    return () => {
      fetchEmailMessages.cancel?.();
    };
  }, [folder, search, fetchEmailMessages]);

  useEffect(() => {
    if (messagePage > 1) fetchEmailMessagesImmediate(messagePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagePage]);

  const loadMoreEmailMessages = () => {
    if (!hasMoreMessages || fetchMsgsLoading) return;
    setMessagePage((p) => p + 1);
  };

  const unreadCountFor = (_f: EmailFolderKey) => 0;

  return {
    // list
    emailProviders,
    conversationListRef,
    folder,
    setFolder,
    search,
    setSearch,
    unreadCountFor,

    // attachments
    attachedFiles,
    setAttachedFiles,

    // selection / thread
    selectedConversationId,
    selectedMessageId,
    selectMessage,
    selectedMessage,
    messages,
    threadMessages,
    fetchMsgsLoading,
    fetchMsgLoading,
    fetchThreadMsgsLoading,

    // fetching
    fetchEmailMessages,
    fetchThreadMessages,

    // actions
    archiveConversation,
    trashConversation,
    toggleStar,
    starredIds,

    // compose
    composeOpen,
    composeMinimized,
    setComposeMinimized,
    composeMaximized,
    setComposeMaximized,
    compose,
    setCompose,
    composeMode,
    startCompose,
    closeCompose,
    sendEmail,
    scheduleEmail,
    sending,
    drafts,
    hasMoreMessages,
    loadMoreEmailMessages,

    // misc
    toastMessage,
    showToast,
    selectedProvider,
  };
}
