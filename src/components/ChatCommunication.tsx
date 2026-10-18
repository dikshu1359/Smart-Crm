import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Search,
  Check,
  CheckCheck,
  Phone,
  Video,
  PhoneOff,
  PhoneIncoming,
  Mic,
  MicOff,
  VideoOff,
  Paperclip,
  FileText,
  X,
  RefreshCw,
  ScreenShare,
  AlertCircle,
  Clock,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ChatContact, ChatMessage } from '../types/crm';
import api from '../services/api';

interface ActiveCallState {
  callId: string;
  type: 'audio' | 'video';
  status: 'calling' | 'connected' | 'ended';
  duration: number; // in seconds
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  targetUser: {
    id: string;
    fullName: string;
    role: string;
    email?: string;
  };
  isCaller: boolean;
}

interface IncomingCallState {
  callId: string;
  callerId: string;
  callerName: string;
  callerRole: string;
  type: 'audio' | 'video';
  databaseName: string;
}

export const ChatCommunication: React.FC = () => {
  const {
    activeTenant,
    currentUser,
    chatContacts,
    selectedChatContactId,
    setSelectedChatContactId,
    refreshData,
  } = useApp();

  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: string;
    mimeType: string;
    dataUrl: string;
  } | null>(null);

  // Calling States
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null);
  const [callNotificationError, setCallNotificationError] = useState<string | null>(null);

  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localMediaStreamRef = useRef<MediaStream | null>(null);

  // Audio tone generator for incoming / outgoing ring
  const playRingtoneTick = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(480, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio autoplay policy handled gracefully
    }
  }, []);

  const startRingtone = useCallback(() => {
    if (ringtoneIntervalRef.current) return;
    playRingtoneTick();
    ringtoneIntervalRef.current = setInterval(playRingtoneTick, 2400);
  }, [playRingtoneTick]);

  const stopRingtone = useCallback(() => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
  }, []);

  // Sync with selectedChatContactId from AppContext
  useEffect(() => {
    if (selectedChatContactId && chatContacts.length > 0) {
      const match = chatContacts.find((c) => c.id === selectedChatContactId);
      if (match && match.id !== selectedContact?.id) {
        setMessages([]);
        setSelectedContact(match);
      }
    } else if (!selectedContact && chatContacts.length > 0) {
      const unreadMatch = chatContacts.find((c) => (c.unreadCount || 0) > 0);
      if (unreadMatch) {
        setMessages([]);
        setSelectedContact(unreadMatch);
      } else if (chatContacts[0]) {
        setSelectedContact(chatContacts[0]);
      }
    }
  }, [selectedChatContactId, chatContacts, selectedContact]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch conversation messages
  const fetchMessages = useCallback(async () => {
    if (!activeTenant || !selectedContact?.id) return;
    try {
      const res = await api.getChatMessages(activeTenant.databaseName, selectedContact.id);
      if (res?.messages && Array.isArray(res.messages)) {
        setMessages(res.messages);
      }
    } catch (err) {
      console.warn('Failed to fetch chat messages:', err);
    }
  }, [activeTenant, selectedContact?.id]);

  // Periodic message polling
  useEffect(() => {
    if (!activeTenant || !selectedContact?.id) return;

    fetchMessages();
    const interval = setInterval(fetchMessages, 2500);
    return () => clearInterval(interval);
  }, [activeTenant, selectedContact?.id, fetchMessages]);

  // -------------------------------------------------------------
  // CALL SIGNALING & ACTIVE CALL POLLING
  // -------------------------------------------------------------
  const pollActiveCall = useCallback(async () => {
    if (!activeTenant || !currentUser) return;
    try {
      const res = await api.getActiveCall(activeTenant.databaseName);
      const currentCall = res?.call;
      const currentUserId = String(currentUser.id || (currentUser as any)._id);

      if (currentCall) {
        const isRecipient = String(currentCall.recipientId) === currentUserId;
        const isCaller = String(currentCall.callerId) === currentUserId;

        // Incoming call for current user
        if (isRecipient && currentCall.status === 'ringing') {
          if (!activeCall) {
            setIncomingCall({
              callId: currentCall.callId,
              callerId: currentCall.callerId,
              callerName: currentCall.callerName,
              callerRole: currentCall.callerRole,
              type: currentCall.type || 'audio',
              databaseName: currentCall.databaseName,
            });
            startRingtone();
          }
        }

        // Outgoing call answered by recipient
        if (isCaller && activeCall && activeCall.status === 'calling' && currentCall.status === 'connected') {
          stopRingtone();
          setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));
        }

        // Remote user declined or ended
        if (
          (isCaller || isRecipient) &&
          activeCall &&
          (currentCall.status === 'declined' || currentCall.status === 'ended')
        ) {
          stopRingtone();
          setActiveCall((prev) =>
            prev ? { ...prev, status: 'ended' } : null
          );
          setTimeout(() => {
            setActiveCall(null);
            stopMediaTracks();
          }, 1500);
        }
      } else {
        // No active call on server
        if (incomingCall) {
          setIncomingCall(null);
          stopRingtone();
        }
        if (activeCall && activeCall.status === 'connected') {
          setActiveCall((prev) => (prev ? { ...prev, status: 'ended' } : null));
          stopRingtone();
          setTimeout(() => {
            setActiveCall(null);
            stopMediaTracks();
          }, 1500);
        }
      }
    } catch {
      // Ignore transient polling drops
    }
  }, [activeTenant, currentUser, activeCall, incomingCall, startRingtone, stopRingtone]);

  useEffect(() => {
    if (!activeTenant || !currentUser) return;
    const callInterval = setInterval(pollActiveCall, 1800);
    return () => clearInterval(callInterval);
  }, [activeTenant, currentUser, pollActiveCall]);

  // Duration timer for connected call
  useEffect(() => {
    if (activeCall?.status === 'connected') {
      stopRingtone();
      callTimerRef.current = setInterval(() => {
        setActiveCall((prev) => (prev ? { ...prev, duration: prev.duration + 1 } : null));
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [activeCall?.status, stopRingtone]);

  // Request browser webcam when camera is enabled in video call
  useEffect(() => {
    if (activeCall?.type === 'video' && activeCall.isCameraOn && activeCall.status === 'connected') {
      navigator.mediaDevices
        ?.getUserMedia({ video: true, audio: false })
        .then((stream) => {
          localMediaStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(() => {});
          }
        })
        .catch(() => {
          // Gracefully handles denied permissions in iframe/sandbox
        });
    } else {
      stopMediaTracks();
    }
  }, [activeCall?.type, activeCall?.isCameraOn, activeCall?.status]);

  const stopMediaTracks = () => {
    if (localMediaStreamRef.current) {
      localMediaStreamRef.current.getTracks().forEach((track) => track.stop());
      localMediaStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  };

  // -------------------------------------------------------------
  // CALL ACTIONS
  // -------------------------------------------------------------
  const startCall = async (type: 'audio' | 'video') => {
    if (!selectedContact || !activeTenant || !currentUser) return;

    setCallNotificationError(null);

    // Role-based validation
    if (currentUser.role === 'student' && selectedContact.role !== 'teacher') {
      setCallNotificationError('Students are only authorized to place calls to assigned faculty teachers.');
      return;
    }

    try {
      const res = await api.initiateCall(activeTenant.databaseName, {
        recipientId: selectedContact.id,
        callType: type,
      });

      if (!res.success || !res.call) {
        setCallNotificationError(res.message || 'Call initiation failed. Please try again.');
        return;
      }

      setActiveCall({
        callId: res.call.callId,
        type,
        status: 'calling',
        duration: 0,
        isMuted: false,
        isCameraOn: type === 'video',
        isScreenSharing: false,
        targetUser: {
          id: selectedContact.id,
          fullName: selectedContact.fullName,
          role: selectedContact.role,
          email: selectedContact.email,
        },
        isCaller: true,
      });

      startRingtone();
    } catch (err: any) {
      setCallNotificationError(err.message || 'Call initiation failed.');
    }
  };

  const handleAnswerCall = async () => {
    if (!incomingCall || !activeTenant) return;

    stopRingtone();
    try {
      const res = await api.respondCall(activeTenant.databaseName, incomingCall.callId, {
        action: 'answer',
      });

      if (res.success) {
        setActiveCall({
          callId: incomingCall.callId,
          type: incomingCall.type,
          status: 'connected',
          duration: 0,
          isMuted: false,
          isCameraOn: incomingCall.type === 'video',
          isScreenSharing: false,
          targetUser: {
            id: incomingCall.callerId,
            fullName: incomingCall.callerName,
            role: incomingCall.callerRole,
          },
          isCaller: false,
        });

        // Ensure recipient chat is switched to caller's conversation
        if (selectedContact?.id !== incomingCall.callerId) {
          const match = chatContacts.find((c) => c.id === incomingCall.callerId);
          if (match) setSelectedContact(match);
        }
      }
    } catch (err: any) {
      setCallNotificationError(err.message || 'Failed to answer incoming call.');
    } finally {
      setIncomingCall(null);
    }
  };

  const handleDeclineCall = async () => {
    if (!incomingCall || !activeTenant) return;
    stopRingtone();

    try {
      await api.respondCall(activeTenant.databaseName, incomingCall.callId, {
        action: 'decline',
      });
    } catch {
      // silent
    } finally {
      setIncomingCall(null);
    }
  };

  const endCall = async () => {
    stopRingtone();
    stopMediaTracks();

    if (!activeCall || !activeTenant) {
      setActiveCall(null);
      return;
    }

    const finalDuration = activeCall.duration;
    const finalType = activeCall.type;
    const targetUserId = activeCall.targetUser.id;

    setActiveCall((prev) => (prev ? { ...prev, status: 'ended' } : null));

    try {
      await api.endCall(activeTenant.databaseName, activeCall.callId);

      // Log call entry in message history if connected
      if (finalDuration > 0 || activeCall.status === 'connected') {
        const minutes = Math.floor(finalDuration / 60);
        const seconds = finalDuration % 60;
        const durationStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        const callLogText = `${finalType === 'video' ? '📹 Video Call' : '📞 Audio Call'} ended • ${durationStr}`;

        const res = await api.sendChatMessage(activeTenant.databaseName, targetUserId, {
          text: callLogText,
          content: callLogText,
          callData: {
            type: finalType,
            duration: finalDuration,
            status: 'completed',
            timestamp: new Date().toISOString(),
          },
        });

        if (res.success && res.message) {
          setMessages((prev) => [...prev, res.message]);
        }
      }
    } catch {
      // silent
    }

    setTimeout(() => {
      setActiveCall(null);
    }, 1200);
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // -------------------------------------------------------------
  // MESSAGING SYSTEM
  // -------------------------------------------------------------
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSendError(null);
    const cleanText = inputText.trim();
    if ((!cleanText && !selectedFile) || !selectedContact || !activeTenant || sending) return;

    setSending(true);
    const textToSend = cleanText;
    const fileToSend = selectedFile;

    setInputText('');
    setSelectedFile(null);

    try {
      const attachments = fileToSend
        ? [
            {
              id: `att-${Date.now()}`,
              name: fileToSend.name,
              size: fileToSend.size,
              mimeType: fileToSend.mimeType,
              dataUrl: fileToSend.dataUrl,
            },
          ]
        : [];

      const res = await api.sendChatMessage(activeTenant.databaseName, selectedContact.id, {
        text: textToSend,
        content: textToSend,
        message: textToSend,
        attachments,
      });

      if (res.success && res.message && typeof res.message === 'object') {
        setMessages((prev) => {
          const exists = prev.some((m) => String(m.id || m._id) === String(res.message.id || res.message._id));
          return exists ? prev : [...prev, res.message];
        });
        refreshData();
      } else {
        // Show clear error message and restore input text so user does not lose draft
        setSendError(res.message || 'Failed to deliver message. Please retry.');
        setInputText(textToSend);
        setSelectedFile(fileToSend);
      }
    } catch (err: any) {
      setSendError(err.message || 'Network failure while sending message.');
      setInputText(textToSend);
      setSelectedFile(fileToSend);
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        mimeType: file.type || 'application/octet-stream',
        dataUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const filteredContacts = chatContacts.filter(
    (c) =>
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white font-display flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-purple-400" />
            <span>Institutional Communication &amp; Calling</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Encrypted messaging, direct audio, and HD video calling between authorized Faculty, Administrators, and Students.
          </p>
        </div>

        <button
          onClick={() => {
            fetchMessages();
            refreshData();
          }}
          className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
          <span>Sync Inbox</span>
        </button>
      </div>

      {/* Error Banners */}
      {callNotificationError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{callNotificationError}</span>
          </div>
          <button
            onClick={() => setCallNotificationError(null)}
            className="text-rose-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Split View */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[720px]">
        {/* Left: Contact Directory */}
        <div className="md:col-span-4 bg-[#141124] border border-white/10 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Directory Contacts ({filteredContacts.length})
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium">
                {currentUser?.role?.toUpperCase()} PORTAL
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search faculty, admins, or students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {filteredContacts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No authorized contacts found in this institution directory.
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const isSelected = selectedContact?.id === contact.id;
                return (
                  <button
                    key={contact.id}
                    onClick={() => {
                      setSelectedContact(contact);
                      setSelectedChatContactId(contact.id);
                    }}
                    className={`w-full p-3.5 flex items-center justify-between text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600/15 border-l-4 border-purple-500'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            contact.role === 'admin'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : contact.role === 'teacher'
                              ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                              : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          }`}
                        >
                          {contact.fullName.charAt(0).toUpperCase()}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#141124]" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{contact.fullName}</p>
                        <p className="text-[10px] text-slate-400 truncate capitalize">
                          {contact.role} &bull; {contact.specialization || contact.email}
                        </p>
                      </div>
                    </div>

                    {contact.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-pink-500 text-white font-bold text-[10px] flex items-center justify-center shadow-md shadow-pink-500/40 shrink-0">
                        {contact.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Active Chat Conversation */}
        <div className="md:col-span-8 bg-[#141124] border border-white/10 rounded-2xl flex flex-col overflow-hidden">
          {selectedContact ? (
            <>
              {/* Conversation Top Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/25">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        selectedContact.role === 'admin'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : selectedContact.role === 'teacher'
                          ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      }`}
                    >
                      {selectedContact.fullName.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#141124]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{selectedContact.fullName}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
                        Online
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 capitalize">
                      {selectedContact.role} &bull; {selectedContact.email}
                    </p>
                  </div>
                </div>

                {/* Direct Calling Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startCall('audio')}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/30 transition-all text-slate-300 cursor-pointer shadow-sm group"
                    title="Start Voice Call"
                  >
                    <Phone className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </button>
                  <button
                    onClick={() => startCall('video')}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-purple-500/20 hover:text-purple-400 border border-white/10 hover:border-purple-500/30 transition-all text-slate-300 cursor-pointer shadow-sm group"
                    title="Start HD Video Call"
                  >
                    <Video className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </button>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-6">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 mb-2">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-semibold text-slate-300">
                      No prior messages with {selectedContact.fullName}.
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                      Send a secure message or start an official audio/video call using the controls above.
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMine =
                      String(msg.senderId) === String(currentUser?.id) ||
                      String(msg.senderId) === String((currentUser as any)?._id);

                    const messageText =
                      msg.text || (msg as any).content || (msg as any).message || (msg as any).body || '';

                    const timeStr = msg.createdAt || msg.timestamp || new Date().toISOString();
                    const formattedTime = new Date(timeStr).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div key={msg.id || (msg as any)._id || idx} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                        {/* Message Bubble */}
                        <div
                          className={`max-w-[78%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                            isMine
                              ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 text-white rounded-br-none shadow-md shadow-purple-600/20'
                              : 'bg-white/10 text-slate-100 rounded-bl-none border border-white/10 shadow-sm'
                          }`}
                        >
                          {!isMine && (
                            <div className="text-[10px] font-bold text-purple-300 mb-1">
                              {msg.senderName || selectedContact.fullName}
                            </div>
                          )}

                          {/* Call Log Event */}
                          {msg.callData ? (
                            <div className="flex items-center gap-2.5 py-1 px-2 rounded-xl bg-black/30 border border-white/10">
                              {msg.callData.type === 'video' ? (
                                <Video className="w-4 h-4 text-pink-400 shrink-0" />
                              ) : (
                                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                              )}
                              <div>
                                <span className="font-semibold text-xs">
                                  {msg.callData.type === 'video' ? 'Video Conference' : 'Voice Call'}
                                </span>
                                <span className="text-[10px] text-slate-300 ml-1.5 font-mono">
                                  &bull; {formatDuration(msg.callData.duration)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{messageText}</p>
                          )}

                          {/* Attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2.5 space-y-1.5">
                              {msg.attachments.map((att: any, aIdx: number) => (
                                <div
                                  key={aIdx}
                                  className="p-2 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-2"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileText className="w-4 h-4 text-purple-300 shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium text-white truncate">{att.name}</p>
                                      <p className="text-[9px] text-slate-400">{att.size || 'Document'}</p>
                                    </div>
                                  </div>
                                  {att.dataUrl && (
                                    <a
                                      href={att.dataUrl}
                                      download={att.name}
                                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold transition-colors shrink-0"
                                    >
                                      Download
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Timestamp */}
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 px-1">
                          <span>{formattedTime}</span>
                          {isMine &&
                            (msg.read ? (
                              <CheckCheck className="w-3.5 h-3.5 text-pink-400" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-slate-500" />
                            ))}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Error on message sending */}
              {sendError && (
                <div className="px-4 py-2 bg-rose-950/40 border-t border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
                  <span>{sendError}</span>
                  <button onClick={() => setSendError(null)} className="text-rose-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Selected file preview chip */}
              {selectedFile && (
                <div className="px-4 py-2 bg-purple-950/40 border-t border-purple-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-purple-200">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold truncate max-w-sm">{selectedFile.name}</span>
                    <span className="text-[10px] text-purple-400 font-mono">({selectedFile.size})</span>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Composer */}
              <form
                onSubmit={handleSendMessage}
                className="p-3.5 border-t border-white/10 bg-black/40 flex items-center gap-2"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                  title="Attach file (PDF, Image, Document)"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  placeholder={`Write an official message to ${selectedContact.fullName}...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-black/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                />

                <button
                  type="submit"
                  disabled={sending || (!inputText.trim() && !selectedFile)}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-95 transition-all shadow-md shadow-purple-600/30 disabled:opacity-40 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-8">
              <div className="w-14 h-14 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-purple-400 mb-3 shadow-xl">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">Select a Conversation</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Choose an authorized faculty member, administrator, or enrolled student from the left directory to start messaging or make a direct audio/video call.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INCOMING CALL NOTIFICATION MODAL                                          */}
      {/* ========================================================================= */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in-95">
          <div className="w-full max-w-md bg-[#141124] border-2 border-emerald-500/40 rounded-3xl overflow-hidden shadow-2xl p-6 text-center space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-emerald-600/30 to-teal-600/30 border border-emerald-500/50 flex items-center justify-center text-white font-bold text-3xl shadow-2xl">
                  {incomingCall.callerName.charAt(0).toUpperCase()}
                </div>
                <span className="absolute -inset-2 rounded-3xl border border-emerald-500 animate-ping opacity-30 pointer-events-none" />
                <span className="absolute -inset-4 rounded-3xl border border-teal-400/40 animate-pulse pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
                <PhoneIncoming className="w-3.5 h-3.5 animate-bounce" />
                <span>Incoming {incomingCall.type === 'video' ? 'Video' : 'Voice'} Call</span>
              </div>
              <h2 className="text-xl font-bold text-white">{incomingCall.callerName}</h2>
              <p className="text-xs text-slate-400 capitalize mt-0.5">Role: {incomingCall.callerRole}</p>
            </div>

            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                onClick={handleDeclineCall}
                className="px-6 py-3 rounded-2xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 transition-all font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Decline</span>
              </button>
              <button
                onClick={handleAnswerCall}
                className="px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/40"
              >
                {incomingCall.type === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                <span>Accept Call</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ACTIVE CALL OVERLAY / MODAL                                              */}
      {/* ========================================================================= */}
      {activeCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in zoom-in-95">
          <div className="relative w-full max-w-xl bg-[#141124] border border-white/20 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            {/* Top Bar */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2">
                {activeCall.type === 'video' ? (
                  <Video className="w-4 h-4 text-pink-400" />
                ) : (
                  <Phone className="w-4 h-4 text-emerald-400" />
                )}
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {activeCall.type === 'video' ? 'Institutional Video Conference' : 'Institutional Voice Call'}
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-white">
                {activeCall.status === 'calling' ? (
                  <span className="text-amber-400 animate-pulse">Ringing...</span>
                ) : activeCall.status === 'connected' ? (
                  <span className="text-emerald-400">{formatDuration(activeCall.duration)}</span>
                ) : (
                  <span className="text-rose-400">Call Ended</span>
                )}
              </span>
            </div>

            {/* Video / Visual Stream Area */}
            <div className="relative h-80 bg-gradient-to-b from-black/80 to-[#1b1733] flex flex-col items-center justify-center p-6 overflow-hidden">
              {activeCall.type === 'video' && activeCall.status === 'connected' ? (
                <>
                  {/* Remote Simulated View */}
                  <div className="w-full h-full rounded-2xl bg-black/60 border border-white/10 flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="w-24 h-24 rounded-3xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-300 font-bold text-3xl mb-3 shadow-2xl">
                      {activeCall.targetUser.fullName.charAt(0).toUpperCase()}
                    </div>
                    <h3 className="text-base font-bold text-white">{activeCall.targetUser.fullName}</h3>
                    <p className="text-xs text-slate-400 capitalize">{activeCall.targetUser.role}</p>

                    {/* Live Voice Indicator Bars */}
                    <div className="flex items-center gap-1 mt-3">
                      <span className="w-1 h-3 bg-pink-500 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1 h-5 bg-purple-500 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1 h-7 bg-pink-400 rounded-full animate-bounce [animation-delay:300ms]" />
                      <span className="w-1 h-4 bg-purple-400 rounded-full animate-bounce [animation-delay:200ms]" />
                    </div>
                  </div>

                  {/* Local Video Picture-in-Picture Box */}
                  <div className="absolute bottom-4 right-4 w-32 h-24 rounded-xl bg-black/90 border border-purple-500/40 overflow-hidden shadow-xl flex items-center justify-center">
                    {activeCall.isCameraOn ? (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-[10px] text-slate-400 flex flex-col items-center gap-1">
                        <VideoOff className="w-4 h-4 text-slate-500" />
                        <span>Camera Off</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Audio Call UI */
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-4">
                    <div className="w-28 h-28 rounded-3xl bg-gradient-to-tr from-purple-600/30 to-pink-600/30 border border-purple-500/40 flex items-center justify-center text-purple-200 font-bold text-3xl shadow-2xl">
                      {activeCall.targetUser.fullName.charAt(0).toUpperCase()}
                    </div>

                    {activeCall.status === 'calling' && (
                      <>
                        <span className="absolute inset-0 rounded-3xl border-2 border-purple-500 animate-ping opacity-40 pointer-events-none" />
                        <span className="absolute -inset-3 rounded-3xl border border-pink-500/50 animate-pulse pointer-events-none" />
                      </>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-white">{activeCall.targetUser.fullName}</h3>
                  <p className="text-xs text-slate-400 capitalize mt-0.5">
                    {activeCall.targetUser.role} &bull; {activeCall.targetUser.email || 'Institutional Contact'}
                  </p>

                  {/* Audio Waveform */}
                  {activeCall.status === 'connected' && (
                    <div className="flex items-center gap-1.5 mt-5">
                      <span className="w-1.5 h-3 bg-emerald-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-6 bg-emerald-400 rounded-full animate-bounce [animation-delay:100ms]" />
                      <span className="w-1.5 h-9 bg-emerald-300 rounded-full animate-bounce [animation-delay:250ms]" />
                      <span className="w-1.5 h-5 bg-emerald-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-7 bg-emerald-300 rounded-full animate-bounce [animation-delay:300ms]" />
                      <span className="w-1.5 h-3 bg-emerald-400 rounded-full animate-bounce [animation-delay:50ms]" />
                    </div>
                  )}

                  {activeCall.status === 'calling' && (
                    <p className="text-xs text-purple-300 animate-pulse mt-4 font-mono">
                      Establishing encrypted WebRTC connection...
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Controls Bar */}
            <div className="p-6 bg-black/60 border-t border-white/10 flex items-center justify-center gap-4">
              {activeCall.status === 'calling' ? (
                /* Cancel Call while ringing */
                <button
                  onClick={endCall}
                  className="px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-rose-600/40 transition-all cursor-pointer"
                >
                  <PhoneOff className="w-5 h-5" />
                  <span>Cancel Call</span>
                </button>
              ) : (
                <>
                  {/* Mic Toggle */}
                  <button
                    onClick={() =>
                      setActiveCall((prev) => (prev ? { ...prev, isMuted: !prev.isMuted } : null))
                    }
                    className={`p-3.5 rounded-2xl transition-all cursor-pointer ${
                      activeCall.isMuted
                        ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title={activeCall.isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                  >
                    {activeCall.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  {/* Camera Toggle (Video Call only) */}
                  {activeCall.type === 'video' && (
                    <button
                      onClick={() =>
                        setActiveCall((prev) =>
                          prev ? { ...prev, isCameraOn: !prev.isCameraOn } : null
                        )
                      }
                      className={`p-3.5 rounded-2xl transition-all cursor-pointer ${
                        !activeCall.isCameraOn
                          ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                      title={activeCall.isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
                    >
                      {activeCall.isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                    </button>
                  )}

                  {/* Screen Share */}
                  <button
                    onClick={() =>
                      setActiveCall((prev) =>
                        prev ? { ...prev, isScreenSharing: !prev.isScreenSharing } : null
                      )
                    }
                    className={`p-3.5 rounded-2xl transition-all cursor-pointer ${
                      activeCall.isScreenSharing
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title="Share Screen"
                  >
                    <ScreenShare className="w-5 h-5" />
                  </button>

                  {/* End Call Button */}
                  <button
                    onClick={endCall}
                    className="px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-rose-600/40 transition-all cursor-pointer"
                    title="End Call"
                  >
                    <PhoneOff className="w-5 h-5" />
                    <span>End Call</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatCommunication;
