
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SparkleIcon } from '../constants';
import { Message } from '../types';
import { useSageChat } from '../src/hooks/useIntegrations';

const SageAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "Hi! I'm Sage ✨ Your ATL Urban Farms expert. Need help picking the perfect seedlings for your space?" }
  ]);
  const [inputValue, setInputValue] = useState('');
  const { sendMessage, loading: isTyping } = useSageChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Listen for custom 'openSage' event to open the chat programmatically
  useEffect(() => {
    const handleOpenSage = () => setIsOpen(true);
    window.addEventListener('openSage', handleOpenSage);
    return () => window.removeEventListener('openSage', handleOpenSage);
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isTyping) return;

    const userMsg: Message = { role: 'user', text: inputValue };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    const sageText = await sendMessage(messages, inputValue);
    setMessages(prev => [...prev, { role: 'model', text: sageText }]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-24 right-0 w-[350px] md:w-[420px] h-[600px] bg-white rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(139,92,246,0.25)] border border-purple-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="sage-gradient p-8 text-white flex items-center justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
              
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
                  <SparkleIcon className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-xl leading-tight">Sage AI</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-90">Always Growing</p>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => setIsOpen(false)} 
                className="hover:bg-white/20 p-2 rounded-xl transition-colors relative z-10"
                aria-label="Close chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
              </button>
            </div>

            {/* Chat Content */}
            <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-5 bg-gradient-to-b from-purple-50/30 to-white">
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] px-5 py-4 rounded-[1.5rem] text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-gray-900 text-white rounded-br-none' 
                      : 'bg-white text-gray-700 border border-purple-50 rounded-bl-none'
                  }`}>
                    {msg.text}
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white px-5 py-4 rounded-[1.5rem] shadow-sm border border-purple-50 rounded-bl-none">
                    <div className="flex gap-1.5">
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 bg-purple-400 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-purple-400 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-purple-400 rounded-full" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-6 bg-white border-t border-purple-50">
              <div className="relative group">
                <input 
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask Sage a question..."
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-300 transition-all pr-14"
                />
                <button 
                  type="submit"
                  disabled={!inputValue.trim() || isTyping}
                  className="absolute right-2 top-2 bottom-2 px-4 sage-gradient text-white rounded-xl flex items-center justify-center shadow-lg shadow-purple-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
              <div className="flex items-center justify-center gap-2 mt-4">
                <div className="h-px bg-gray-100 flex-1" />
                <p className="text-[9px] text-gray-400 uppercase font-black tracking-[0.3em]">Nursery Intelligence</p>
                <div className="h-px bg-gray-100 flex-1" />
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        {/* Gentle Wave Flow */}
        {!isOpen && (
          <motion.div
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.3, 0.15, 0.3]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute inset-0 sage-gradient rounded-full -z-10"
          />
        )}

        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          aria-label="Chat with Sage"
          className={`w-16 h-16 rounded-full sage-gradient text-white flex items-center justify-center shadow-[0_20px_40px_-10px_rgba(139,92,246,0.5)] border-4 border-white relative transition-all duration-500 overflow-hidden ${isOpen ? 'rotate-[360deg]' : ''}`}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
              </motion.div>
            ) : (
              <motion.div
                key="sparkle"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="flex items-center justify-center"
              >
                <SparkleIcon className="w-8 h-8" />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Active indicator when closed */}
          {!isOpen && (
            <span className="absolute top-0 right-0 h-4 w-4 bg-emerald-500 border-2 border-white rounded-full" />
          )}
        </motion.button>
      </div>
    </div>
  );
};

export default SageAssistant;
