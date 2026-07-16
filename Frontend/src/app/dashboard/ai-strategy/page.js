"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  Check,
  CheckSquare,
  Clock3,
  Copy,
  Loader2,
  Menu,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Share2,
  Square,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sendCareerChat, streamCareerChat } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

const MAX_MESSAGE_LENGTH = 8000;
const HISTORY_BATCH_SIZE = 24;

const welcomeMessage = {
  id: "welcome",
  role: "assistant",
  content: "How can I help you today?",
  createdAt: new Date(0).toISOString(),
};
const fallbackMessages = [welcomeMessage];

const suggestions = [
  {
    label: "Analyze Job Description",
    prompt: "Analyze this job description and list the must-have skills.",
  },
  {
    label: "Interview Questions",
    prompt: "Ask me 10 interview questions for this role.",
  },
  {
    label: "Career Roadmap",
    prompt: "Create a 4-week preparation roadmap.",
  },
  {
    label: "Resume Summary",
    prompt: "Improve my resume summary for this job.",
  },
];

export default function AiStrategyPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(HISTORY_BATCH_SIZE);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMorePrompts, setShowMorePrompts] = useState(false);
  const [deleteDialogConversationId, setDeleteDialogConversationId] = useState("");
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAwaitingFirstToken, setIsAwaitingFirstToken] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState("");
  const scrollRef = useRef(null);
  const historyRef = useRef(null);
  const composerRef = useRef(null);
  const deleteDialogRef = useRef(null);
  const deleteButtonRef = useRef(null);
  const loadedStorageKeyRef = useRef("");
  const shouldStickToBottomRef = useRef(true);

  const storageKey = useMemo(() => {
    const userKey = user?.id || user?.email || "guest";
    return `strategyhub.aiStrategy.conversations.${userKey}`;
  }, [user?.email, user?.id]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const fallback = createConversation();

      try {
        const saved = window.localStorage.getItem(storageKey);
        const parsed = saved ? JSON.parse(saved) : null;
        const savedConversations = Array.isArray(parsed?.conversations)
          ? parsed.conversations.map(normalizeConversation).filter(Boolean)
          : [];
        const nextConversations = savedConversations.length ? savedConversations : [fallback];
        const nextActiveId =
          parsed?.activeConversationId &&
          nextConversations.some((conversation) => conversation.id === parsed.activeConversationId)
            ? parsed.activeConversationId
            : nextConversations[0].id;

        if (!cancelled) {
          setConversations(sortConversations(nextConversations));
          setActiveConversationId(nextActiveId);
        }
      } catch {
        if (!cancelled) {
          setConversations([fallback]);
          setActiveConversationId(fallback.id);
        }
      } finally {
        if (!cancelled) {
          loadedStorageKeyRef.current = storageKey;
        }
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [storageKey]);

  useEffect(() => {
    if (loadedStorageKeyRef.current !== storageKey) return;

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        activeConversationId,
        conversations,
      })
    );
  }, [activeConversationId, conversations, storageKey]);

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeConversationId) ||
      conversations[0],
    [activeConversationId, conversations]
  );
  const deleteDialogConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === deleteDialogConversationId) ||
      null,
    [conversations, deleteDialogConversationId]
  );

  const messages = useMemo(
    () => activeConversation?.messages || fallbackMessages,
    [activeConversation?.messages]
  );

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.id !== "welcome" && message.content?.trim()),
    [messages]
  );

  const filteredConversations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const sorted = sortConversations(conversations);

    if (!query) return sorted;

    return sorted.filter((conversation) => {
      const haystack = [
        conversation.title,
        getConversationPreview(conversation),
        ...conversation.messages.map((message) => message.content),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [conversations, searchTerm]);

  const visibleConversations = filteredConversations.slice(0, visibleHistoryCount);

  useEffect(() => {
    if (!deleteDialogConversation) return undefined;

    const previouslyFocused = document.activeElement;
    window.setTimeout(() => deleteButtonRef.current?.focus(), 0);

    function handleDialogKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDeleteDialog();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        deleteButtonRef.current?.click();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = deleteDialogRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const focusable = Array.from(focusableElements || []).filter(
        (element) => !element.hasAttribute("disabled")
      );
      if (!focusable.length) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleDialogKeyDown);
      document.body.style.overflow = "";
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [deleteDialogConversation]);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior,
    });
  }, []);

  useEffect(() => {
    shouldStickToBottomRef.current = true;
    scrollToBottom("auto");
  }, [activeConversationId, scrollToBottom]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    function handleConversationScroll() {
      const distanceFromBottom =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      shouldStickToBottomRef.current = distanceFromBottom < 120;
    }

    handleConversationScroll();
    scroller.addEventListener("scroll", handleConversationScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", handleConversationScroll);
  }, []);

  useEffect(() => {
    if (shouldStickToBottomRef.current) {
      scrollToBottom(isSending ? "auto" : "smooth");
    }
  }, [messages, isSending, scrollToBottom]);

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 156)}px`;
  }, [input]);

  function updateConversation(conversationId, updater) {
    setConversations((current) =>
      sortConversations(
        current.map((conversation) =>
          conversation.id === conversationId
            ? normalizeConversation(updater(conversation))
            : conversation
        )
      )
    );
  }

  function createNewChat() {
    const conversation = createConversation();
    setConversations((current) => sortConversations([conversation, ...current]));
    setActiveConversationId(conversation.id);
    setInput("");
    setSidebarOpen(false);
  }

  function renameConversation(conversationId = activeConversationId) {
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return;

    const nextTitle = window.prompt("Rename conversation", conversation.title);
    if (!nextTitle?.trim()) return;

    updateConversation(conversationId, (current) => ({
      ...current,
      title: nextTitle.trim().slice(0, 80),
      updatedAt: new Date().toISOString(),
    }));
  }

  function requestDeleteConversation(conversationId = activeConversationId) {
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return;

    setDeleteDialogConversationId(conversation.id);
  }

  function closeDeleteDialog() {
    setDeleteDialogConversationId("");
  }

  function deleteConversation(conversationId = deleteDialogConversationId) {
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) {
      closeDeleteDialog();
      return;
    }

    closeDeleteDialog();

    setConversations((current) => {
      const remaining = current.filter((item) => item.id !== conversationId);
      if (remaining.length) {
        if (conversationId === activeConversationId) {
          setActiveConversationId(remaining[0].id);
          setInput("");
        }
        return sortConversations(remaining);
      }

      const replacement = createConversation();
      setActiveConversationId(replacement.id);
      setInput("");
      return [replacement];
    });
  }

  async function shareConversation(conversation = activeConversation) {
    if (!conversation) return;

    const text = formatConversation(conversation);
    if (navigator.share) {
      await navigator.share({
        title: conversation.title,
        text,
      });
      return;
    }

    await navigator.clipboard.writeText(text);
    toast.success("Share text copied.");
  }

  async function submitMessage(prompt = input) {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isSending || !activeConversation) return;

    const now = new Date().toISOString();
    const safePrompt = trimmedPrompt.slice(0, MAX_MESSAGE_LENGTH);
    const userMessage = {
      id: createId(),
      role: "user",
      content: safePrompt,
      createdAt: now,
    };
    const generatedTitle = generateConversationTitle(safePrompt);
    const shouldRetitle = isUntitledConversation(activeConversation);
    const nextMessages = [...messages, userMessage];

    updateConversation(activeConversation.id, (current) => ({
      ...current,
      title: shouldRetitle ? generatedTitle : current.title,
      messages: nextMessages,
      lastUserPrompt: safePrompt,
      updatedAt: now,
    }));

    setInput("");
    setIsSending(true);
    setIsAwaitingFirstToken(true);
    shouldStickToBottomRef.current = true;

    await requestAssistantResponse(activeConversation.id, nextMessages);
  }

  async function requestAssistantResponse(conversationId, nextMessages) {
    const now = new Date().toISOString();
    const assistantMessageId = createId();
    let streamedReply = "";
    let hasStreamedChunk = false;
    let frameId = 0;

    const requestMessages = nextMessages
      .filter((message) => message.id !== "welcome" && message.content?.trim())
      .slice(-10)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const assistantMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: now,
    };

    updateConversation(conversationId, (current) => ({
      ...current,
      messages: [...current.messages, assistantMessage],
      updatedAt: now,
    }));

    const flushStreamedReply = (updatedAt = new Date().toISOString()) => {
      updateConversation(conversationId, (current) => ({
        ...current,
        messages: current.messages.map((message) =>
          message.id === assistantMessageId
            ? { ...message, content: streamedReply }
            : message
        ),
        updatedAt,
      }));
    };

    try {
      const data = await streamCareerChat(requestMessages, {
        onChunk: (chunk, fullReply) => {
          streamedReply = fullReply;
          hasStreamedChunk = true;
          setIsAwaitingFirstToken(false);

          if (frameId) return;
          frameId = window.requestAnimationFrame(() => {
            frameId = 0;
            flushStreamedReply();
          });
        },
      });

      if (frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }

      streamedReply = data.reply || streamedReply || "I could not generate a response. Please try again.";
      flushStreamedReply(new Date().toISOString());
    } catch (error) {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }

      if (hasStreamedChunk && streamedReply.trim()) {
        flushStreamedReply(new Date().toISOString());
        toast.error("The response stream ended early. You can regenerate if needed.");
        return;
      }

      try {
        const data = await sendCareerChat(requestMessages);
        streamedReply = data.reply || "I could not generate a response. Please try again.";
        flushStreamedReply(new Date().toISOString());
        return;
      } catch (fallbackError) {
        const message =
          fallbackError?.response?.data?.message ||
          fallbackError?.message ||
          error?.message ||
          "Gemini could not answer right now. Please try again.";
        const errorTime = new Date().toISOString();
        toast.error(message);

        updateConversation(conversationId, (current) => ({
          ...current,
          messages: current.messages.map((messageItem) =>
            messageItem.id === assistantMessageId
              ? {
                  ...messageItem,
                  content: message,
                  isError: true,
                  createdAt: errorTime,
                }
              : messageItem
          ),
          updatedAt: errorTime,
        }));
      }
    } finally {
      setIsAwaitingFirstToken(false);
      setIsSending(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    submitMessage();
  }

  async function copyMessage(message) {
    await navigator.clipboard.writeText(message.content);
    setCopiedMessageId(message.id);
    toast.success("Response copied.");
    window.setTimeout(() => setCopiedMessageId(""), 1400);
  }

  async function regenerateLast() {
    if (!activeConversation?.lastUserPrompt || isSending) {
      toast.info("Send a message first, then regenerate the response.");
      return;
    }

    const lastAssistantIndex = [...messages]
      .reverse()
      .findIndex((message) => message.role === "assistant");
    const removeIndex =
      lastAssistantIndex === -1 ? -1 : messages.length - 1 - lastAssistantIndex;
    const nextMessages =
      removeIndex === -1 ? messages : messages.filter((_, index) => index !== removeIndex);

    updateConversation(activeConversation.id, (current) => ({
      ...current,
      messages: nextMessages,
      updatedAt: new Date().toISOString(),
    }));
    setIsSending(true);
    setIsAwaitingFirstToken(true);
    await requestAssistantResponse(activeConversation.id, nextMessages);
  }

  function retryMessage(messageId) {
    if (!activeConversation) return;

    const failedIndex = messages.findIndex((message) => message.id === messageId);
    if (failedIndex === -1 || isSending) return;

    const nextMessages = messages.slice(0, failedIndex);
    updateConversation(activeConversation.id, (current) => ({
      ...current,
      messages: nextMessages,
      updatedAt: new Date().toISOString(),
    }));
    setIsSending(true);
    setIsAwaitingFirstToken(true);
    requestAssistantResponse(activeConversation.id, nextMessages);
  }

  function handleHistoryScroll() {
    const list = historyRef.current;
    if (!list) return;

    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    if (distanceFromBottom < 80 && visibleHistoryCount < filteredConversations.length) {
      setVisibleHistoryCount((current) => current + HISTORY_BATCH_SIZE);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="mx-auto grid h-[calc(100dvh-6.5rem)] min-h-0 w-full max-w-[100rem] overflow-hidden lg:grid-cols-[20rem_minmax(0,1fr)]"
    >
      <aside
        className={cn(
          "absolute inset-y-0 left-0 z-30 flex w-[20rem] flex-col border-r border-white/10 bg-background/95 transition-transform duration-200 lg:static lg:translate-x-0 lg:bg-transparent",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="space-y-2 border-b border-white/10 px-3 py-3">
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full justify-start rounded-lg px-3 text-sm font-medium text-foreground hover:bg-surface-1"
            onClick={createNewChat}
          >
            <Plus className="size-4" />
            New chat
          </Button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setVisibleHistoryCount(HISTORY_BATCH_SIZE);
              }}
              placeholder="Search chats"
              className="h-9 rounded-lg border-white/10 bg-transparent pl-8 text-sm"
            />
          </div>
        </div>

        <div
          ref={historyRef}
          onScroll={handleHistoryScroll}
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2"
        >
          <p className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">
            Chats
          </p>
          {visibleConversations.map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === activeConversationId}
              onSelect={() => {
                setActiveConversationId(conversation.id);
                setInput("");
                setSidebarOpen(false);
              }}
              onRename={() => renameConversation(conversation.id)}
              onDelete={() => requestDeleteConversation(conversation.id)}
            />
          ))}

          {!visibleConversations.length ? (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted-foreground">
              No chats found.
            </div>
          ) : null}
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close chat sidebar"
          className="absolute inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="relative flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="pointer-events-auto rounded-full bg-background/85 backdrop-blur-xl lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open chat sidebar"
          >
            <Menu className="size-4" />
          </Button>
        </div>

        <div
          ref={scrollRef}
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth px-4 pb-8 pt-16 outline-none md:px-8 md:pb-10"
        >
          <div className="mx-auto w-full max-w-[58rem] space-y-8">
            {visibleMessages.length ? (
              visibleMessages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  copied={copiedMessageId === message.id}
                  onCopy={() => copyMessage(message)}
                  onRetry={() => retryMessage(message.id)}
                  onRegenerate={regenerateLast}
                  onShare={() => shareConversation()}
                  onDelete={() => requestDeleteConversation()}
                />
              ))
            ) : (
              <WelcomePrompt />
            )}

            {isSending && isAwaitingFirstToken ? <TypingIndicator /> : null}
          </div>
        </div>

        <section className="sticky bottom-0 shrink-0 bg-background/92 px-3 pb-3 pt-2 backdrop-blur-xl md:px-6 md:pb-3">
          <div className="mx-auto w-full max-w-[58rem] space-y-2">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitMessage();
              }}
              className="flex w-full items-center gap-2 rounded-[1.35rem] border border-white/10 bg-surface-1/70 px-3 py-1.5 shadow-lg shadow-black/10 transition-all focus-within:border-fuchsia-300/35 focus-within:bg-surface-1/90"
            >
              <Textarea
                ref={composerRef}
                value={input}
                maxLength={MAX_MESSAGE_LENGTH}
                onChange={(event) => {
                  setInput(event.target.value);
                  if (event.target.value.trim()) setShowMorePrompts(false);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Message Strategy AI..."
                disabled={isSending}
                className="max-h-[9.75rem] min-h-10 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 py-2 text-base leading-6 text-white shadow-none placeholder:text-muted-foreground/65 focus-visible:ring-0 disabled:bg-transparent"
                aria-label="AI strategy message"
              />
              <Button
                type="submit"
                disabled={!input.trim() || isSending}
                className="h-9 shrink-0 rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]"
              >
                {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Send
              </Button>
            </form>

            {!input.trim() ? (
              <div className="relative flex flex-wrap gap-2 overflow-visible pb-0.5">
                {suggestions.slice(0, 3).map((suggestion) => (
                  <SuggestionChip
                    key={suggestion.label}
                    suggestion={suggestion}
                    disabled={isSending}
                    onSelect={() => {
                      setInput(suggestion.prompt);
                      setShowMorePrompts(false);
                    }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setShowMorePrompts((current) => !current)}
                  disabled={isSending}
                  className="rounded-full border border-border/70 bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-fuchsia-300/40 hover:bg-surface-1 hover:text-white disabled:pointer-events-none disabled:opacity-60"
                >
                  + More
                </button>
                {showMorePrompts ? (
                  <div className="absolute bottom-full left-0 z-20 mb-2 min-w-56 rounded-xl border border-white/10 bg-popover p-1.5 text-popover-foreground shadow-xl shadow-black/25">
                    {suggestions.slice(3).map((suggestion) => (
                      <button
                        key={suggestion.label}
                        type="button"
                        onClick={() => {
                          setInput(suggestion.prompt);
                          setShowMorePrompts(false);
                        }}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-surface-1 hover:text-white"
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <DeleteConversationDialog
        conversation={deleteDialogConversation}
        dialogRef={deleteDialogRef}
        deleteButtonRef={deleteButtonRef}
        onCancel={closeDeleteDialog}
        onConfirm={() => deleteConversation(deleteDialogConversation?.id)}
      />
    </motion.section>
  );
}

function ConversationListItem({ conversation, active, onSelect, onRename, onDelete }) {
  return (
    <div
      className={cn(
        "group flex h-9 w-full items-center gap-1 rounded-lg px-2 transition-colors",
        active
          ? "bg-surface-2 text-white"
          : "text-muted-foreground hover:bg-surface-1 hover:text-white"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={onRename}
        onContextMenu={(event) => {
          event.preventDefault();
          onRename();
        }}
        title="Double-click to rename"
        className="min-w-0 flex-1 truncate px-1 text-left text-sm"
      >
        {conversation.title}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
        aria-label={`Delete ${conversation.title}`}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function SuggestionChip({ suggestion, disabled, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="rounded-full border border-border/70 bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-fuchsia-300/40 hover:bg-surface-1 hover:text-white disabled:pointer-events-none disabled:opacity-60"
    >
      {suggestion.label}
    </button>
  );
}

function DeleteConversationDialog({
  conversation,
  dialogRef,
  deleteButtonRef,
  onCancel,
  onConfirm,
}) {
  return (
    <AnimatePresence>
      {conversation ? (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-background/70 px-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          onMouseDown={onCancel}
          aria-hidden={false}
        >
          <motion.div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-conversation-title"
            aria-describedby="delete-conversation-description"
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl border border-fuchsia-300/15 bg-surface-1 p-5 text-foreground shadow-2xl shadow-black/45 outline-none"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-destructive/12 text-destructive">
                <Trash2 className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2
                  id="delete-conversation-title"
                  className="text-lg font-semibold tracking-normal text-white"
                >
                  Delete Conversation
                </h2>
                <p className="mt-1 text-sm font-medium text-fuchsia-100/80">
                  Delete
                </p>
              </div>
            </div>

            <p className="mt-5 break-words rounded-xl border border-white/10 bg-background/40 px-4 py-3 text-base font-semibold text-white">
              &quot;{conversation.title}&quot;
            </p>
            <p
              id="delete-conversation-description"
              className="mt-3 text-sm text-muted-foreground"
            >
              This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-2 hover:text-white"
              >
                Cancel
              </button>
              <button
                ref={deleteButtonRef}
                type="button"
                onClick={onConfirm}
                className="rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground shadow-lg shadow-destructive/20 transition-all hover:brightness-110 active:scale-[0.98]"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function WelcomePrompt() {
  return (
    <div className="mx-auto flex min-h-[18rem] w-full max-w-xl flex-col items-center justify-center text-center">
      <p className="text-sm font-semibold tracking-[0.08em] text-muted-foreground">
        ✨ Strategy AI
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-normal text-white">
        How can I help you today?
      </h2>
    </div>
  );
}

function ChatMessage({ message, copied, onCopy, onRetry, onRegenerate, onShare, onDelete }) {
  const isUser = message.role === "user";

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn("flex gap-3 md:gap-4", isUser && "justify-end")}
    >
      {!isUser ? (
        <div className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-fuchsia-300/10 text-fuchsia-200">
          {message.isError ? <AlertTriangle className="size-4" /> : <Bot className="size-4" />}
        </div>
      ) : null}

      <div
        className={cn(
          "group max-w-[min(48rem,100%)] space-y-3 text-sm leading-7",
          isUser
            ? "rounded-[1.35rem] bg-fuchsia-500/20 px-4 py-3 text-white md:max-w-[72%]"
            : message.isError
              ? "rounded-xl bg-destructive/10 px-4 py-3 text-destructive"
              : "px-1 py-1 text-muted-foreground"
        )}
      >
        {isUser ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
              <UserRound className="size-3.5" />
              You
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" />
              {formatMessageTime(message.createdAt)}
            </div>
          </div>
        ) : null}

        <MarkdownContent content={message.content} isError={message.isError} />

        {!isUser ? (
          <div className="flex items-center gap-1 pt-1 opacity-70 transition-opacity hover:opacity-100 md:opacity-0 md:group-hover:opacity-70">
            {message.isError ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-white"
                aria-label="Retry response"
              >
                <RefreshCcw className="size-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onRegenerate}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-white"
                aria-label="Regenerate response"
              >
                <RefreshCcw className="size-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onCopy}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-white"
              aria-label="Copy response"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={onShare}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-white"
              aria-label="Share conversation"
            >
              <Share2 className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete conversation"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      {isUser ? (
        <div className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-surface-1 text-white">
          <UserRound className="size-4" />
        </div>
      ) : null}
    </motion.article>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-4">
      <div className="grid size-7 shrink-0 place-items-center rounded-full bg-fuchsia-300/10 text-fuchsia-200">
        <Bot className="size-4" />
      </div>
      <div className="space-y-2 px-1 py-1 text-sm text-muted-foreground">
        <p>Thinking...</p>
      </div>
    </div>
  );
}

function MarkdownContent({ content, isError = false }) {
  const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);

  return (
    <div
      className={cn(
        "space-y-4 text-[0.95rem] leading-7",
        isError ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {blocks.map((block, index) => (
        <MarkdownBlock key={`${block.type}-${index}`} block={block} isError={isError} />
      ))}
    </div>
  );
}

function MarkdownBlock({ block, isError }) {
  if (block.type === "heading") {
    const Tag = block.level === 1 ? "h2" : block.level === 2 ? "h3" : "h4";
    return (
      <Tag
        className={cn(
          "pt-2 font-semibold text-white",
          block.level === 1 && "text-xl leading-8",
          block.level === 2 && "text-lg leading-7",
          block.level >= 3 && "text-base leading-7"
        )}
      >
        {renderInlineMarkdown(block.text)}
      </Tag>
    );
  }

  if (block.type === "code") {
    return (
      <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/35 p-4 font-mono text-xs leading-6 text-fuchsia-100">
        {block.language ? (
          <div className="-mx-4 -mt-4 mb-3 border-b border-white/10 px-4 py-2 text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground">
            {block.language}
          </div>
        ) : null}
        <code>{renderCodeWithLightSyntax(block.code)}</code>
      </pre>
    );
  }

  if (block.type === "quote") {
    return (
      <blockquote className="rounded-r-xl border-l-2 border-fuchsia-300/60 bg-white/[0.035] px-4 py-3 italic text-muted-foreground">
        {renderInlineMarkdown(block.text)}
      </blockquote>
    );
  }

  if (block.type === "hr") {
    return <hr className="border-border" />;
  }

  if (block.type === "ul" || block.type === "ol" || block.type === "tasks") {
    return <NestedList block={block} ordered={block.type === "ol"} />;
  }

  if (block.type === "table") {
    return (
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`${row.join("-")}-${rowIndex}`} className="border-b border-white/10 last:border-b-0">
                {row.map((cell, cellIndex) => {
                  const Cell = rowIndex === 0 ? "th" : "td";
                  return (
                    <Cell
                      key={`${cell}-${cellIndex}`}
                      className={cn(
                        "px-3 py-2 align-top",
                        rowIndex === 0 ? "bg-white/[0.04] font-semibold text-white" : "text-muted-foreground"
                      )}
                    >
                      {renderInlineMarkdown(cell)}
                    </Cell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === "callout") {
    return (
      <div className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-300/10 px-4 py-3 text-fuchsia-100">
        {renderInlineMarkdown(block.text)}
      </div>
    );
  }

  return (
    <p className={cn("whitespace-pre-line", isError ? "text-destructive" : "text-muted-foreground")}>
      {renderInlineMarkdown(block.text)}
    </p>
  );
}

function NestedList({ block, ordered }) {
  const ListTag = ordered ? "ol" : "ul";

  return (
    <ListTag className={cn("space-y-2 pl-5", ordered ? "list-decimal" : "list-disc")}>
      {block.items.map((item, index) => (
        <li key={`${item.text}-${index}`} className="pl-1">
          <span className="inline-flex items-start gap-2">
            {block.type === "tasks" ? (
              item.checked ? (
                <CheckSquare className="mt-1 size-4 shrink-0 text-fuchsia-200" />
              ) : (
                <Square className="mt-1 size-4 shrink-0 text-muted-foreground" />
              )
            ) : null}
            <span>{renderInlineMarkdown(item.text)}</span>
          </span>
          {item.children?.length ? (
            <ul className="mt-2 space-y-2 pl-5">
              {item.children.map((child, childIndex) => (
                <li key={`${child.text}-${childIndex}`} className="list-disc pl-1">
                  {renderInlineMarkdown(child.text)}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ListTag>
  );
}

function parseMarkdownBlocks(content) {
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.replace(/^```/, "").trim();
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "code", language, code: code.join("\n") });
      index += 1;
      continue;
    }

    if (/^#{1,4}\s+/.test(trimmed)) {
      const [, marks, text] = trimmed.match(/^(#{1,4})\s+(.*)$/);
      blocks.push({ type: "heading", level: marks.length, text });
      index += 1;
      continue;
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quote.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", text: quote.join("\n") });
      continue;
    }

    if (/^(note|tip|important|warning):/i.test(trimmed)) {
      blocks.push({ type: "callout", text: trimmed });
      index += 1;
      continue;
    }

    if (/^\|.*\|$/.test(trimmed)) {
      const tableLines = [];
      while (index < lines.length && /^\|.*\|$/.test(lines[index].trim())) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      const rows = tableLines
        .filter((row) => !/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(row))
        .map((row) =>
          row
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((cell) => cell.trim())
        );
      blocks.push({ type: "table", rows });
      continue;
    }

    if (isListLine(line)) {
      const { block, nextIndex } = parseListBlock(lines, index);
      blocks.push(block);
      index = nextIndex;
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !isSpecialMarkdownLine(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join("\n") });
  }

  return blocks;
}

function parseListBlock(lines, startIndex) {
  const first = parseListLine(lines[startIndex]);
  const type = first.task ? "tasks" : first.ordered ? "ol" : "ul";
  const items = [];
  let index = startIndex;

  while (index < lines.length) {
    const parsed = parseListLine(lines[index]);
    if (!parsed || parsed.type !== first.type) break;

    if (parsed.indent > first.indent && items.length) {
      items[items.length - 1].children.push({
        text: parsed.text,
        checked: parsed.checked,
      });
    } else {
      items.push({
        text: parsed.text,
        checked: parsed.checked,
        children: [],
      });
    }
    index += 1;
  }

  return { block: { type, items }, nextIndex: index };
}

function isListLine(line) {
  return Boolean(parseListLine(line));
}

function parseListLine(line) {
  const taskMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.*)$/);
  if (taskMatch) {
    return {
      type: "task",
      task: true,
      ordered: false,
      indent: taskMatch[1].length,
      checked: taskMatch[2].toLowerCase() === "x",
      text: taskMatch[3],
    };
  }

  const unorderedMatch = line.match(/^(\s*)[-*\u2022]\s+(.*)$/);
  if (unorderedMatch) {
    return {
      type: "ul",
      task: false,
      ordered: false,
      indent: unorderedMatch[1].length,
      text: unorderedMatch[2],
    };
  }

  const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
  if (orderedMatch) {
    return {
      type: "ol",
      task: false,
      ordered: true,
      indent: orderedMatch[1].length,
      text: orderedMatch[2],
    };
  }

  return null;
}

function isSpecialMarkdownLine(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("```") ||
    /^#{1,4}\s+/.test(trimmed) ||
    /^[-*_]{3,}$/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    isListLine(line) ||
    /^\|.*\|$/.test(trimmed) ||
    /^(note|tip|important|warning):/i.test(trimmed)
  );
}

function renderInlineMarkdown(text) {
  const parts = String(text).split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*)/g);

  return parts.map((part, index) => {
    if (!part) return null;

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={`${part}-${index}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-fuchsia-200 underline underline-offset-4 hover:text-white"
        >
          {linkMatch[1]}
        </a>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={`${part}-${index}`}
          className="rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[0.85em] text-fuchsia-100"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("***") && part.endsWith("***")) {
      return (
        <strong key={`${part}-${index}`} className="font-semibold italic text-white">
          {part.slice(3, -3)}
        </strong>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${part}-${index}`} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return (
        <em key={`${part}-${index}`} className="italic text-foreground">
          {part.slice(1, -1)}
        </em>
      );
    }

    return part;
  });
}

function renderCodeWithLightSyntax(code) {
  const keywordPattern =
    /\b(const|let|var|function|return|if|else|for|while|async|await|import|export|from|class|new|try|catch|throw|true|false|null|undefined)\b/;

  return String(code)
    .split(/(\b(?:const|let|var|function|return|if|else|for|while|async|await|import|export|from|class|new|try|catch|throw|true|false|null|undefined)\b)/g)
    .map((part, index) =>
      keywordPattern.test(part) ? (
        <span key={`${part}-${index}`} className="text-cyan-200">
          {part}
        </span>
      ) : (
        part
      )
    );
}

function createConversation() {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title: "New chat",
    messages: [{ ...welcomeMessage, createdAt: now }],
    lastUserPrompt: "",
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeConversation(conversation) {
  if (!conversation?.id) return null;
  const now = new Date().toISOString();
  const messages = Array.isArray(conversation.messages)
    ? conversation.messages.map(normalizeMessage).filter(Boolean)
    : [{ ...welcomeMessage, createdAt: now }];

  return {
    id: conversation.id,
    title: normalizeConversationTitle(conversation.title, messages),
    messages,
    lastUserPrompt: conversation.lastUserPrompt || "",
    createdAt: conversation.createdAt || now,
    updatedAt: conversation.updatedAt || conversation.createdAt || now,
  };
}

function normalizeMessage(message) {
  if (!message?.role) return null;
  if (!message.content && message.role !== "assistant") return null;
  return {
    id: message.id || createId(),
    role: message.role,
    content: message.content || "",
    isError: Boolean(message.isError),
    createdAt: message.createdAt || new Date().toISOString(),
  };
}

function sortConversations(items) {
  return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function isUntitledConversation(conversation) {
  return !conversation.title || conversation.title === "New chat";
}

function normalizeConversationTitle(title, messages) {
  const currentTitle = title?.trim() || "New chat";
  const firstPrompt = messages.find((message) => message.role === "user")?.content || "";

  if (!firstPrompt) return currentTitle;
  if (currentTitle === "New chat" || looksLikeCopiedPrompt(currentTitle)) {
    return generateConversationTitle(firstPrompt);
  }

  return currentTitle;
}

function looksLikeCopiedPrompt(title) {
  const normalized = title.trim();
  const lower = normalized.toLowerCase();

  return (
    normalized.length > 42 ||
    /[?]$/.test(normalized) ||
    /^(hey|hi|give|tell|explain|create|teach|improve|prepare|make|can|what|which|how)\b/.test(lower)
  );
}

function generateConversationTitle(prompt) {
  const normalized = prompt
    .replace(/\s+/g, " ")
    .replace(/[^\w\s.,!?/-]/g, "")
    .trim();
  const lower = normalized.toLowerCase();

  if (!normalized) return "New chat";

  if (/\bui\s*\/?\s*ux\b/.test(lower) && /(interview|roadmap|prepare|prep)/.test(lower)) {
    return "UI/UX Interview Prep";
  }

  if (/\bci\s*\/?\s*cd\b/.test(lower)) {
    return "CI/CD Pipeline";
  }

  if (/\bgoogle\b/.test(lower) && /\bresume\b/.test(lower)) {
    return "Google Resume Review";
  }

  if (/\bmern\b/.test(lower) && /(roadmap|learn|learning|plan)/.test(lower)) {
    return "MERN Learning Roadmap";
  }

  if (/\bsystem\s+design\b/.test(lower)) {
    return "System Design Basics";
  }

  if (/\breact\b/.test(lower) && /(interview|prepare|prep)/.test(lower)) {
    return "React Interview Prep";
  }

  if (/\bresume\b/.test(lower) && /(improve|review|fix|update|optimize)/.test(lower)) {
    const subject = pickMeaningfulWords(normalized, 2).join(" ");
    return titleCaseWords(`${subject} Resume Review`.trim());
  }

  if (/(roadmap|plan|schedule|timetable)/.test(lower)) {
    const subject = pickMeaningfulWords(normalized, 3).join(" ");
    return titleCaseWords(`${subject} Roadmap`.trim());
  }

  if (/(interview|prepare|prep)/.test(lower)) {
    const subject = pickMeaningfulWords(normalized, 3).join(" ");
    return titleCaseWords(`${subject} Interview Prep`.trim());
  }

  const compact = pickMeaningfulWords(normalized, 6);
  if (compact.length < 3) compact.push("Overview");
  return titleCaseWords(compact.slice(0, 6).join(" "));
}

function pickMeaningfulWords(text, limit) {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "ask",
    "can",
    "create",
    "detail",
    "explain",
    "for",
    "give",
    "hey",
    "how",
    "improve",
    "industry",
    "industries",
    "in",
    "is",
    "it",
    "me",
    "my",
    "of",
    "prepare",
    "tell",
    "the",
    "this",
    "timetable",
    "to",
    "used",
    "week",
    "what",
    "which",
    "with",
  ]);

  return text
    .split(/\s+/)
    .map((word) => word.replace(/^[^\w/]+|[^\w/]+$/g, ""))
    .filter(Boolean)
    .filter((word) => !stopWords.has(word.toLowerCase()))
    .slice(0, limit);
}

function titleCaseWords(text) {
  const smallWords = new Set(["in", "for", "and", "of"]);

  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (/^(ai|api|ats|ci\/cd|ui\/ux)$/i.test(word)) return word.toUpperCase();
      if (/^[A-Z0-9]{2,6}$/.test(word)) return word;
      if (index > 0 && smallWords.has(lower)) return lower;
      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

function getConversationPreview(conversation) {
  const lastMeaningful = [...(conversation.messages || [])]
    .reverse()
    .find((message) => message.id !== "welcome" && message.content?.trim());

  return lastMeaningful?.content || "Start a new AI strategy conversation.";
}

function formatConversation(conversation) {
  const lines = [`# ${conversation.title}`, ""];
  conversation.messages
    .filter((message) => message.id !== "welcome" && message.content?.trim())
    .forEach((message) => {
      lines.push(`## ${message.role === "user" ? "You" : "Strategy AI"}`);
      lines.push("");
      lines.push(message.content);
      lines.push("");
    });

  return lines.join("\n");
}

function formatMessageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
