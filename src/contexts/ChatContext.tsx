import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Emotion } from '../types/emotion';

export interface ChatMessage {
  id: string;
  emotion?: Emotion;
  text: string;
  type: 'cat' | 'system';
  timestamp: number;
}

interface ChatContextType {
  messages: ChatMessage[];
  addMessage: (text: string, type: 'cat' | 'system', emotion?: Emotion) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const addMessage = (text: string, type: 'cat' | 'system', emotion?: Emotion) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      type,
      emotion,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  return (
    <ChatContext.Provider value={{ messages, addMessage }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
} 