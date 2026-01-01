'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, ChevronDown, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  text: string;
  sender: 'bot' | 'user';
  timestamp: Date;
}

export const HelpBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm Pluto's AI assistant. How can I help you today?",
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate bot response
    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: getBotResponse(inputValue),
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);
      setIsTyping(false);
    }, 1000);
  };

  const getBotResponse = (input: string): string => {
    const lowerInput = input.toLowerCase();
    if (lowerInput.includes('project')) {
      return "You can create a new project from the Dashboard by clicking the 'New Project' button. Projects allow you to organize your process sheets and collaborate with others.";
    }
    if (lowerInput.includes('process') || lowerInput.includes('canvas')) {
      return "The Process Canvas is where you design your workflows. You can drag nodes from the toolbox on the left and connect them to create a flow.";
    }
    if (lowerInput.includes('lane') || lowerInput.includes('swimlane')) {
      return "Swim lanes help organize your process by role or department. You can add them using the 'Add Swim Lane' button in the toolbox or by pressing 'L'.";
    }
    if (lowerInput.includes('version')) {
      return "You can save versions of your process to track changes over time. Use the 'Save Version' button in the sidebar to create a snapshot of your current work.";
    }
    if (lowerInput.includes('share') || lowerInput.includes('collaborate')) {
      return "To share a project, click the 'Share' button in the header. You can invite other users by their email and assign them roles like Editor or Viewer.";
    }
    return "I'm still learning! You can ask me about projects, the process canvas, swim lanes, versioning, or sharing. How else can I assist you?";
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-4 w-80 sm:w-96"
          >
            <Card className="flex flex-col h-[500px] shadow-2xl border-blue-100 overflow-hidden">
              {/* Header */}
              <div className="bg-blue-600 p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 p-1.5 rounded-lg">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Pluto Assistant</h3>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-[10px] opacity-80">Online</span>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-white/10 h-8 w-8"
                >
                  <X size={18} />
                </Button>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-grow p-4 bg-gray-50">
                <div className="flex flex-col gap-4" ref={scrollRef}>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex flex-col max-w-[80%]",
                        msg.sender === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "p-3 rounded-2xl text-sm shadow-sm",
                          msg.sender === 'user' 
                            ? "bg-blue-600 text-white rounded-tr-none" 
                            : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
                        )}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1 px-1">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex flex-col items-start mr-auto max-w-[80%]">
                      <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none shadow-sm">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 bg-white border-t">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    placeholder="Ask me anything..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="flex-grow text-sm h-10 focus-visible:ring-blue-500"
                  />
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={!inputValue.trim() || isTyping}
                    className="bg-blue-600 hover:bg-blue-700 h-10 w-10 shrink-0"
                  >
                    <Send size={18} />
                  </Button>
                </form>
                <p className="text-[10px] text-center text-gray-400 mt-2">
                  Powered by Pluto AI
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-4 py-3 rounded-full shadow-xl transition-all duration-300",
          isOpen ? "bg-gray-800 text-white" : "bg-blue-600 text-white"
        )}
      >
        {isOpen ? (
          <>
            <ChevronDown size={20} />
            <span className="font-medium text-sm">Close</span>
          </>
        ) : (
          <>
            <Sparkles size={20} className="animate-pulse" />
            <span className="font-medium text-sm">Need help?</span>
          </>
        )}
      </motion.button>
    </div>
  );
};
