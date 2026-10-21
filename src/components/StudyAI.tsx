import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Paperclip,
  X,
  Copy,
  Check,
  RotateCcw,
  BookOpen,
  Code2,
  Calculator,
  Cpu,
  GraduationCap,
  FileText,
  AlertCircle,
  Square,
  FileUp,
  Image as ImageIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import mammoth from 'mammoth';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  attachment?: {
    name: string;
    mimeType: string;
    size: string;
  };
}

interface PendingAttachment {
  file: File;
  name: string;
  size: string;
  mimeType: string;
  data: string; // base64 or text
  textContent?: string;
}

export const StudyAI: React.FC = () => {
  const { currentUser, activeTenant } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isTeacher = currentUser?.role === 'teacher';
  const isStudent = currentUser?.role === 'student';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!currentUser || (!isTeacher && !isStudent)) {
    return (
      <div className="p-8 text-center text-slate-400">
        <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
        <h2 className="text-base font-semibold text-white">Access Restricted</h2>
        <p className="text-xs mt-1">Study AI is reserved exclusively for students and educators.</p>
      </div>
    );
  }

  const quickPrompts = [
    {
      title: 'Operating Systems & Deadlocks',
      prompt: 'Explain Banker\'s Algorithm and the four necessary conditions for deadlocks in operating systems with examples.',
      icon: Cpu,
    },
    {
      title: 'Data Structures & Algorithms',
      prompt: 'Provide a step-by-step explanation and TypeScript/C++ implementation of Dijkstra\'s Shortest Path algorithm with time complexity.',
      icon: Code2,
    },
    {
      title: 'Calculus & Engineering Math',
      prompt: 'How do I solve second-order linear differential equations with constant coefficients? Walk me through an example step by step.',
      icon: Calculator,
    },
    {
      title: 'Exam Revision & Study Plan',
      prompt: 'Create a structured 7-day revision schedule and key practice questions for a university database systems mid-term examination.',
      icon: GraduationCap,
    },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadWarning(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      setUploadWarning('File size exceeds the 20MB maximum limit.');
      return;
    }

    const mime = file.type;
    const name = file.name;
    const sizeStr = (file.size / 1024).toFixed(1) + ' KB';

    try {
      if (mime.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setPendingAttachment({
            file,
            name,
            size: sizeStr,
            mimeType: mime,
            data: reader.result as string,
          });
        };
        reader.readAsDataURL(file);
      } else if (mime === 'application/pdf' || name.endsWith('.pdf')) {
        const reader = new FileReader();
        reader.onload = () => {
          setPendingAttachment({
            file,
            name,
            size: sizeStr,
            mimeType: 'application/pdf',
            data: reader.result as string,
          });
        };
        reader.readAsDataURL(file);
      } else if (
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        name.endsWith('.docx')
      ) {
        // DOCX extraction using mammoth
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const extractedText = result.value || '';
        if (!extractedText.trim()) {
          setUploadWarning('Could not extract text from this DOCX. It may contain scanned images or unsupported formatting.');
        }
        setPendingAttachment({
          file,
          name,
          size: sizeStr,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          data: extractedText,
          textContent: extractedText,
        });
      } else if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
        const text = await file.text();
        setPendingAttachment({
          file,
          name,
          size: sizeStr,
          mimeType: 'text/plain',
          data: text,
          textContent: text,
        });
      } else {
        setUploadWarning('Unsupported format. Please upload PDF, Word (DOCX), TXT, or images (PNG/JPEG/WEBP).');
      }
    } catch (err: any) {
      setUploadWarning(`Failed to read file: ${err.message}`);
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText;
    if (!textToSend.trim() && !pendingAttachment) return;

    setErrorMessage(null);
    const userMsgId = 'msg-' + Date.now();
    const userTurn: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachment: pendingAttachment
        ? {
            name: pendingAttachment.name,
            size: pendingAttachment.size,
            mimeType: pendingAttachment.mimeType,
          }
        : undefined,
    };

    const updatedMessages = [...messages, userTurn];
    setMessages(updatedMessages);
    setInputText('');

    const attachmentPayload = pendingAttachment
      ? {
          name: pendingAttachment.name,
          mimeType: pendingAttachment.mimeType,
          data: pendingAttachment.data,
          textContent: pendingAttachment.textContent,
        }
      : undefined;

    setPendingAttachment(null);
    setLoading(true);

    try {
      const historyTurns = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.askStudyAI(
        activeTenant?.databaseName || '',
        textToSend.trim(),
        historyTurns,
        attachmentPayload
      );

      if (!res.success) {
        setErrorMessage(res.message || 'Unable to connect to Study AI. Please check your network or server configuration.');
        return;
      }

      const modelTurn: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        role: 'model',
        content: res.text || 'No response returned from the model.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages([...updatedMessages, modelTurn]);
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred while communicating with Study AI.');
    } finally {
      setLoading(false);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoading(false);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleNewChat = () => {
    setMessages([]);
    setInputText('');
    setPendingAttachment(null);
    setErrorMessage(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] max-h-[860px] rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden shadow-2xl backdrop-blur-xl">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center shadow-md shadow-purple-600/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white font-display">Study AI</h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {isTeacher ? 'Faculty Teaching Assistant' : 'Academic Learning Coach'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Interactive conceptual tutor, step-by-step problem solver, and notes generator.
            </p>
          </div>
        </div>

        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-xl transition-all cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center max-w-2xl mx-auto text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center mb-4 shadow-lg shadow-purple-500/10">
              <BookOpen className="w-7 h-7 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-white font-display mb-1.5">
              Welcome to Study AI, {currentUser.fullName.split(' ')[0]}
            </h2>
            <p className="text-xs text-slate-400 max-w-md mb-8 leading-relaxed">
              Ask any academic questions across Computer Engineering, Mathematics, Programming, Science, or exam prep. You can also attach lecture slides, notes, or assignment rubrics.
            </p>

            {/* Quick Prompt Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
              {quickPrompts.map((qp, idx) => {
                const IconComponent = qp.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSend(qp.prompt)}
                    className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-purple-500/40 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:text-pink-300 transition-colors">
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-white group-hover:text-purple-300 transition-colors">
                        {qp.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{qp.prompt}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                    isUser
                      ? 'bg-gradient-to-tr from-purple-600 to-pink-600 text-white'
                      : 'bg-white/10 text-purple-300 border border-purple-500/30'
                  }`}
                >
                  {isUser ? currentUser.fullName.charAt(0).toUpperCase() : <Sparkles className="w-3.5 h-3.5" />}
                </div>

                {/* Content Bubble */}
                <div className="space-y-1 max-w-[85%]">
                  <div
                    className={`p-4 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? 'bg-purple-600/90 text-white rounded-tr-xs shadow-md shadow-purple-600/20'
                        : 'bg-white/[0.04] border border-white/10 text-slate-200 rounded-tl-xs whitespace-pre-wrap font-sans'
                    }`}
                  >
                    {/* Attachment preview if user uploaded one */}
                    {msg.attachment && (
                      <div className="mb-2.5 p-2 rounded-lg bg-black/30 border border-white/10 flex items-center gap-2 text-[11px]">
                        <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="truncate font-mono">{msg.attachment.name}</span>
                        <span className="text-slate-400 text-[10px] shrink-0">({msg.attachment.size})</span>
                      </div>
                    )}

                    <div>{msg.content}</div>
                  </div>

                  {/* Actions & Timestamp */}
                  <div
                    className={`flex items-center gap-2 px-1 text-[10px] text-slate-500 ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    {!isUser && (
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Copy answer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Loading Bubble */}
        {loading && (
          <div className="flex gap-3 max-w-xl mr-auto">
            <div className="w-7 h-7 rounded-xl bg-white/10 text-purple-300 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-slate-400 rounded-tl-xs flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse delay-100" />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse delay-200" />
              </div>
              <span>Formulating solution...</span>
              <button
                onClick={handleStopGeneration}
                className="ml-3 px-2 py-0.5 text-[10px] text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md border border-white/10 cursor-pointer flex items-center gap-1"
              >
                <Square className="w-2.5 h-2.5" />
                <span>Stop</span>
              </button>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 max-w-2xl mx-auto">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Unable to process Study AI request</p>
              <p className="mt-0.5 text-[11px] opacity-90">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-white text-xs cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/10 bg-white/[0.02] space-y-2">
        {/* Pending Attachment preview */}
        {pendingAttachment && (
          <div className="flex items-center justify-between p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs text-purple-200">
            <div className="flex items-center gap-2 truncate">
              {pendingAttachment.mimeType.startsWith('image/') ? (
                <ImageIcon className="w-4 h-4 text-purple-400 shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-purple-400 shrink-0" />
              )}
              <span className="truncate font-mono">{pendingAttachment.name}</span>
              <span className="text-[10px] text-purple-400">({pendingAttachment.size})</span>
            </div>
            <button
              onClick={() => setPendingAttachment(null)}
              className="text-purple-300 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {uploadWarning && (
          <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
            <span>{uploadWarning}</span>
            <button onClick={() => setUploadWarning(null)} className="text-amber-300 hover:text-white p-1">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* File Attachment Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach PDF, Word (DOCX), TXT, or Image"
            className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer shrink-0"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              pendingAttachment
                ? `Ask a question about "${pendingAttachment.name}"...`
                : 'Ask Study AI a question (e.g., Explain Virtual Memory, solve a proof, or create a revision quiz)...'
            }
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            disabled={loading}
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={loading || (!inputText.trim() && !pendingAttachment)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 transition-all"
          >
            <span>Ask</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Legal & Academic Disclaimer */}
        <p className="text-[10px] text-slate-500 text-center">
          Study AI provides conceptual tutoring and study guidance. Official grades, transcripts, and attendance are recorded in institutional databases.
        </p>
      </div>
    </div>
  );
};
