import React, { ReactElement, useState } from "react";
import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import { NextPageWithLayout } from "@/pages/_app";

import EmailInboxStyles from "./_components/EmailInboxStyles";
import EmailSidebar from "./_components/EmailSidebar";
import EmailList from "./_components/EmailList";
import EmailReadingPane from "./_components/EmailReadingPane";
import ComposeWindow from "./_components/ComposeWindow";
import EmailToast from "./_components/EmailToast";
import useEmailInbox from "@/hooks/useEmailInbox";
import DeleteConfirmModal from "./_components/DeleteConfirmModal";
import AddTagModal from "./_components/AddTagModal";
import FilterModal from "./_components/FilterModal";

/**
 * EmailInboxPage
 * --------------------------------------------------------------------
 * Thin composition layer only — all business logic lives in
 * useEmailInbox, all presentation lives under ./_components.
 *
 * This is a NEW file (does not replace your existing EmailInboxPage).
 * Once you're happy with it, swap it in for the current page file.
 */
const EmailInboxPage: NextPageWithLayout = () => {
  const inbox = useEmailInbox();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  return (
    <div className="pi-root">
      <EmailInboxStyles />
      <EmailSidebar
        folder={inbox.folder}
        onFolderChange={inbox.setFolder}
        onCompose={() => inbox.startCompose("new")}
        unreadCountFor={inbox.unreadCountFor}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />
      <EmailList
        folder={inbox.folder}
        messages={inbox.messages}
        loading={inbox.fetchMsgsLoading}
        search={inbox.search}
        onSearchChange={inbox.setSearch}
        selectedMessageId={inbox.selectedMessageId}
        onSelect={(conversationId, messageId) => {
          inbox.fetchConversation(conversationId);
          inbox.selectMessage(messageId);
          inbox.fetchThreadMessages(messageId);
        }}
        onToggleStar={inbox.starMessage}
        hasMore={inbox.hasMoreMessages}
        onLoadMore={inbox.loadMoreEmailMessages}
        listRef={inbox.conversationListRef as any}
        onFilterClick={() => setIsFilterModalOpen(true)}
        hasActiveFilters={!!inbox.filterOwnerId}
      />
      <EmailReadingPane
        messages={inbox.threadMessages}
        loading={inbox.fetchThreadMsgsLoading}
        starred={inbox.selectedMessage?.isStarred || false}
        archived={inbox.selectedMessage?.isArchived || false}
        trashed={inbox.selectedMessage?.isTrashed || false}
        onToggleStar={inbox.starMessage}
        onArchive={inbox.archiveMessage}
        onTrash={inbox.trashMessage}
        onDelete={inbox.deleteMessage}
        onRestoreFromTrash={inbox.restoreFromTrash}
        onRestoreFromArchive={inbox.restoreFromArchive}
        onReply={(m) => inbox.startCompose("reply", m)}
        onForward={(m) => inbox.startCompose("forward", m)}
        agents={inbox.agents}
        selectedAgent={inbox.selectedAgent}
        onAgentSelect={inbox.handleAgentSelect}
        agentFetchLoading={inbox.agentFetchLoading}
        // Tags
        tags={inbox.tags}
        onAddTag={() => inbox.setIsAddTagModalOpen(true)}
        onRemoveTag={(tag) =>
          inbox.handleRemoveTagFromConversation(inbox.leadId, tag)
        }
        leadId={inbox.leadId}
      />
      {inbox.composeOpen && (
        <ComposeWindow
          emailProviders={inbox.emailProviders}
          selectedProvider={inbox.selectedProvider}
          compose={inbox.compose}
          setCompose={inbox.setCompose}
          attachedFiles={inbox.attachedFiles}
          setAttachedFiles={inbox.setAttachedFiles}
          minimized={inbox.composeMinimized}
          setMinimized={inbox.setComposeMinimized}
          maximized={inbox.composeMaximized}
          setMaximized={inbox.setComposeMaximized}
          sending={inbox.sending}
          onClose={inbox.closeCompose}
          onSend={inbox.sendEmail}
          onSchedule={inbox.scheduleEmail}
        />
      )}
      {/* Delete confirm modal */}
      <DeleteConfirmModal
        isOpen={inbox.isOpenDeleteConfirmModal}
        loading={inbox.isDeletingMessage}
        onClose={inbox.closeDeleteConfirmModal}
        onConfirm={async () => {
          await inbox.deleteMessageForever();
        }}
      />
      {/* Add tag modal */}
      <AddTagModal
        isOpen={inbox.isAddTagModalOpen}
        onClose={() => inbox.setIsAddTagModalOpen(false)}
        leadId={inbox.leadId}
        conversationTitle={inbox.selectedMessage?.subject || "Email"}
        existingTags={inbox.tags}
        handleAddTagToConversation={inbox.handleAddTagToConversation}
        loading={inbox.isAddingTag}
      />
      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        agents={inbox.agents}
        selectedAgentId={inbox.filterOwnerId}
        onAgentSelect={inbox.setFilterOwnerId}
        onApplyFilters={() => inbox.fetchEmailMessages(1)}
        loading={inbox.fetchMsgsLoading}
      />
      <EmailToast message={inbox.toastMessage} />
    </div>
  );
};

EmailInboxPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

const ProtectedEmailInboxPage = withClinicAuth(
  EmailInboxPage,
) as NextPageWithLayout;
ProtectedEmailInboxPage.getLayout = EmailInboxPage.getLayout;

export default ProtectedEmailInboxPage;
