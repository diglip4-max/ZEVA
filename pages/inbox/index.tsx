import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import React, { ReactElement } from "react";
import { NextPageWithLayout } from "../_app";
import AvatarComponent from "@/components/shared/AvatarComponent";
import {
  Search,
  Filter,
  Send,
  ChevronDown,
  ChevronLeft,
  Phone,
  Plus,
  User,
  Mail,
  X,
  MoreHorizontal,
  Smile,
  Timer,
} from "lucide-react";
import CreateNewConversation from "./_components/CreateNewConversation";
import Conversation from "./_components/Conversation";
import useInbox, { getTagColor, tags } from "@/hooks/useInbox";
import NoSelectedConversation from "@/components/NoSelectedConversation";
import CustomDropdown from "@/components/shared/CustomDropdown";
import { FaWhatsapp } from "react-icons/fa";
import TemplatesModal from "./_components/TemplatesModal";
import Message from "./_components/Message";
import AttachmentModal from "@/components/shared/AttachmentModal";
import { getFormatedTime } from "@/lib/helper";
import WhatsappTimer from "./_components/WhatsappTimer";
import EmojiPickerModal from "@/components/shared/EmojiPickerModal";
import CollapsibleWrapper from "@/components/shared/CollapsibleWrapper";
import AddTagModal from "@/components/modals/AddTagModal";
// import EmojiPickerModal from "@/components/shared/EmojiPickerModal";

const InboxPage: NextPageWithLayout = () => {
  const {
    state,
    setSearchConvInput,
    setConversations,
    setSelectedConversation,
    setSelectedProvider,
    setAttachedFile,
    setAttachedFiles,
    setSelectedTemplate,
    setMessage,
    setMediaType,
    setBodyParameters,
    setHeaderParameters,
    setSelectedMessage,
    setConversationStatusOptions,
    setFilters,
    setShowStatusDropdown,
    setIsAddTagModalOpen,
    handleSendMessage,
    handleConvScroll,
    handleMsgScroll,
    handleScrollMsgsToBottom,
  } = useInbox();
  const {
    conversationRef,
    searchConvInput,
    conversations,
    selectedConversation,
    selectedProvider,
    // hasMoreConversations,
    fetchConvLoading,
    totalConversations,
    providers,
    templates,
    attachedFile,
    selectedTemplate,
    message,
    // mediaType,
    // bodyParameters,
    // headerParameters,
    textAreaRef,
    sendMsgLoading,
    messages,
    messageRef,
    showScrollButton,
    messagesEndRef,
    whatsappRemainingTime,
    selectedMessage,
    conversationStatusOptions,
    filters,
    showStatusDropdown,
    statusDropdownRef,
    statusBtnRef,
    currentConvPage,
    isMobileView,
    isAddTagModalOpen,
  } = state;

  return (
    <div className="flex h-[91vh] bg-gray-50 text-gray-800">
      {/* Left Sidebar - Conversations List */}
      <div
        className={`w-full md:w-1/3 lg:w-1/4 border-r border-gray-200 flex flex-col bg-white shadow-sm ${
          isMobileView && selectedConversation ? "hidden" : ""
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                All customer chats
              </h2>
              <span className="text-gray-600 py-1 text-sm font-medium">
                {totalConversations} chats
              </span>
            </div>

            <CreateNewConversation
              conversations={conversations}
              setConversations={setConversations}
              setSelectedConversation={setSelectedConversation}
            />
          </div>

          {/* Search and Filter */}
          <div className="flex space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full text-sm pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-800 focus:border-transparent transition-all"
                value={searchConvInput}
                onChange={(e) => setSearchConvInput(e.target.value)}
              />
            </div>
            <button className="p-2.5 bg-gray-800 text-white border border-gray-800 rounded-lg hover:bg-gray-700 transition-colors shadow-sm">
              <Filter className="h-5 w-5" />
            </button>
          </div>

          {/* conversation status filter */}
          <div className="relative flex items-center">
            <div className="flex items-center">
              {conversationStatusOptions?.slice(0, 4)?.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, status: option.value }))
                  }
                  className={`px-3 py-1.5 mr-2 mb-2 rounded-full text-sm font-medium transition-all ${
                    filters.status === option.value
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <button
                ref={statusBtnRef}
                onClick={() => setShowStatusDropdown((s) => !s)}
                aria-expanded={showStatusDropdown}
                className={`px-3 py-1.5 mr-2 mb-2 rounded-full text-sm font-medium transition-all ${
                  showStatusDropdown
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {showStatusDropdown && conversationStatusOptions?.length > 4 && (
                <div
                  ref={statusDropdownRef}
                  role="menu"
                  className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1"
                >
                  {conversationStatusOptions.slice(4).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setFilters((prev) => ({ ...prev, status: opt.value }));
                        setConversationStatusOptions((prev) => {
                          const selIndex = prev.findIndex(
                            (o) => o.value === opt.value
                          );
                          if (selIndex === -1) return prev;
                          const selectedOption = prev[selIndex];

                          // Keep reference to original 4th item (index 3)
                          const originalThird = prev[3];

                          // Remove selected from list
                          const withoutSelected = prev.filter(
                            (o) => o.value !== opt.value
                          );

                          // Insert selectedOption at index 3 (4th position)
                          const insertIndex = Math.min(
                            3,
                            withoutSelected.length
                          );
                          let updatedOptions = [
                            ...withoutSelected.slice(0, insertIndex),
                            selectedOption,
                            ...withoutSelected.slice(insertIndex),
                          ];

                          // If there was an original 3rd item (and it's not the selected one), move it to the end
                          if (
                            originalThird &&
                            originalThird.value !== opt.value
                          ) {
                            const idx = updatedOptions.findIndex(
                              (o) => o.value === originalThird.value
                            );
                            if (idx > -1) {
                              updatedOptions.splice(idx, 1);
                              updatedOptions.push(originalThird);
                            }
                          }

                          return updatedOptions;
                        });
                        setShowStatusDropdown(false);
                      }}
                      role="menuitem"
                      className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-gray-50 text-gray-700`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Conversations List */}
        <div
          ref={conversationRef}
          onScroll={handleConvScroll}
          className="flex-1 overflow-y-auto"
        >
          {conversations?.length === 0 && !fetchConvLoading ? (
            <div className="text-center py-3">
              <span className="text-sm text-gray-500 text-center block">
                No Conversations
              </span>
            </div>
          ) : fetchConvLoading && currentConvPage === 1 ? (
            <></>
          ) : (
            conversations.map((conv) => (
              <Conversation
                key={conv._id}
                conversation={conv}
                selectedConversation={selectedConversation}
                setSelectedConversation={setSelectedConversation}
              />
            ))
          )}
          {fetchConvLoading && (
            <div className="text-center">
              <span className="text-sm text-gray-500 text-center mt-3 block">
                Loading...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white relative">
        {!selectedConversation ? (
          <NoSelectedConversation />
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white shadow-sm">
              <div className="flex items-center space-x-3">
                {isMobileView && (
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                <AvatarComponent
                  name={selectedConversation?.leadId?.name || ""}
                  size="md"
                />
                <div>
                  <h3 className="font-semibold text-gray-800 text-lg">
                    {selectedConversation?.leadId?.name}
                  </h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <span>
                      Last seen{" "}
                      {getFormatedTime(
                        selectedConversation?.recentMessage?.createdAt
                      ) || "recently"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <WhatsappTimer
                  selectedProvider={selectedProvider}
                  whatsappRemainingTime={whatsappRemainingTime}
                />
                {/* <button className="p-2.5 text-gray-600 hover:bg-white hover:text-gray-800 rounded-lg transition-colors hover:shadow-sm">
                  <Info className="h-5 w-5" />
                </button>
                <button className="p-2.5 text-gray-600 hover:bg-white hover:text-gray-800 rounded-lg transition-colors hover:shadow-sm">
                  <MoreVertical className="h-5 w-5" />
                </button> */}
              </div>
            </div>

            {/* Messages Area */}
            <div
              ref={messageRef}
              onScroll={handleMsgScroll}
              className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 bg-gradient-to-b from-gray-50 to-gray-100"
            >
              {/* Sticky Date Header (updates based on visible messages) */}
              {messages.length > 0 && (
                <div className="sticky top-2 z-10 pointer-events-none">
                  <div className="text-center">
                    <span className="text-sm text-gray-500 bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm font-medium">
                      {"11/02/2025"}
                    </span>
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg) => (
                <div key={msg?._id} data-createdat={msg?.createdAt}>
                  <Message
                    message={msg}
                    onSelectMessage={(msg) => setSelectedMessage(msg)}
                  />
                </div>
              ))}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>

            {/* Scroll to bottom button (positioned relative to chat column, not the scrollable list) */}
            {showScrollButton && !selectedMessage && (
              <button
                onClick={handleScrollMsgsToBottom}
                className="absolute right-6 bottom-40 cursor-pointer bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition-all hover:scale-105 hover:shadow-xl z-10"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
            )}

            {/* Message Input */}
            <div className="border-t border-gray-200 bg-white shadow-lg">
              {selectedMessage && (
                <div className="m-2.5 p-3 bg-gray-50 border-l-4 border-l-green-500 rounded-lg flex justify-between items-start space-x-4">
                  <div className="flex-1">
                    <div className="text-sm text-gray-600 mb-1">
                      Replying to{" "}
                      {selectedMessage?.direction === "incoming"
                        ? selectedMessage?.recipientId?.name
                        : selectedMessage?.senderId?.name || "Customer Support"}
                    </div>
                    <div className="text-sm text-gray-800">
                      {selectedMessage?.content || "Media message"}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedMessage(null)}
                    className="text-gray-400 cursor-pointer hover:text-gray-600 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
              <div className="flex space-x-3 p-2.5">
                <textarea
                  ref={textAreaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here..."
                  className="flex-1 text-sm border-none outline-none"
                  rows={3}
                />
              </div>

              {/* Quick Actions */}
              <div className="flex items-center justify-between bg-gray-50 p-2.5 mt-2 text-sm">
                <div className="flex items-center gap-2">
                  <CustomDropdown
                    position="top-left"
                    align="start"
                    offset={2}
                    autoPosition={true}
                    trigger={
                      <button
                        title="Choose Provider"
                        className="group flex items-center gap-2 px-4 py-2.5 text-gray-700 bg-white border border-gray-300 hover:border-gray-400 hover:shadow-md rounded-lg transition-all duration-200 focus:outline-none"
                      >
                        <div className="flex items-center gap-2">
                          {selectedProvider ? (
                            <>
                              {selectedProvider?.type?.includes("sms") ? (
                                <Phone className="h-5 w-5 text-blue-500" />
                              ) : selectedProvider?.type?.includes(
                                  "whatsapp"
                                ) ? (
                                <FaWhatsapp className="h-5 w-5 text-green-600" />
                              ) : selectedProvider?.type?.includes("email") ? (
                                <Mail className="h-5 w-5 text-red-500" />
                              ) : (
                                <User className="h-5 w-5" />
                              )}
                              <div className="text-left">
                                <span className="font-semibold text-gray-800 text-sm block leading-tight">
                                  {selectedProvider.label ||
                                    selectedProvider?.phone ||
                                    selectedProvider?.email ||
                                    "Unknown Provider"}
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              <User className="h-5 w-5" />
                              {/* <span className="font-medium text-gray-600">
                                Select Provider
                              </span> */}
                            </>
                          )}
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-gray-700 transition-transform duration-300`}
                        />
                      </button>
                    }
                    maxHeight="50vh"
                    dropdownClassName="bg-white border border-gray-200 rounded-xl shadow-xl py-2 backdrop-blur-sm bg-white/95"
                    closeOnSelect={true}
                  >
                    <div className="w-[320px]">
                      {/* Header */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-800 text-sm">
                          Select Provider
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Choose a communication provider
                        </p>
                      </div>

                      {/* Providers List */}
                      <div className="max-h-[40vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent py-2">
                        {providers.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <div className="inline-flex p-3 rounded-full bg-gray-100 mb-3">
                              <User className="h-6 w-6 text-gray-400" />
                            </div>
                            <p className="text-gray-500 text-sm">
                              No providers available
                            </p>
                          </div>
                        ) : (
                          providers.map((provider) => {
                            const isSelected =
                              selectedProvider?._id === provider._id;

                            // Determine icon and colors based on provider type
                            const getIcon = () => {
                              if (provider?.type?.includes("sms")) {
                                return <Phone className="h-4 w-4" />;
                              } else if (provider?.type?.includes("whatsapp")) {
                                return <FaWhatsapp className="h-4 w-4" />;
                              } else if (provider?.type?.includes("email")) {
                                return <Mail className="h-4 w-4" />;
                              }
                              return <User className="h-4 w-4" />;
                            };

                            const getBgColor = () => {
                              if (provider?.type?.includes("sms"))
                                return "bg-blue-100";
                              if (provider?.type?.includes("whatsapp"))
                                return "bg-green-100";
                              if (provider?.type?.includes("email"))
                                return "bg-red-100";
                              return "bg-purple-100";
                            };

                            const getTextColor = () => {
                              if (provider?.type?.includes("sms"))
                                return "text-blue-600";
                              if (provider?.type?.includes("whatsapp"))
                                return "text-green-600";
                              if (provider?.type?.includes("email"))
                                return "text-red-600";
                              return "text-purple-600";
                            };

                            const getTypeLabel = () => {
                              if (provider?.type?.includes("sms")) return "SMS";
                              if (provider?.type?.includes("whatsapp"))
                                return "WhatsApp";
                              if (provider?.type?.includes("email"))
                                return "Email";
                              return "Provider";
                            };

                            const getStatusColor = () => {
                              const status = provider.status?.toLowerCase();
                              if (status === "active")
                                return "bg-green-100 text-green-800";
                              if (status === "inactive")
                                return "bg-red-100 text-red-800";
                              if (status === "pending")
                                return "bg-yellow-100 text-yellow-800";
                              return "bg-gray-100 text-gray-800";
                            };

                            return (
                              <div
                                key={provider._id}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  setSelectedProvider(provider);
                                }}
                                onKeyDown={(e) =>
                                  e.key === "Enter" &&
                                  setSelectedProvider(provider)
                                }
                                className={`mx-2 my-1 px-3 py-3 cursor-pointer rounded-xl transition-all duration-200 ${
                                  isSelected
                                    ? "bg-gradient-to-r from-blue-50 to-blue-50/50 border border-blue-200 shadow-sm"
                                    : "hover:bg-gray-50 active:bg-gray-100 border border-transparent hover:border-gray-200"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`relative p-2.5 rounded-xl ${getBgColor()} ${getTextColor()} shadow-sm`}
                                    >
                                      {getIcon()}
                                      {provider.status === "approved" && (
                                        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-green-500 rounded-full border border-white"></span>
                                      )}
                                    </div>
                                    <div className="text-left">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-800 text-sm">
                                          {provider.label ||
                                            provider?.phone ||
                                            provider?.email ||
                                            "Unknown Provider"}
                                        </span>
                                        {/* {provider.default && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          Default
                        </span>
                      )} */}
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        {provider.status && (
                                          <span
                                            className={`text-xs px-1.5 py-0.5 rounded-full ${getStatusColor()}`}
                                          >
                                            {provider.status}
                                          </span>
                                        )}
                                        <span className="text-xs text-gray-500">
                                          {getTypeLabel()}
                                        </span>
                                      </div>
                                      {(provider.phone || provider.email) && (
                                        <p className="text-xs text-gray-600 mt-1 truncate max-w-[180px]">
                                          {provider.phone || provider.email}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Selection indicator */}
                                  <div className="flex items-center">
                                    <div
                                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                        isSelected
                                          ? "border-blue-500 bg-blue-500"
                                          : "border-gray-300"
                                      }`}
                                    >
                                      {isSelected && (
                                        <svg
                                          className="h-2.5 w-2.5 text-white"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="3"
                                            d="M5 13l4 4L19 7"
                                          />
                                        </svg>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Footer with Add New Provider button */}
                      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
                        <button
                          onClick={() => {
                            // Add your add provider logic here
                            console.log("Add new provider");
                          }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                          Add New Provider
                        </button>
                      </div>
                    </div>
                  </CustomDropdown>
                  <TemplatesModal
                    templates={templates}
                    attachedFile={attachedFile}
                    selectedTemplate={selectedTemplate}
                    selectedProvider={selectedProvider}
                    setSelectedTemplate={setSelectedTemplate}
                    setAttachedFile={setAttachedFile}
                    setMessage={setMessage}
                    setMediaType={setMediaType}
                    setBodyParameters={setBodyParameters}
                    setHeaderParameters={setHeaderParameters}
                  />

                  <AttachmentModal
                    attachedFile={attachedFile}
                    setAttachedFile={setAttachedFile}
                    attachedFiles={state.attachedFiles}
                    setAttachedFiles={setAttachedFiles}
                  />

                  <EmojiPickerModal
                    inputRef={textAreaRef as any}
                    triggerButton={
                      <button className="border border-gray-300 cursor-pointer rounded-md p-2.5">
                        <Smile
                          size={20}
                          className="text-muted-foreground transition-transform duration-200"
                        />
                      </button>
                    }
                    position="top-left"
                    align="start"
                    setValue={setMessage}
                  />

                  {/* <EmojiPickerModal
                    triggerButton={
                      <button className="border border-gray-300 rounded-md p-2.5">
                        <Smile
                          size={20}
                          className="text-muted-foreground transition-transform duration-200"
                        />
                      </button>
                    }
                    position="top-left"
                    align="start"
                    setValue={(val) => setMessage((prev) => `${prev} ${val}`)}
                  /> */}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSendMessage}
                    disabled={!message.trim() || !selectedProvider}
                    className="bg-gradient-to-r from-gray-800 to-gray-900 text-white hover:from-gray-700 hover:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed p-2.5 rounded-xl font-semibold flex items-center space-x-2 transition-all hover:shadow-md"
                  >
                    <Timer className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleSendMessage}
                    disabled={
                      sendMsgLoading ||
                      (!message.trim() &&
                        !attachedFile &&
                        !(state.attachedFiles && state.attachedFiles.length)) ||
                      !selectedProvider
                    }
                    className="bg-gradient-to-r from-gray-800 to-gray-900 text-white hover:from-gray-700 hover:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed p-2.5 rounded-xl font-semibold flex items-center space-x-2 transition-all hover:shadow-md"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Sidebar - Conversation Info */}
      {selectedConversation && !isMobileView && (
        <div className="w-full md:w-1/4 lg:w-1/4 border-l border-gray-200 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Conversation Info</h3>
            <p className="text-sm text-gray-500">
              Details about the selected conversation
            </p>
          </div>
          <CollapsibleWrapper headerTitle="Lead Details">
            <div className="space-y-6 py-2.5">
              <div className="flex items-center space-x-3">
                <AvatarComponent
                  name={selectedConversation?.leadId?.name || ""}
                  size="lg"
                />
                <div>
                  <div className="font-semibold text-gray-800">
                    {selectedConversation?.leadId?.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {selectedConversation?.leadId?.phone ||
                      selectedConversation?.leadId?.email}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone
                    </div>
                    <div className="font-medium text-gray-800">
                      {selectedConversation?.leadId?.phone || "—"}
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </div>
                    <div className="font-medium text-gray-800">
                      {selectedConversation?.leadId?.email || "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* <div>
                <h4 className="text-sm font-semibold text-gray-700">
                  Conversation Meta
                </h4>
                <ul className="text-sm text-gray-600 mt-2 space-y-1">
                  <li>Messages: {messages.length}</li>
                  <li>
                    Provider:{" "}
                    {selectedProvider?.label || selectedProvider?.phone || "—"}
                  </li>
                  <li>Status: {selectedConversation?.status || "open"}</li>
                </ul>
              </div> */}
            </div>
          </CollapsibleWrapper>

          {/* Tags */}
          <CollapsibleWrapper
            headerTitle="Tags"
            rightActionButton={
              <button
                onClick={() => {
                  // Add tag logic
                  setIsAddTagModalOpen(true);
                }}
                className="text-sm cursor-pointer text-blue-600 hover:text-blue-800 font-medium"
              >
                Add
              </button>
            }
          >
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const colorClass = getTagColor(tag);

                return (
                  <div
                    key={tag}
                    className={`
                ${colorClass}
                inline-flex items-center gap-1.5 
                px-3 py-1.5 
                rounded-full 
                border 
                transition-all 
                duration-200 
                group
              `}
                  >
                    <span className="text-xs font-medium">{tag}</span>

                    {/* Remove button */}
                    <button
                      onClick={() => {}}
                      className={`
                  opacity-0 hidden group-hover:opacity-100
                  group-hover:inline-flex
                  transition-opacity duration-200
                  p-0.5
                  rounded-full
                  hover:bg-white/50
                  cursor-pointer
                  focus:outline-none focus:ring-1 focus:ring-current
                `}
                      aria-label={`Remove ${tag} tag`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </CollapsibleWrapper>
        </div>
      )}

      {/* Add Tag modal */}
      <AddTagModal
        isOpen={isAddTagModalOpen}
        onClose={() => setIsAddTagModalOpen(false)}
        onComplete={(tag) => console.log("Tag added:", tag)}
        token={"your-auth-token"}
        conversationId="conv-123"
        conversationTitle="Customer Support Query"
        conversationType="chat"
        existingTags={["urgent", "billing"]}
      />
    </div>
  );
};

// ✅ Correctly typed getLayout
InboxPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

// ✅ Wrap page with auth HOC
const ProtectedInboxPage = withClinicAuth(InboxPage) as NextPageWithLayout;

// ✅ Re-attach layout
ProtectedInboxPage.getLayout = InboxPage.getLayout;

export default ProtectedInboxPage;
