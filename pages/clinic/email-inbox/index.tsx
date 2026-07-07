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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
        starredIds={inbox.starredIds}
        onSelect={(_conversationId, messageId) => {
          inbox.selectMessage(messageId);
          inbox.fetchThreadMessages(messageId);
        }}
        onToggleStar={inbox.toggleStar}
        hasMore={inbox.hasMoreMessages}
        onLoadMore={inbox.loadMoreEmailMessages}
        listRef={inbox.conversationListRef as any}
      />

      <EmailReadingPane
        messages={inbox.threadMessages}
        loading={inbox.fetchThreadMsgsLoading}
        starred={
          inbox.selectedConversationId
            ? inbox.starredIds.has(inbox.selectedConversationId)
            : false
        }
        onToggleStar={inbox.toggleStar}
        onArchive={inbox.archiveConversation}
        onTrash={inbox.trashConversation}
        onReply={(m) => inbox.startCompose("reply", m)}
        onForward={(m) => inbox.startCompose("forward", m)}
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
        />
      )}

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
