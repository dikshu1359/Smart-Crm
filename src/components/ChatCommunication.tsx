import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, UserCheck, Search, Check, CheckCheck, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ChatContact, ChatMessage } from '../types/crm';
import api from '../services/api';

export const ChatCommunication: React.FC = () => {
  const { activeTenant, currentUser, chatContacts } = useApp();

  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch conversation messages when selected contact changes
  useEffect(() => {
    if (!activeTenant || !selectedContact) return;

    let isMounted = true;
    const fetchMessages = async () => {
      try {
        const res = await api.getChatMessages(activeTenant.databaseName, selectedContact.id);
        if (isMounted && res?.messages) {
          setMessages(res.messages);
        }
      } catch (err) {
        console.error('Failed to fetch chat messages:', err);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 4000); // Poll for real-time conversation updates
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTenant, selectedContact]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedContact || !activeTenant || sending) return;

    setSending(true);
    const textToSend = inputText.trim();
    setInputText('');

    try {
      const res = await api.sendChatMessage(activeTenant.databaseName, selectedContact.id, textToSend);
      if (res?.message) {
        setMessages((prev) => [...prev, res.message]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const filteredContacts = chatContacts.filter(
    (c) =>
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Institutional Communication & Messaging</h1>
        <p className="text-xs text-slate-400">
          Authorized direct messaging between Administrators, Faculty, and Students within institutional boundaries.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[620px] bg-white/[0.02] border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md">
        {/* Contact List (4 cols) */}
        <div className="lg:col-span-4 border-r border-white/10 flex flex-col h-full bg-black/20">
          <div className="p-4 border-b border-white/10">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search authorized contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredContacts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No eligible contacts found under institutional messaging policies.
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const isSelected = selectedContact?.id === contact.id;
                return (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className={`w-full text-left p-3 rounded-2xl transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600/20 border border-purple-500/40 text-white'
                        : 'hover:bg-white/5 border border-transparent text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          contact.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-300'
                            : contact.role === 'teacher'
                            ? 'bg-pink-500/20 text-pink-300'
                            : 'bg-indigo-500/20 text-indigo-300'
                        }`}
                      >
                        {contact.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold truncate text-white">{contact.fullName}</h4>
                        <p className="text-[10px] text-slate-400 capitalize">{contact.role}</p>
                      </div>
                    </div>

                    {contact.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-pink-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {contact.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Message Thread (8 cols) */}
        <div className="lg:col-span-8 flex flex-col h-full bg-black/10">
          {selectedContact ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/30">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                      selectedContact.role === 'admin'
                        ? 'bg-purple-500/20 text-purple-300'
                        : selectedContact.role === 'teacher'
                        ? 'bg-pink-500/20 text-pink-300'
                        : 'bg-indigo-500/20 text-indigo-300'
                    }`}
                  >
                    {selectedContact.fullName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{selectedContact.fullName}</h3>
                    <p className="text-[11px] text-slate-400 capitalize">
                      {selectedContact.role} • {selectedContact.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-6">
                    <MessageSquare className="w-10 h-10 text-slate-600 mb-2" />
                    <p className="text-xs">No prior messages with {selectedContact.fullName}.</p>
                    <p className="text-[11px] text-slate-600">Send a message below to start the conversation.</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMine = msg.senderId === currentUser?.id;
                    return (
                      <div key={idx} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`max-w-[75%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                            isMine
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-none shadow-md shadow-purple-600/20'
                              : 'bg-white/10 text-slate-100 rounded-bl-none border border-white/10'
                          }`}
                        >
                          <p>{msg.text}</p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 px-1">
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMine && (
                            msg.read ? <CheckCheck className="w-3 h-3 text-pink-400" /> : <Check className="w-3 h-3 text-slate-500" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Send Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-black/30 flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Write a message to ${selectedContact.fullName}...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-black/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  disabled={sending || !inputText.trim()}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-95 transition-all shadow-md shadow-purple-600/30 disabled:opacity-40 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-8">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 mb-3">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">Select a Conversation</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                Choose an authorized faculty member, administrator, or student from the left panel to begin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ChatCommunication;
