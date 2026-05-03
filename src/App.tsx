/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Shield, 
  Terminal, 
  Globe, 
  MessageSquare, 
  FileText, 
  Zap, 
  ChevronRight, 
  RefreshCcw,
  Send,
  Loader2,
  Lock,
  User,
  BookOpen,
  Search,
  X,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- TYPES ---
interface SessionData {
  country: string;
  committee: string;
  agenda: string;
  backgroundGuide: string;
  notes: string;
  experience: 'Beginner' | 'Intermediate' | 'Elite';
}

interface Message {
  role: 'user' | 'maeos' | 'system';
  content: string;
  timestamp: Date;
}

// --- CONSTANTS ---
const MAEOS_SYSTEM_PROMPT = `
# Identity
You are the MUN Assistant, a premier Model United Nations strategic advisor and documentation engine. 
You function as a professional coach, policy analyst, and expert diplomatic drafter.

# Objective
Equip the user with professional-grade arguments, speeches, and resolutions.
You are a documentation engine capable of generating:
1. Position Papers: Professional multi-page documents outlining national policy, historical context, and concrete solutions. Use clear headings.
2. Speeches: Opening statements (GSL), moderated caucus comments, and closing remarks. Tailor speeches to specific time limits.
3. Resolutions: Formal UN-formatted drafts. Use standard operative verbs and pre-ambulatory phrases.
4. Strategy Briefs: Advice on voting blocs, negotiation tactics, and alliance building.

Always use a respectful, executive, and highly strategic tone. You are a human advisor.

# Guidelines
- Be accurate and realistic.
- Represent the user's target country with absolute fidelity.
- Use professional diplomatic language.
- Format your output using Markdown for better readability. Use bold headers, bullet points, and appropriate spacing.

# Output Format for Strategy
When providing tactical or strategic advice, use the following structure:
## 1. Executive Summary
## 2. Diplomatic Assessment
## 3. Core Strategic Pillars
## 4. Proposed Tactical Maneuvers
## 5. Rebuttal & Opposition Mapping
## 6. Closing Recommendations
`;

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'Dashboard' | 'Speech' | 'Resolution' | 'Strategy' | 'Settings'>('Dashboard');
  const [isActivated, setIsActivated] = useState(() => !!localStorage.getItem('VITE_GEMINI_API_KEY'));
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('VITE_GEMINI_API_KEY') || '');
  const [tempKey, setTempKey] = useState(userApiKey);
  const [sessionData, setSessionData] = useState<SessionData>({
    country: '',
    committee: '',
    agenda: '',
    backgroundGuide: '',
    notes: '',
    experience: 'Elite'
  });
  const [chatLog, setChatLog] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchResultIndex, setSearchResultIndex] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const msgRefs = useRef<{[key: number]: HTMLDivElement | null}>({});

  // --- SEARCH LOGIC ---
  const searchResults = chatLog.reduce((acc, msg, idx) => {
    if (searchTerm && msg.content.toLowerCase().includes(searchTerm.toLowerCase())) {
      acc.push(idx);
    }
    return acc;
  }, [] as number[]);

  useEffect(() => {
    if (userApiKey) {
      localStorage.setItem('VITE_GEMINI_API_KEY', userApiKey);
    }
  }, [userApiKey]);

  useEffect(() => {
    // Diagnostic Ping
    fetch('/api/health')
      .then(r => r.json())
      .then(data => console.log("[DIAGNOSTIC] Server Health:", data))
      .catch(err => console.error("[DIAGNOSTIC] Server Health Failed:", err));

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchActive(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (searchResults.length > 0 && isSearchActive) {
      const activeIdx = searchResults[searchResultIndex];
      msgRefs.current[activeIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchResultIndex, searchTerm, isSearchActive]);

  const handleSearchNext = () => {
    if (searchResults.length > 0) {
      setSearchResultIndex((prev) => (prev + 1) % searchResults.length);
    }
  };

  const handleSearchPrev = () => {
    if (searchResults.length > 0) {
      setSearchResultIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    }
  };

  const highlightMatches = (content: string) => {
    if (!searchTerm) return content;
    return content; // We'll use the component-based highlighting in Markdown
  };

// --- API HELPER ---
  const getMaeosIntelligence = async (prompt: string) => {
    try {
      console.log(`[CLIENT] Strategic AI Request Initiated via @google/genai`);
      
      // Determine the key: priority to UI-entered key, then environment fallback
      const apiKey = userApiKey || (process.env as any).GEMINI_API_KEY;
      
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "undefined" || apiKey === "") {
        throw new Error("API_KEY_MISSING");
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      return response.text || "Strategic assessment currently unavailable.";
    } catch (error: any) {
      console.error("Critical Engine Failure:", error);
      throw error;
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  const handleInitialization = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionData.country && sessionData.committee && sessionData.agenda) {
      setIsInitialized(true);
      const initialMessage: Message = {
        role: 'system',
        content: `MUN Assistant v1.0 is ready. I have prepared the session briefing for ${sessionData.country} in the ${sessionData.committee}. How can I assist with your preparation?`,
        timestamp: new Date()
      };
      setChatLog([initialMessage]);
    }
  };

  const processQuery = async () => {
    if (!currentInput.trim() || isLoading) return;

    const userMsg: Message = {
      role: 'user',
      content: currentInput,
      timestamp: new Date()
    };

    setChatLog(prev => [...prev, userMsg]);
    setIsLoading(true);
    setCurrentInput('');

    try {
      const fullContextPrompt = `
        ${MAEOS_SYSTEM_PROMPT}
        
        SESSION CONTEXT:
        - Country: ${sessionData.country}
        - Committee: ${sessionData.committee}
        - Agenda: ${sessionData.agenda}
        - Background Guide: ${sessionData.backgroundGuide?.substring(0, 3000)}
        - Strategic Notes: ${sessionData.notes}
        - Experience: ${sessionData.experience}

        USER REQUEST: ${currentInput}
      `;

      const text = await getMaeosIntelligence(fullContextPrompt);

      const maeosMsg: Message = {
        role: 'maeos',
        content: text,
        timestamp: new Date()
      };

      setChatLog(prev => [...prev, maeosMsg]);
    } catch (error: any) {
      console.error("MUN Assistant API Error:", error);
      setChatLog(prev => [...prev, {
        role: 'system',
        content: error?.message?.includes("API_KEY_MISSING") 
          ? "### ⚠️ Configuration Required\nThe Strategic Advisor engine is offline. Please enter your API key in the **Executive Settings** menu on the left.\n\n[Get your free Gemini API Key here](https://aistudio.google.com/app/apikey)" 
          : error?.message || "I am having difficulty processing that request. Please verify your API settings.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- SYSTEM ACTIVATION ---
  if (!isActivated) {
    return (
      <div className="min-h-screen bg-pure-black flex items-center justify-center p-6 font-sans relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold/10 rounded-full blur-[120px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-soft-black border-2 border-gold/40 rounded-[2.5rem] p-12 text-center shadow-[0_0_80px_-20px_rgba(212,175,55,0.4)] gold-border-glow relative z-10"
        >
          <div className="mb-12 flex justify-center">
            <div className="px-4 py-1.5 rounded-full border border-gold/30 bg-gold/5 flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
              <span className="text-[10px] font-black text-gold tracking-[0.2em] uppercase italic">Designed by Krish Narang</span>
              <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            </div>
          </div>

          <div className="w-24 h-24 bg-gold/10 border border-gold/30 rounded-3xl flex items-center justify-center mx-auto mb-10">
            <Lock className="w-12 h-12 text-gold" />
          </div>
          <h1 className="text-3xl font-black text-white mb-3">System Activation</h1>
          <p className="text-slate-500 text-sm font-mono uppercase tracking-[0.2em] mb-10">Strategic Hub Offline</p>
          
          <div className="space-y-6 text-left">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gold uppercase tracking-widest ml-1">Enter Strategic Key</label>
              <input 
                type="password"
                placeholder="Paste your GEMINI_API_KEY..."
                className="w-full bg-pure-black border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-gold shadow-inner transition-all placeholder:text-slate-800"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
              />
            </div>
            
            <div className="p-4 bg-gold/5 border border-gold/20 rounded-xl">
              <p className="text-[10px] text-gold/70 leading-relaxed text-center">
                Analysis requires a valid Gemini pipeline. <br/>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-gold font-bold underline">Get your free key from Google AI Studio</a>.
              </p>
            </div>

            <button 
              disabled={!tempKey}
              onClick={() => {
                setUserApiKey(tempKey);
                setIsActivated(true);
                setIsInitialized(false); // Trigger onboarding if not done
              }}
              className="w-full bg-gold disabled:opacity-30 disabled:cursor-not-allowed text-pure-black font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-gold-light transition-all shadow-lg shadow-gold/20"
            >
              ACTIVATE & CONFIRM
              <Zap className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- ONBOARDING UI ---
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-pure-black flex items-center justify-center p-6 font-sans relative">
        <div className="max-w-3xl w-full bg-soft-black border border-gold/20 rounded-2xl shadow-2xl p-10 relative z-10 gold-border-glow">
          <div className="mb-8 flex justify-center">
            <div className="px-6 py-2 rounded-full border border-gold/40 bg-gold/10 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
              <span className="text-xs font-black text-gold tracking-[0.3em] uppercase italic">System Architect: Krish Narang</span>
              <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
            </div>
          </div>

          <div className="flex flex-col items-center mb-10 text-center">
            <div className="p-4 bg-gold/5 rounded-full border border-gold/20 mb-4">
              <Shield className="w-10 h-10 text-gold" />
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white">
              MUN <span className="gold-text-gradient uppercase text-sm ml-2 border border-gold/40 px-3 py-1 tracking-[0.2em] rounded-sm">Advisor</span>
            </h1>
            <p className="text-slate-500 text-[10px] mt-4 font-mono uppercase tracking-[0.5em]">
              Executive Diplomatic Suite
            </p>
          </div>

          <form onSubmit={handleInitialization} className="space-y-6 relative z-20">
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => setSessionData({
                  country: "Republic of Korea",
                  committee: "United Nations Security Council",
                  agenda: "Addressing the situation in the Korean Peninsula",
                  backgroundGuide: "The Security Council has held several meetings recently to discuss missile tests and regional security...",
                  notes: "Focus on de-escalation while maintaining defense alliances. Seek consensus on humanitarian aid.",
                  experience: "Elite"
                })}
                className="text-[10px] text-gold-light/60 hover:text-gold-light font-mono border border-gold/10 px-3 py-1.5 rounded-md transition-all hover:bg-gold/5"
              >
                [ USE SAMPLE DATA ]
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-gold/80 text-[10px] font-bold flex items-center gap-2 uppercase tracking-widest pl-1">
                  <Globe className="w-3 h-3" /> Target Country
                </label>
                <input 
                  required
                  className="w-full bg-pure-black border border-slate-800 p-4 text-white rounded-xl focus:ring-1 focus:ring-gold focus:border-gold outline-none transition-all placeholder:text-slate-700 font-medium"
                  placeholder="e.g. France, USA, Russia"
                  value={sessionData.country}
                  onChange={e => setSessionData({...sessionData, country: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-gold/80 text-[10px] font-bold flex items-center gap-2 uppercase tracking-widest pl-1">
                  <Zap className="w-3 h-3" /> Committee
                </label>
                <input 
                  required
                  className="w-full bg-pure-black border border-slate-800 p-4 text-white rounded-xl focus:ring-1 focus:ring-gold focus:border-gold outline-none transition-all placeholder:text-slate-700 font-medium"
                  placeholder="e.g. UNSC, DISEC"
                  value={sessionData.committee}
                  onChange={e => setSessionData({...sessionData, committee: e.target.value})}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-gold/80 text-[10px] font-bold flex items-center gap-2 uppercase tracking-widest pl-1">
                  <MessageSquare className="w-3 h-3" /> Agenda / Topic
                </label>
                <input 
                  required
                  className="w-full bg-pure-black border border-slate-800 p-4 text-white rounded-xl focus:ring-1 focus:ring-gold focus:border-gold outline-none transition-all placeholder:text-slate-700 font-medium"
                  placeholder="e.g. Nuclear Proliferation in the 21st Century"
                  value={sessionData.agenda}
                  onChange={e => setSessionData({...sessionData, agenda: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-gold/80 text-[10px] font-bold flex items-center gap-2 uppercase tracking-widest pl-1">
                <BookOpen className="w-3 h-3" /> Background Guide
              </label>
              <textarea 
                className="w-full bg-pure-black border border-slate-800 p-4 text-slate-300 rounded-xl h-32 text-sm focus:ring-1 focus:ring-gold outline-none transition-all resize-none custom-scrollbar"
                placeholder="Paste key information from your background guide here..."
                value={sessionData.backgroundGuide}
                onChange={e => setSessionData({...sessionData, backgroundGuide: e.target.value})}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-gold/80 text-[10px] font-bold flex items-center gap-2 uppercase tracking-widest pl-1">
                <Lock className="w-3 h-3" /> Strategic Notes
              </label>
              <textarea 
                className="w-full bg-pure-black border border-slate-800 p-4 text-slate-300 rounded-xl h-24 text-sm focus:ring-1 focus:ring-gold outline-none transition-all resize-none custom-scrollbar"
                placeholder="Your specific goals or notes..."
                value={sessionData.notes}
                onChange={e => setSessionData({...sessionData, notes: e.target.value})}
              />
            </div>

            <button 
              type="submit" 
              className="w-full bg-gold hover:bg-gold-light text-pure-black font-black py-5 rounded-xl transition-all transform hover:scale-[1.01] active:scale-95 shadow-xl flex items-center justify-center gap-3 group"
            >
              LAUNCH ASSISTANT
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- DASHBOARD UI ---
  return (
    <div className="flex h-screen bg-pure-black text-slate-200 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-80 bg-soft-black border-r border-slate-800 flex flex-col relative z-10">
        <div className="bg-gold/10 border-b border-gold/20 py-2.5 flex justify-center items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-pulse" />
          <span className="text-[9px] font-black text-gold tracking-[0.3em] uppercase italic">Engine by Krish Narang</span>
          <div className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-pulse" />
        </div>
        <div className="p-8 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-1 text-white">
            <h1 className="text-2xl font-black italic tracking-tighter">MUN Assistant</h1>
            <span className="text-[10px] bg-gold/10 text-gold border border-gold/30 px-1.5 py-0.5 rounded-sm font-mono">v1.0</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            <span className="text-[9px] text-green-500/80 font-mono tracking-[0.2em] uppercase">Active Advisor</span>
          </div>
        </div>

        <div className="flex-grow p-6 space-y-8 overflow-y-auto custom-scrollbar">
          <nav className="space-y-2">
            <h3 className="text-[10px] text-gold/40 font-bold uppercase tracking-[0.3em] mb-4 pl-3">Executive Menu</h3>
            {[
              { id: 'Dashboard', icon: Shield, label: 'Strategic Hub' },
              { id: 'Search', icon: Search, label: 'Strategic Search' },
              { id: 'Speech', icon: MessageSquare, label: 'Speech Lab' },
              { id: 'Resolution', icon: FileText, label: 'Resolution Engine' },
              { id: 'Strategy', icon: Zap, label: 'Tactical Analysis' },
              { id: 'Settings', icon: Lock, label: 'Executive Settings' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'Search') {
                    setIsSearchActive(true);
                  } else {
                    setActiveTab(tab.id as any);
                    setIsSearchActive(false);
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group",
                  ((activeTab === tab.id && !isSearchActive) || (tab.id === 'Search' && isSearchActive)) 
                    ? "bg-gold text-pure-black shadow-lg shadow-gold/20 font-bold" 
                    : "text-slate-500 hover:bg-gold/5 hover:text-gold"
                )}
              >
                <tab.icon className={cn("w-5 h-5 transition-colors", ((activeTab === tab.id && !isSearchActive) || (tab.id === 'Search' && isSearchActive)) ? "text-pure-black" : "text-gold/40 group-hover:text-gold")} />
                <span className="text-sm tracking-tight">{tab.label}</span>
              </button>
            ))}
          </nav>

          <section className="pt-8 border-t border-white/5">
            <h3 className="text-[10px] text-gold/40 font-bold uppercase tracking-[0.3em] mb-4 pl-3">Diplomatic Entity</h3>
            <div className="p-5 bg-soft-black/40 border border-gold/10 rounded-2xl space-y-4 gold-border-glow">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-gold/50 font-mono uppercase tracking-widest">Sovereign State</span>
                <span className="text-base font-black text-white tracking-tight">{sessionData.country}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-gold/50 font-mono uppercase tracking-widest">Organ / Branch</span>
                <span className="text-xs text-slate-400 font-medium">{sessionData.committee}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-white/5">
          <button 
            onClick={() => setIsInitialized(false)}
            className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-soft-black/60 border border-white/10 text-[10px] font-bold text-slate-500 hover:bg-gold/5 hover:border-gold/30 hover:text-gold transition-all uppercase tracking-[0.2em]"
          >
            <RefreshCcw className="w-3.5 h-3.5" /> Re-Initialize Session
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-grow flex flex-col relative">
        <header className="h-20 bg-pure-black border-b border-slate-800 flex items-center justify-between px-10 relative z-10 transition-all">
          <div className="flex items-center gap-6 flex-grow">
            {!isSearchActive ? (
              <div className="flex flex-col">
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="text-slate-500 uppercase tracking-widest">Topic:</span>
                  <span className="text-gold uppercase truncate max-w-md">{sessionData.agenda}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[8px] text-slate-700 font-mono tracking-widest uppercase">Platform Architect:</span>
                  <span className="text-[9px] font-black text-gold/60 italic tracking-tight underline decoration-gold/20 underline-offset-2">Krish Narang</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 flex-grow max-w-xl">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/40" />
                  <input 
                    autoFocus
                    className="w-full bg-soft-black border border-gold/20 pl-10 pr-4 py-2 rounded-xl text-sm text-white focus:border-gold/60 outline-none transition-all placeholder:text-slate-600"
                    placeholder="Find in strategy logs..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setSearchResultIndex(0);
                    }}
                  />
                </div>
                {searchTerm && (
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 whitespace-nowrap">
                    <span>{searchResults.length > 0 ? searchResultIndex + 1 : 0} of {searchResults.length}</span>
                    <div className="flex bg-soft-black border border-white/10 rounded-lg">
                      <button onClick={handleSearchPrev} className="p-1 px-2 border-r border-white/10 hover:text-gold transition-colors"><ChevronUp className="w-3 h-3" /></button>
                      <button onClick={handleSearchNext} className="p-1 px-2 hover:text-gold transition-colors"><ChevronDown className="w-3 h-3" /></button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Search Tool - Enhanced Visibility */}
            <div className={cn(
              "flex items-center border rounded-xl px-4 py-2 transition-all duration-500",
              isSearchActive 
                ? "bg-gold/10 border-gold/50 shadow-[0_0_15px_-5px_rgba(212,175,55,0.3)] w-64" 
                : "bg-soft-black border-white/10 w-48 hover:border-white/20"
            )}>
              <Search className={cn("w-4 h-4 mr-2 transition-colors", isSearchActive ? "text-gold" : "text-slate-500")} />
              <input 
                placeholder="Find Strategic Info..."
                className="bg-transparent border-none outline-none text-xs text-white placeholder:text-slate-600 flex-grow"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (!isSearchActive && e.target.value) setIsSearchActive(true);
                  setSearchResultIndex(0);
                }}
                onFocus={() => setIsSearchActive(true)}
              />
              {isSearchActive && (
                <button 
                  onClick={() => {
                    setIsSearchActive(false);
                    setSearchTerm('');
                  }}
                  className="ml-2 p-1 hover:bg-gold/20 rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-gold" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gold/5 border border-gold/20 rounded-full text-gold">
              <div className="w-2 h-2 bg-gold rounded-full" />
              <span className="text-[10px] font-mono uppercase">Connected</span>
            </div>
          </div>
        </header>

        {/* FEED */}
        <div className="flex-grow overflow-y-auto p-10 space-y-8 bg-pure-black custom-scrollbar">
          {/* EXECUTIVE SETTINGS */}
          {activeTab === 'Settings' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto py-12"
            >
              <div className="bg-soft-black border border-gold/20 rounded-3xl p-10 shadow-2xl gold-border-glow">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-gold/5 rounded-2xl border border-gold/20">
                    <Lock className="w-6 h-6 text-gold" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">Executive Activation</h2>
                    <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mt-1">Strategic Engine Configuration</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gold uppercase tracking-[0.2em] ml-1">Gemini API Key</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/40 group-focus-within:text-gold transition-colors" />
                      <input 
                        type="password"
                        placeholder="Enter your GEMINI_API_KEY here..."
                        className="w-full bg-pure-black border border-white/10 p-4 pl-12 rounded-xl text-white outline-none focus:border-gold/60 transition-all placeholder:text-slate-700"
                        value={userApiKey}
                        onChange={(e) => setUserApiKey(e.target.value)}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed italic px-1">
                      This key is stored locally in your browser and used to power the Strategic Advisor. 
                      You can get a free key from the <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-gold hover:underline">Google AI Studio API Key panel</a>.
                    </p>
                  </div>

                  <div className="pt-6 border-t border-white/5 space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-gold/5 border border-gold/20 rounded-xl">
                      <div className="w-2 h-2 bg-gold rounded-full mt-1.5 shrink-0" />
                      <p className="text-[11px] text-gold-light/80 leading-relaxed">
                        <strong className="text-gold">Pro Tip:</strong> Usually, you can add this to the **Secrets** menu (the key icon in the bottom left sidebar of AI Studio) under the name `GEMINI_API_KEY`. This is more secure and works across sessions.
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setActiveTab('Dashboard')}
                    className="w-full bg-gold text-pure-black font-black py-4 rounded-xl hover:bg-gold-light transition-all flex items-center justify-center gap-2"
                  >
                    SAVE & RETURN TO HUB
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'Dashboard' && chatLog.length === 1 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12"
            >
              <button 
                onClick={() => setCurrentInput(`As my advisor for ${sessionData.country}, please help me draft a professional Position Paper on the agenda: ${sessionData.agenda}. Focus on our national interest and historical diplomacy.`)}
                className="bg-soft-black/40 backdrop-blur-sm p-8 border border-gold/10 rounded-3xl hover:border-gold/50 transition-all text-left group gold-border-glow flex flex-col h-full"
              >
                <div className="w-14 h-14 bg-gold/5 rounded-2xl flex items-center justify-center mb-6 border border-gold/20 group-hover:bg-gold/10 transition-transform group-hover:scale-110 duration-500">
                  <FileText className="w-8 h-8 text-gold" />
                </div>
                <h3 className="text-gold font-bold text-lg mb-3">Policy Paper</h3>
                <p className="text-xs text-slate-500 leading-relaxed flex-grow">Generate a formal policy document with historical context and proposed directives.</p>
                <div className="mt-4 text-[10px] text-gold/40 font-mono flex items-center gap-2">
                  <Globe className="w-3 h-3" /> PROFESSIONAL GRADE
                </div>
              </button>
              <button 
                onClick={() => setCurrentInput(`I need to speak in the General Speakers List. Draft a powerful 90-second speech for ${sessionData.country} that highlights our position on ${sessionData.agenda}.`)}
                className="bg-soft-black/40 backdrop-blur-sm p-8 border border-gold/10 rounded-3xl hover:border-gold/50 transition-all text-left group gold-border-glow flex flex-col h-full"
              >
                <div className="w-14 h-14 bg-gold/5 rounded-2xl flex items-center justify-center mb-6 border border-gold/20 group-hover:bg-gold/10 transition-transform group-hover:scale-110 duration-500">
                  <MessageSquare className="w-8 h-8 text-gold" />
                </div>
                <h3 className="text-gold font-bold text-lg mb-3">Diplomatic Speech</h3>
                <p className="text-xs text-slate-500 leading-relaxed flex-grow">Draft a high-impact opening statement optimized for clarity and persuasive force.</p>
                <div className="mt-4 text-[10px] text-gold/40 font-mono flex items-center gap-2">
                  <Zap className="w-3 h-3" /> VERBAL LEVERAGE
                </div>
              </button>
              <button 
                onClick={() => setCurrentInput(`Help me draft resolution clauses. Specifically, I need pre-ambulatory clauses and operative clauses addressing ${sessionData.agenda} from the perspective of ${sessionData.country}.`)}
                className="bg-soft-black/40 backdrop-blur-sm p-8 border border-gold/10 rounded-3xl hover:border-gold/50 transition-all text-left group gold-border-glow flex flex-col h-full"
              >
                <div className="w-14 h-14 bg-gold/5 rounded-2xl flex items-center justify-center mb-6 border border-gold/20 group-hover:bg-gold/10 transition-transform group-hover:scale-110 duration-500">
                  <Shield className="w-8 h-8 text-gold" />
                </div>
                <h3 className="text-gold font-bold text-lg mb-3">Resolution Lab</h3>
                <p className="text-xs text-slate-500 leading-relaxed flex-grow">Engineer precise UN-formatted clauses with standard operative verbs and clear mandates.</p>
                <div className="mt-4 text-[10px] text-gold/40 font-mono flex items-center gap-2">
                  <Lock className="w-3 h-3" /> CHARTER COMPLIANT
                </div>
              </button>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {chatLog.map((msg, i) => (
              <motion.div 
                key={i}
                ref={el => { msgRefs.current[i] = el; }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex",
                  msg.role === 'user' ? 'justify-end' : 'justify-start',
                  isSearchActive && searchResults[searchResultIndex] === i && "ring-2 ring-gold/20 rounded-3xl"
                )}
              >
                <div className={cn(
                  "max-w-[85%] p-6 rounded-2xl relative group transition-all",
                  msg.role === 'user' 
                    ? 'bg-gold text-pure-black font-bold shadow-xl rounded-tr-none' 
                    : msg.role === 'system'
                      ? 'bg-soft-black/50 border border-white/5 text-slate-500 text-xs text-center font-mono w-full italic py-3'
                      : 'bg-soft-black border border-gold/10 text-slate-200 rounded-tl-none border-l-2 border-l-gold shadow-lg shadow-gold/5',
                  isSearchActive && searchTerm && msg.content.toLowerCase().includes(searchTerm.toLowerCase()) && "border-gold/40 shadow-gold/10 shadow-xl"
                )}>
                  {msg.role === 'maeos' && (
                    <div className="flex items-center gap-2 mb-4 text-[10px] font-mono text-gold uppercase tracking-[0.3em] font-black">
                      <Shield className="w-3.5 h-3.5" /> Diplomatic Advisor
                    </div>
                  )}
                  {msg.role === 'user' && (
                    <div className="flex items-center gap-2 mb-2 text-[10px] font-mono text-pure-black/40 uppercase tracking-[0.3em] font-black">
                      <User className="w-3 h-3" /> Delegation
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-gold" />
                      </div>
                      <div>
                        <p className="text-[10px] font-mono text-gold uppercase tracking-[0.2em]">Strategic Intelligence</p>
                        <p className="text-[9px] text-slate-500 font-mono italic">Generated via MAEOS Pipeline</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                        // Optional: Add a toast notification here
                      }}
                      className="p-2 hover:bg-gold/10 rounded-lg text-gold/40 hover:text-gold transition-all group relative"
                      title="Copy to Clipboard"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-gold text-pure-black text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold">COPY CONTENT</span>
                    </button>
                  </div>

                  <div className="prose prose-invert prose-slate max-w-none 
                    prose-headings:text-gold prose-headings:font-black prose-headings:tracking-tight prose-headings:mb-6 prose-headings:mt-10
                    prose-p:leading-relaxed prose-p:mb-6 prose-p:text-slate-300
                    prose-li:text-slate-300 prose-li:mb-2
                    prose-strong:text-white prose-strong:font-bold
                    prose-blockquote:border-l-gold prose-blockquote:bg-gold/5 prose-blockquote:px-8 prose-blockquote:py-6 prose-blockquote:rounded-r-3xl prose-blockquote:my-10 prose-blockquote:italic
                    prose-hr:border-white/10 prose-hr:my-12
                    prose-table:w-full prose-table:border-collapse prose-th:text-gold prose-th:border-b prose-th:border-gold/20 prose-th:py-3 prose-td:py-3 prose-td:border-b prose-td:border-white/5
                  ">
                    <ReactMarkdown 
                      components={{
                        p: ({children}) => {
                          if (!searchTerm || typeof children !== 'string') return <p className="mb-6 last:mb-0">{children}</p>;
                          const parts = children.split(new RegExp(`(${searchTerm})`, 'gi'));
                          return (
                            <p className="mb-6 last:mb-0">
                              {parts.map((part, index) => 
                                part.toLowerCase() === searchTerm.toLowerCase() ? (
                                  <mark key={index} className="bg-gold/40 text-white rounded-sm px-0.5">{part}</mark>
                                ) : part
                              )}
                            </p>
                          );
                        },
                        h1: ({children}) => <h1 className="text-2xl font-black text-gold mb-6 mt-8 first:mt-2 border-b border-gold/10 pb-2">{children}</h1>,
                        h2: ({children}) => <h2 className="text-xl font-bold text-gold/90 mb-4 mt-8 first:mt-2">{children}</h2>,
                        h3: ({children}) => <h3 className="text-lg font-bold text-gold/80 mb-3 mt-6">{children}</h3>,
                        ul: ({children}) => <ul className="list-disc pl-6 mb-6 space-y-2">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal pl-6 mb-6 space-y-2">{children}</ol>,
                        li: ({children}) => <li className="text-slate-300 leading-relaxed">{children}</li>,
                        hr: () => <hr className="my-8 border-white/10" />,
                        blockquote: ({children}) => (
                          <blockquote className="border-l-4 border-gold bg-gold/5 px-6 py-4 rounded-r-2xl my-8 italic text-slate-300">
                             {children}
                          </blockquote>
                        )
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>

                  <span className="absolute bottom-2 right-4 text-[8px] opacity-30 font-mono">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={chatEndRef} />
        </div>

        {/* INPUT HUB - REFINED FOR FLEXIBILITY */}
        <div className="p-8 bg-pure-black border-t border-white/5 relative z-30">
          <div className="max-w-5xl mx-auto flex items-end gap-5">
            <div className="flex-grow relative bg-soft-black border border-white/10 rounded-2xl focus-within:border-gold/40 transition-all shadow-inner">
              <textarea 
                rows={1}
                disabled={isLoading}
                value={currentInput}
                onChange={e => setCurrentInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    processQuery();
                  }
                }}
                className={cn(
                  "w-full bg-transparent p-6 pr-24 rounded-2xl text-base text-white placeholder:text-slate-600 outline-none resize-none max-h-64 custom-scrollbar",
                  isLoading && "opacity-50 cursor-wait"
                )}
                placeholder={isLoading ? "Analyzing..." : `Ask your advisor for help with ${activeTab.toLowerCase()}...`}
              />
              <div className="absolute right-3 bottom-3">
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    processQuery();
                  }}
                  disabled={isLoading || !currentInput.trim()}
                  className={cn(
                    "p-4 rounded-xl transition-all shadow-xl flex items-center justify-center min-w-[52px] h-[52px]",
                    isLoading || !currentInput.trim() 
                      ? "bg-slate-800 text-slate-600" 
                      : "bg-gold text-pure-black hover:bg-gold-light hover:scale-105 active:scale-95 shadow-gold/10"
                  )}
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
          <div className="max-w-5xl mx-auto mt-4 px-2 flex justify-between items-center text-[10px] font-mono uppercase tracking-[0.2em] text-slate-700">
            <div className="flex gap-6">
              <span className="flex items-center gap-2"><Globe className="w-3 h-3 text-gold/40" /> Policy Engine Active</span>
              <span className="flex items-center gap-2"><Shield className="w-3 h-3 text-gold/40" /> Advisor Ready</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
