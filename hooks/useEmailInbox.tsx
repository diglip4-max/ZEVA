import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import debounce from "lodash/debounce";
import {
  formatFileSize,
  getMediaTypeFromMime,
  getTokenByPath,
  handleError,
  validateEmail,
} from "@/lib/helper";
import useProvider from "@/hooks/useProvider";
import { ConversationType, MessageType } from "@/types/conversations";
import useAgents from "@/hooks/useAgents";
import { User } from "@/types/users";
import useTags from "@/hooks/useTags";
import toast from "react-hot-toast";

export type EmailFolderKey =
  | "all"
  | "incoming"
  | "starred"
  | "outgoing"
  | "unread"
  | "opened"
  | "clicked"
  | "archived"
  | "trashed";

export const EMAIL_FOLDERS: { key: EmailFolderKey; label: string }[] = [
  { key: "all", label: "All Mail" },
  { key: "incoming", label: "Inbox" },
  { key: "starred", label: "Starred" },
  { key: "outgoing", label: "Sent" },
  { key: "unread", label: "Unread" },
  { key: "opened", label: "Opened" },
  { key: "clicked", label: "Clicked" },
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
  const { state: agentsState } = useAgents({ role: "agent" });
  const { agents, loading: agentFetchLoading } = agentsState;

  // Conversation assignment
  const [selectedAgents, setSelectedAgents] = useState<User[]>([]);

  // ---- conversation list --------------------------------------------------
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [folder, setFolder] = useState<EmailFolderKey>("all");
  const [search, setSearch] = useState("");
  const [filterOwnerId, setFilterOwnerId] = useState<string | null>(null);
  const [filterProviderId, setFilterProviderId] = useState<string | null>(null);
  const [folderCounts, setFolderCounts] = useState<any[]>([]);
  const conversationListRef = useRef<HTMLDivElement | null>(null);
  const currentPageRef = useRef(1);

  //   attachments
  const [attachedFiles, setAttachedFiles] = useState<Attachment[]>([]);

  // ---- selected conversation / thread --------------------------------------

  const [messages, setMessages] = useState<MessageData[]>([]);
  const [threadMessages, setThreadMessages] = useState<MessageType[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [selectedMessage, setSelectedMessage] = useState<MessageType | null>(
    null,
  );

  // ---- selected conversation ----------------------------------------------
  const [selectedConversation, setSelectedConversation] =
    useState<ConversationType | null>(null);

  const [fetchThreadMsgsLoading, setFetchThreadMsgsLoading] = useState(false);
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

  // modal
  const [isOpenDeleteConfirmModal, setIsOpenDeleteConfirmModal] =
    useState(false);
  const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState<
    string | null
  >(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);

  // tags
  const [isAddTagModalOpen, setIsAddTagModalOpen] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);

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

  const leadId = useMemo(() => {
    if (selectedConversation?.leadId?._id)
      return selectedConversation.leadId._id;
    if (selectedMessage) {
      const msg = selectedMessage as any;
      return msg?.recipientId?._id;
    }
    return "";
  }, [selectedConversation, selectedMessage]);

  const { tags, setTags } = useTags({ leadId });

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
            ownerId: filterOwnerId || undefined,
            providerId: filterProviderId || undefined,
          },
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.data?.success) {
          setMessages([]);
          setHasMoreMessages(false);
          return;
        }

        const incomingGroups: MessageData[] = res.data?.data || [];
        const counts = res.data?.folderCounts || [];

        if (pageToFetch === 1) {
          setMessages(incomingGroups);
          setFolderCounts(counts);
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
                  ...merged[index].messages,
                  ...uniqueMessages,
                ];
              } else {
                merged.push({
                  ...newGroup,
                  messages: uniqueMessages,
                });
              }

              uniqueMessages.forEach((m) => existingMsgIds.add(m._id));
            });

            return merged;
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
    [token, search, folder, filterOwnerId, filterProviderId],
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
        if (threadMsgs.length > 0) {
          setSelectedMessage(threadMsgs[0]);
        }
      } catch (error) {
        setThreadMessages([]);
      } finally {
        setFetchThreadMsgsLoading(false);
      }
    },
    [token],
  );

  const fetchConversation = useCallback(
    async (conversationId: string) => {
      try {
        if (!token || !conversationId) return;

        const { data } = await axios.get(
          `/api/conversations/${conversationId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (data && data?.success && data?.conversation) {
          let conv: ConversationType | null = data?.conversation || null;
          // Check if conversation has owners array first
          if (conv?.owners && conv.owners.length > 0) {
            const convOwners = agents.filter((a) =>
              conv.owners.includes(a._id),
            );
            setSelectedConversation(conv || null);
            setSelectedAgents(convOwners);
          } else if (conv?.ownerId) {
            // Fallback to single ownerId for backward compatibility
            const selectedOwner = agents.find((a) => a._id === conv?.ownerId);
            setSelectedConversation(conv || null);
            if (selectedOwner) {
              setSelectedAgents([selectedOwner]);
            } else {
              setSelectedAgents([]);
            }
          } else {
            setSelectedConversation(conv || null);
            setSelectedAgents([]);
          }
        } else {
          setSelectedConversation(null);
          setSelectedAgents([]);
        }
      } catch (error) {
        console.error("Error fetching conversation:", error);
        setSelectedConversation(null);
        setSelectedAgents([]);
      }
    },
    [token, agents],
  );

  const selectMessage = async (messageId: string) => {
    setSelectedMessageId(messageId);
  };

  // --------------------------------------------------------------------------
  // Conversation status actions -> map onto folders (archive / trash)
  // --------------------------------------------------------------------------
  const updateMessageStatus = useCallback(
    async (messageId: string, status: string) => {
      if (!token) return;
      try {
        let updatedData = {};
        if (status === "starred") {
          updatedData = { isStarred: true };
        } else if (status === "unstarred") {
          updatedData = { isStarred: false };
        } else if (status === "archived") {
          updatedData = { isArchived: true };
        } else if (status === "unarchived") {
          updatedData = { isArchived: false };
        } else if (status === "trashed") {
          updatedData = { isTrashed: true };
        } else if (status === "untrashed") {
          updatedData = { isTrashed: false };
        }
        if (!updatedData) return;
        setThreadMessages((prev) => {
          return prev.map((p) => ({
            ...p,
            ...updatedData,
          }));
        });
        setSelectedMessage(threadMessages[0]);
        const { data } = await axios.put(
          `/api/messages/${messageId}`,
          {
            ...(status === "starred" ? { isStarred: true } : {}),
            ...(status === "unstarred" ? { isStarred: false } : {}),
            ...(status === "archived" ? { isArchived: true } : {}),
            ...(status === "unarchived" ? { isArchived: false } : {}),
            ...(status === "trashed" ? { isTrashed: true } : {}),
            ...(status === "untrashed" ? { isTrashed: false } : {}),
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (data?.success) {
          const currentMsg = data?.data || {};
          setThreadMessages((prev) => {
            return prev.map((p) => ({
              ...p,
              isStarred: currentMsg.isStarred || false,
              isArchived: currentMsg.isArchived || false,
              isTrashed: currentMsg.isTrashed || false,
            }));
          });
          setSelectedMessage(currentMsg);

          fetchEmailMessages();
        }
      } catch (error) {
        handleError(error);
      }
    },
    [token, fetchEmailMessages],
  );

  const archiveMessage = (id: string) => {
    updateMessageStatus(id, "archived");
    showToast("Archived");
  };
  const trashMessage = (id: string) => {
    updateMessageStatus(id, "trashed");
    showToast("Moved to trash");
  };

  const starMessage = (id: string) => {
    if (selectedMessage?.isStarred) {
      updateMessageStatus(id, "unstarred");
      showToast("Unstarred");
    } else {
      updateMessageStatus(id, "starred");
      showToast("Starred");
    }
  };
  const restoreFromTrash = (id: string) => {
    updateMessageStatus(id, "untrashed");
    showToast("Restored from trash");
  };
  const restoreFromArchive = (id: string) => {
    updateMessageStatus(id, "unarchived");
    showToast("Restored from archive");
  };
  const closeDeleteConfirmModal = () => {
    if (isDeletingMessage) return;
    setIsOpenDeleteConfirmModal(false);
    setPendingDeleteMessageId(null);
  };

  const deleteMessage = (id: string) => {
    setPendingDeleteMessageId(id);
    setIsOpenDeleteConfirmModal(true);
  };

  const deleteMessageForever = async (id?: string) => {
    const deleteId = id || pendingDeleteMessageId;
    if (!deleteId) return;

    try {
      setIsDeletingMessage(true);
      const { data } = await axios.delete(`/api/messages/${deleteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data?.success) {
        showToast("Deleted permanently");
        setIsOpenDeleteConfirmModal(false);
        setPendingDeleteMessageId(null);
        setSelectedMessage(null);
        setThreadMessages([]);
        fetchEmailMessages();
      }
    } catch (error) {
      handleError(error);
    } finally {
      setIsDeletingMessage(false);
    }
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

  // Agent assignment
  const handleAgentSelect = async (agents: User[], conversationId: string) => {
    setSelectedAgents(agents);
    try {
      const { data } = await axios.post(
        `/api/conversations/assign-conversation/${conversationId}`,
        {
          ownerIds: agents.map((a) => a._id),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (data && data?.success) {
        // Update conversation in state if needed (but email inbox doesn't track full conversation objects yet
        showToast("Conversation assigned successfully");
      }
    } catch (error) {
      handleError(error);
    }
  };

  // Tags
  const handleAddTagToConversation = async (lId: string, tag: string) => {
    if (!token) return;
    try {
      setIsAddingTag(true);
      const { data } = await axios.post(
        `/api/tags/${lId}`,
        { tag },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data && data?.success) {
        const newTags = data?.tags || [];
        setTags(newTags);
        setIsAddTagModalOpen(false);
        showToast("Tag added successfully");
      }
    } catch (error) {
      handleError(error);
    } finally {
      setIsAddingTag(false);
    }
  };

  const handleRemoveTagFromConversation = async (lId: string, tag: string) => {
    if (!token) return;
    try {
      const { data } = await axios.post(
        `/api/tags/remove/${lId}`,
        { tag },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data && data?.success) {
        const newTags = data?.tags || [];
        setTags(newTags);
        showToast("Tag removed successfully");
      }
    } catch (error) {
      handleError(error);
    }
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
      selectedProvider,
      compose,
      selectedMessageId,
    });
    const effectiveConversationId = compose.conversationId || "";
    const effectiveLeadId = compose.leadId;

    if (
      (!effectiveConversationId || !effectiveLeadId) &&
      !validateEmail(compose.to)
    ) {
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
          from: compose.from || selectedProvider?.email || "",
          to: compose.to || "",
          conversationId: effectiveConversationId,
          recipientIds: effectiveLeadId ? [effectiveLeadId] : [],
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

        if (compose.replyToMessageId || currentMsg?.replyToMessageId) {
          console.log({ currentMsg });
          // Reply message should be in Email Thread Messages
          let updatedThreadMsgs = [...threadMessages, currentMsg];
          setThreadMessages(updatedThreadMsgs);
        } else {
          // New message should be in Email List
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
        }
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
    const effectiveConversationId = compose.conversationId || "";
    const effectiveLeadId = compose.leadId;

    if (
      (!effectiveConversationId || !effectiveLeadId) &&
      !validateEmail(compose.to)
    ) {
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
        "/api/messages/schedule-email-message",
        {
          from: compose.from || selectedProvider?.email || "",
          to: compose.to || "",
          conversationId: effectiveConversationId,
          recipientIds: effectiveLeadId ? [effectiveLeadId] : [],
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
          ...schedule,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (data?.success && data?.data) {
        const currentMsg = data?.data;

        if (compose.replyToMessageId || currentMsg?.replyToMessageId) {
          console.log({ currentMsg });
          // Reply message should be in Email Thread Messages
          let updatedThreadMsgs = [...threadMessages, currentMsg];
          setThreadMessages(updatedThreadMsgs);
        } else {
          // New message should be in Email List
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
        }
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
        showToast("Email scheduled successfully");
      } else {
        showToast("Failed to schedule message");
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
    currentPageRef.current = 1;
    setHasMoreMessages(true);
    fetchEmailMessagesImmediate(1);

    return () => {
      fetchEmailMessages.cancel?.();
    };
  }, [
    folder,
    search,
    filterOwnerId,
    filterProviderId,
    fetchEmailMessagesImmediate,
  ]);

  const loadMoreEmailMessages = () => {
    if (!hasMoreMessages || fetchMsgsLoading) return;
    const nextPage = currentPageRef.current + 1;
    currentPageRef.current = nextPage;
    fetchEmailMessagesImmediate(nextPage);
  };

  const unreadCountFor = (_f: EmailFolderKey) => 0;

  const handleRefreshConversations = async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`/api/conversations/refresh`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data && data?.success) {
        toast.success("Conversations refreshed successfully");
      }
    } catch (error) {
      handleError(error);
    }
  };

  return {
    // list
    emailProviders,
    conversationListRef,
    folder,
    setFolder,
    search,
    setSearch,
    unreadCountFor,
    filterOwnerId,
    setFilterOwnerId,
    filterProviderId,
    setFilterProviderId,
    folderCounts,

    // agents
    agents,
    selectedAgents,
    agentFetchLoading,
    handleAgentSelect,

    // attachments
    attachedFiles,
    setAttachedFiles,

    // selection / thread / conversation
    selectedConversation,
    setSelectedConversation,
    selectedMessageId,
    selectedMessage,
    selectMessage,
    messages,
    threadMessages,
    fetchMsgsLoading,
    fetchThreadMsgsLoading,

    // fetching
    fetchConversation,
    fetchEmailMessages,
    fetchThreadMessages,

    // actions
    archiveMessage,
    trashMessage,
    starMessage,
    toggleStar,
    starredIds,
    restoreFromTrash,
    restoreFromArchive,
    deleteMessage,
    deleteMessageForever,

    // modals
    isOpenDeleteConfirmModal,
    setIsOpenDeleteConfirmModal,
    pendingDeleteMessageId,
    isDeletingMessage,
    closeDeleteConfirmModal,

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

    // tags
    leadId,
    tags,
    isAddTagModalOpen,
    setIsAddTagModalOpen,
    isAddingTag,
    handleAddTagToConversation,
    handleRemoveTagFromConversation,

    // refresh
    handleRefreshConversations,
  };
}
