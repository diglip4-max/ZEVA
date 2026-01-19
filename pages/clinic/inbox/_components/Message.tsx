import {
  formatScheduledTime,
  getChannelTitle,
  getFormatedTime,
} from "@/lib/helper";
import { MessageType } from "@/types/conversations";
import React, { useState } from "react";
import DOMPurify from "dompurify";
import AvatarComponent from "@/components/shared/AvatarComponent";
import {
  Smile,
  ChevronDown,
  Plus,
  Reply,
  Eye,
  FileText,
  File,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";

interface IProps {
  message: MessageType;
  onSelectMessage?: (message: MessageType) => void;
  onMessageUpdate?: (message: MessageType) => void;
}

const Message: React.FC<IProps> = ({
  message,
  onSelectMessage,
  onMessageUpdate,
}) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("clinicToken") : null;

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [isReacting, setIsReacting] = useState<boolean>(false);

  const formatedTime =
    message?.direction === "incoming" && message?.channel === "email"
      ? getFormatedTime(message?.emailReceivedAt || message?.createdAt)
      : getFormatedTime(message?.createdAt);

  const emojis = ["😊", "😂", "❤️", "👍", "🔥"];

  const channelColors = {
    sms: "blue",
    whatsapp: "green",
    voice: "purple",
    email: "slate",
  } as const;

  const getChannelColor = (channel: keyof typeof channelColors) => {
    return channelColors[channel] || "slate";
  };

  const openHtmlInPopup = (html: string) => {
    const popup = window.open(
      "",
      "popupWindow",
      "width=800,height=600,left=200,top=100"
    );
    if (popup) {
      popup.document.write(html);
      popup.document.close();
    }
  };

  const handleReactWithEmoji = async (message: MessageType, emoji: string) => {
    if (isReacting) return; // Prevent multiple clicks

    try {
      setIsReacting(true);
      setIsDropdownOpen(false);
      setSelectedEmoji(emoji);

      const payload = {
        providerMessageId: message.providerMessageId,
        messageId: message._id,
        emoji: emoji,
      };

      const response = await axios.post(
        "/api/messages/send-reaction-message",
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        toast.success(response.data.message, {
          duration: 3000,
          position: "top-right",
        });

        // Update parent component if callback provided
        if (onMessageUpdate) {
          onMessageUpdate(response.data.data);
        }
      }
    } catch (error: any) {
      console.error("Reaction error:", error);
      setSelectedEmoji(null);
      toast.error(error.response?.data?.message || "Failed to react", {
        duration: 4000,
      });
    } finally {
      setIsReacting(false);
    }
  };
  // Add emoji display logic
  const displayEmojis = () => {
    // Combine message emojis with temporary selected emoji
    const allEmojis = [...(message.emojis || [])];
    const currentUserId = message?.senderId?._id;

    if (selectedEmoji) {
      // Check if user already reacted
      const userReactionIndex = allEmojis.findIndex(
        (e) => e?.user === currentUserId
      );

      if (userReactionIndex > -1) {
        // Update existing reaction in display
        allEmojis[userReactionIndex] = {
          ...allEmojis[userReactionIndex],
          emoji: selectedEmoji,
        };
      } else {
        // Add temporary reaction
        allEmojis.push({
          emoji: selectedEmoji,
          user: { _id: currentUserId }, // Temporary user object
          lead: {},
          addedAt: new Date().toISOString(),
        });
      }
    }

    return allEmojis;
  };

  // Get grouped emojis for display
  const groupedEmojis = () => {
    const reactions = displayEmojis();
    const grouped: { [key: string]: number } = {};

    reactions.forEach((reaction) => {
      if (reaction.emoji) {
        grouped[reaction.emoji] = (grouped[reaction.emoji] || 0) + 1;
      }
    });

    return grouped;
  };

  // Render emoji reactions
  const renderEmojiReactions = () => {
    const grouped = groupedEmojis();
    const emojiArray = Object.entries(grouped);

    if (emojiArray.length === 0) return null;

    return (
      <div
        className={`absolute ${
          message.direction === "incoming"
            ? "-bottom-3 left-4"
            : "-bottom-3 right-4"
        } flex items-center flex-wrap gap-1 bg-white rounded-full px-2 py-1 shadow-sm border border-gray-200 max-w-[120px]`}
      >
        {emojiArray?.map(([emoji, count]) => (
          <div key={emoji} className="flex items-center">
            <span className="text-sm">{emoji}</span>
            {count > 1 && (
              <span className="text-xs text-gray-500 ml-0.5">{count}</span>
            )}
          </div>
        ))}
        <span className="text-sm text-gray-600 mt-0.5">
          {emojiArray?.length > 1 ? emojiArray?.length : ""}
        </span>
      </div>
    );
  };
  const getSenderName = () => {
    const name = message?.senderId?.name || "Customer Support";
    return name?.length > 20 ? name.slice(0, 20) + "..." : name;
  };

  const getRecipientName = () => {
    const value =
      message?.recipientId?.name || message?.recipientId?.phone || "Unknown";
    return value?.length > 20 ? value.slice(0, 20) + "..." : value;
  };

  const isOutgoing = message?.direction === "outgoing";
  const channel = message?.channel as keyof typeof channelColors;
  const channelColor = getChannelColor(channel);

  return (
    <div
      className={`flex ${isOutgoing ? "justify-end" : "justify-start"} mb-4`}
    >
      {/* Incoming Message */}
      {!isOutgoing && (
        <div className="flex items-start space-x-3 max-w-full sm:max-w-[85%]">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <AvatarComponent
              name={message?.recipientId?.name}
              // className="h-10 w-10 ring-2 ring-white shadow-md"
            />
          </div>

          {/* Message Bubble */}
          <div className="relative group">
            {/* Message Content */}
            <div
              className={`relative bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 max-w-[600px]`}
            >
              {/* Top Bar */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-semibold text-gray-800">
                    {getRecipientName()}
                  </span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  <span className="text-xs font-medium text-gray-500">
                    {getChannelTitle(channel)}
                  </span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  <span className="text-xs text-gray-500">{formatedTime}</span>
                </div>
                <button
                  onClick={() => openHtmlInPopup(message?.content || "")}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors duration-200"
                >
                  <Eye size={16} className="text-gray-500" />
                </button>
              </div>

              {/* Reply Preview */}
              {message?.replyToMessageId && (
                <div
                  className={`mb-3 pl-3 py-2 border-l-3 border-${channelColor}-400 bg-${channelColor}-50/50 rounded-r-lg`}
                >
                  <div className="text-xs font-medium text-gray-600 mb-1">
                    {message?.replyToMessageId?.direction === "incoming"
                      ? message?.replyToMessageId?.recipientId?.name
                      : message?.senderId?.name || "Customer Support"}
                  </div>
                  <div
                    className="text-xs text-gray-500 line-clamp-2"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        message.replyToMessageId.content.length > 200
                          ? message.replyToMessageId.content.slice(0, 199)
                          : message.replyToMessageId.content
                      ),
                    }}
                  />
                </div>
              )}

              {/* Media Content */}
              {message?.mediaUrl && (
                <div className="mb-3 rounded-lg overflow-hidden">
                  {message.mediaType === "image" ? (
                    <img
                      src={message.mediaUrl}
                      alt="Attachment"
                      className="max-w-full max-h-64 object-cover rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                      onClick={() => window.open(message.mediaUrl, "_blank")}
                    />
                  ) : message.mediaType === "video" ? (
                    <video
                      controls
                      className="max-w-full rounded-lg"
                      src={message.mediaUrl}
                    />
                  ) : message.mediaType === "audio" ? (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 text-sm">🎵</span>
                      </div>
                      <span className="text-sm text-gray-600">
                        Audio message
                      </span>
                    </div>
                  ) : (
                    <a
                      href={message.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100"
                    >
                      <div className="p-2 rounded-md bg-gray-100 text-gray-600 flex items-center justify-center">
                        {(() => {
                          const mime =
                            message?.attachments?.[0]?.mimeType || "";
                          const isDoc =
                            /pdf|word|msword|officedocument|text|sheet|presentation/i.test(
                              mime
                            ) ||
                            /\.pdf$|\.docx?$|\.xlsx?$|\.pptx?$/i.test(
                              message?.mediaUrl || ""
                            );
                          return isDoc ? (
                            <FileText size={20} />
                          ) : (
                            <File size={20} />
                          );
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">
                          {message.attachments?.[0]?.fileName ||
                            (message.mediaUrl || "file")
                              .split("/")
                              .pop()
                              ?.split("?")[0]
                              ?.slice(0, 60)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {message.attachments?.[0]?.fileSize
                            ? `${(
                                Number(message.attachments[0].fileSize) / 1024
                              ).toFixed(2)} KB`
                            : "Document"}
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-3">
                        <Download size={16} className="text-gray-500" />
                      </div>
                    </a>
                  )}
                </div>
              )}

              {/* Email Metadata */}
              {message?.channel === "email" && (
                <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                  <div className="space-y-1.5">
                    <div className="flex items-center text-sm">
                      <span className="font-medium text-gray-700 w-14">
                        From:
                      </span>
                      <span className="text-gray-600">
                        {message?.recipientId?.email}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="font-medium text-gray-700 w-14">
                        To:
                      </span>
                      <span className="text-gray-600">
                        {/* Add your provider email here */}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="font-medium text-gray-700 w-14">
                        Subject:
                      </span>
                      <span className="text-gray-600">{message?.subject}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Message Text */}
              <div
                className="text-sm text-gray-800 leading-relaxed break-words"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    message?.content?.replace(/\n/g, "<br />") || ""
                  ),
                }}
              />

              {/* Status and Info */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                <div className="flex items-center space-x-2">
                  {message?.errorMessage ? (
                    <div className="relative group">
                      <span className="text-xs font-medium text-red-500 cursor-help">
                        {message?.status}
                      </span>
                      <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity max-w-[250px] whitespace-normal break-words">
                        {message?.errorMessage}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-gray-500">
                      {message?.status}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {message?.source && `From ${message.source}`}
                </div>
              </div>
            </div>

            {/* Reaction Emoji */}
            {/* {(message?.emoji || selectedEmoji) && (
              <div className="absolute -bottom-3 left-4 bg-white rounded-full px-2 py-1 shadow-sm border border-gray-200">
                <span className="text-sm">
                  {message?.emoji || selectedEmoji}
                </span>
              </div>
            )} */}
            {renderEmojiReactions()}

            {/* Reaction Dropdown */}
            <div className="absolute -right-10 top-1/2 z-50 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="p-2 bg-white hover:bg-gray-50 rounded-full shadow-md border border-gray-200 transition-all hover:scale-105"
                >
                  <div className="flex items-center">
                    <Smile size={16} className="text-gray-500" />
                    <ChevronDown size={14} className="text-gray-400 ml-0.5" />
                  </div>
                </button>

                {isDropdownOpen && (
                  <div className="absolute left-full top-0 ml-2 bg-white rounded-xl shadow-lg border border-gray-200 p-3 z-50 min-w-[200px]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">
                        Add reaction
                      </span>
                      <button className="p-1 hover:bg-gray-100 rounded-full">
                        <Plus size={14} className="text-gray-500" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      {emojis.map((emoji, index) => (
                        <button
                          key={index}
                          onClick={() => handleReactWithEmoji(message, emoji)}
                          className="hover:scale-125 transition-transform p-1.5"
                        >
                          <span className="text-lg">{emoji}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        if (onSelectMessage) {
                          onSelectMessage(message);
                        }
                        setIsDropdownOpen(false);
                      }}
                      className="flex items-center justify-center w-full py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Reply size={16} className="text-gray-500 mr-2" />
                      <span className="text-sm font-medium text-gray-700">
                        Reply
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Outgoing Message */}
      {isOutgoing && (
        <div className="flex items-start justify-end space-x-3 max-w-full sm:max-w-[85%]">
          {/* Message Bubble */}
          <div className="relative group">
            {/* Message Content */}
            <div
              className={`relative bg-gradient-to-r from-${channelColor}-50 to-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm border border-${channelColor}-100 max-w-[600px]`}
            >
              {/* Top Bar */}
              <div className="flex items-center mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-semibold text-gray-800">
                    {getSenderName()}
                  </span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  <span className="text-xs font-medium text-gray-500">
                    {getChannelTitle(channel)}
                  </span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  <span className="text-xs text-gray-500">{formatedTime}</span>
                </div>
              </div>

              {/* Reply Preview */}
              {message?.replyToMessageId && (
                <div
                  className={`mb-3 pl-3 py-2 border-l-3 border-${channelColor}-400 bg-white/80 rounded-r-lg`}
                >
                  <div className="text-xs font-medium text-gray-600 mb-1">
                    {message?.replyToMessageId?.direction === "incoming"
                      ? message?.replyToMessageId?.recipientId?.name
                      : "You"}
                  </div>
                  <div
                    className="text-xs text-gray-500 line-clamp-2"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        message.replyToMessageId.content.length > 200
                          ? message.replyToMessageId.content.slice(0, 199)
                          : message.replyToMessageId.content
                      ),
                    }}
                  />
                </div>
              )}

              {/* Media Content */}
              {message?.mediaUrl && (
                <div className="mb-3 rounded-lg overflow-hidden">
                  {message.mediaType === "image" ? (
                    <img
                      src={message.mediaUrl}
                      alt="Attachment"
                      className="max-w-full max-h-64 object-cover rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                      onClick={() => window.open(message.mediaUrl, "_blank")}
                    />
                  ) : message.mediaType === "video" ? (
                    <video
                      controls
                      className="max-w-full rounded-lg"
                      src={message.mediaUrl}
                    />
                  ) : message.mediaType === "audio" ? (
                    <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 text-sm">🎵</span>
                      </div>
                      <span className="text-sm text-gray-600">
                        Audio message
                      </span>
                    </div>
                  ) : (
                    <a
                      href={message.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-3 p-3 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                    >
                      <div className="p-2 rounded-md bg-gray-100 text-gray-600 flex items-center justify-center">
                        {(() => {
                          const mime =
                            message?.attachments?.[0]?.mimeType || "";
                          const isDoc =
                            /pdf|word|msword|officedocument|text|sheet|presentation/i.test(
                              mime
                            ) ||
                            /\.pdf$|\.docx?$|\.xlsx?$|\.pptx?$/i.test(
                              message?.mediaUrl || ""
                            );
                          return isDoc ? (
                            <FileText size={20} />
                          ) : (
                            <File size={20} />
                          );
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">
                          {message.attachments?.[0]?.fileName ||
                            (message.mediaUrl || "file")
                              .split("/")
                              .pop()
                              ?.split("?")[0]
                              ?.slice(0, 60)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {message.attachments?.[0]?.fileSize
                            ? `${(
                                Number(message.attachments[0].fileSize) / 1024
                              ).toFixed(2)} KB`
                            : "Document"}
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-3">
                        <Download size={16} className="text-gray-500" />
                      </div>
                    </a>
                  )}
                </div>
              )}

              {/* Email Metadata */}
              {message?.channel === "email" && (
                <div className="mb-3 p-3 bg-white/80 rounded-lg border border-gray-200">
                  <div className="space-y-1.5">
                    <div className="flex items-center text-sm">
                      <span className="font-medium text-gray-700 w-14">
                        To:
                      </span>
                      <span className="text-gray-600">
                        {message?.recipientId?.email}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="font-medium text-gray-700 w-14">
                        From:
                      </span>
                      <span className="text-gray-600">
                        {/* Add your provider email here */}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="font-medium text-gray-700 w-14">
                        Subject:
                      </span>
                      <span className="text-gray-600">{message?.subject}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Message Text */}
              <div
                className="text-sm text-gray-800 leading-relaxed break-words"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    message?.content?.replace(/\n/g, "<br />") || ""
                  ),
                }}
              />

              {/* Status and Info */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-200/50">
                <div className="flex items-center space-x-3">
                  {message?.errorMessage ? (
                    <div className="relative group">
                      <span className="text-xs font-medium text-red-500 cursor-help">
                        {message?.status}
                      </span>
                      <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity w-[300px] whitespace-normal break-words text-sm">
                        {message?.errorMessage}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-gray-500">
                      {message?.status === "scheduled"
                        ? `scheduled: ${formatScheduledTime(
                            message?.schedule?.date,
                            message?.schedule?.time,
                            message?.schedule?.timezone
                          )}`
                        : `${message?.status}`}
                    </span>
                  )}
                  {message?.source && (
                    <span className="text-xs text-gray-400">
                      From {message.source}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Reaction Emoji */}
            {/* {(message?.emoji || selectedEmoji) && (
              <div className="absolute -bottom-3 right-4 bg-white rounded-full px-2 py-1 shadow-sm border border-gray-200">
                <span className="text-sm">
                  {message?.emoji || selectedEmoji}
                </span>
              </div>
            )} */}
            {renderEmojiReactions()}

            {/* Reaction Dropdown */}
            <div className="absolute -left-10 top-1/2 z-50 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="p-2 bg-white hover:bg-gray-50 rounded-full shadow-md border border-gray-200 transition-all hover:scale-105"
                >
                  <div className="flex items-center">
                    <ChevronDown size={14} className="text-gray-400 mr-0.5" />
                    <Smile size={16} className="text-gray-500" />
                  </div>
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-full top-0 mr-2 bg-white rounded-xl shadow-lg border border-gray-200 p-3 z-50 min-w-[200px]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">
                        Add reaction
                      </span>
                      <button className="p-1 hover:bg-gray-100 rounded-full">
                        <Plus size={14} className="text-gray-500" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      {emojis.map((emoji, index) => (
                        <button
                          key={index}
                          onClick={() => handleReactWithEmoji(message, emoji)}
                          className="hover:scale-125 transition-transform p-1.5"
                        >
                          <span className="text-lg">{emoji}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        if (onSelectMessage) {
                          onSelectMessage(message);
                        }
                        setIsDropdownOpen(false);
                      }}
                      className="flex items-center justify-center w-full py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Reply size={16} className="text-gray-500 mr-2" />
                      <span className="text-sm font-medium text-gray-700">
                        Reply
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
              {getSenderName().charAt(0)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(Message);
