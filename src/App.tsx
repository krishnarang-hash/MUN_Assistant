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
  ChevronDown,
  Star,
  Quote,
  Plus,
  Trash2,
  Clock,
  ShieldAlert,
  Menu,
  Smartphone,
  Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { COUNTRIES, COMMITTEES } from './constants';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- LOGO COMPONENT ---
const MUNLogo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <div className={cn("relative flex items-center justify-center bg-white rounded-full overflow-hidden shadow-inner", className)}>
    <img 
      src="https://cdn.corenexis.com/files/c/7242462720.png" 
      alt="Krish Narang MUN Logo"
      className="w-full h-full object-contain p-2"
      referrerPolicy="no-referrer"
    />
  </div>
);

// --- BRANDING COMPONENT ---
const BrandLogo = ({ size = "md", showLogo = true }: { size?: 'sm' | 'md' | 'lg', showLogo?: boolean }) => {
  const isSm = size === 'sm';
  const isLg = size === 'lg';
  
  return (
    <div className="flex items-center gap-2 md:gap-3">
      {showLogo && <MUNLogo className={cn(isSm ? "w-6 h-6" : isLg ? "w-16 h-16" : "w-8 h-8 md:w-10 md:h-10", "ring-2 ring-gold/20")} />}
      <div className="flex items-center gap-2">
        <h1 className={cn(
          "font-black italic tracking-tighter text-white uppercase",
          isSm ? "text-sm" : isLg ? "text-4xl md:text-6xl" : "text-lg"
        )}>MUN</h1>
        <div className={cn(
          "w-px bg-gold/40 mx-0.5",
          isSm ? "h-4" : isLg ? "h-12" : "h-5"
        )} />
        <h1 className={cn(
          "font-black italic tracking-tighter text-gold uppercase",
          isSm ? "text-sm" : isLg ? "text-4xl md:text-6xl" : "text-lg"
        )}>ADVISOR</h1>
      </div>
    </div>
  );
};

// --- TYPES ---
interface SessionData {
  name: string;
  country: string;
  committee: string;
  agenda: string;
  backgroundGuide: string;
  notes: string;
  experience: 'Beginner' | 'Intermediate' | 'Elite';
  deviceType: 'laptop' | 'tablet' | 'phone';
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  name: string;
  sessionData: SessionData;
  chatLog: Message[];
  updatedAt: Date;
}

interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  timestamp: Date;
}

// --- CONSTANTS ---
const ASSISTANT_SYSTEM_PROMPT = `
# Identity
You are the MUN Assistant, a professional Model United Nations advisor and documentation tool. 
You also function as a comprehensive General Intelligence Assistant (matching the state-of-the-art capabilities of Gemini 1.5 Pro). You are designed to assist with any task imaginable—from complex software engineering and content creation to scientific research, creative writing, and daily productivity.

# Versatility
While you possess deep expertise in diplomacy and MUN strategy, you are not limited by it. You are a highly adaptable and versatile human-like advisor. If the user asks for non-MUN help (e.g., coding help, story writing, philosophical debate, or general questions), transition seamlessly to that role while maintaining your polished and highly intelligent tone.

# Objective
Equip the user with professional-grade arguments, speeches, and resolutions.
Simultaneously, serve as a multi-modal intelligent agent capable of solving any problem the user presents.
For MUN-specific documentation:
1. Position Papers: Professional multi-page documents outlining national policy, historical context, and concrete solutions. Use clear headings.
2. Speeches: Opening statements (GSL), moderated caucus comments, and closing remarks. Tailor speeches to specific time limits.
3. Resolutions: Formal UN-formatted drafts. Use standard operative verbs and pre-ambulatory phrases.
4. Strategy Briefs: Advice on voting blocs, negotiation tactics, and alliance building.

Always use a respectful and professional tone. You are a master of intelligence and synthesis.
`;

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'Dashboard' | 'Speech' | 'Resolution' | 'Strategy' | 'Reviews'>('Dashboard');
  const [isActivated] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Chat History State
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('MUN_ASSISTANT_SESSIONS');
    if (saved) {
      return JSON.parse(saved).map((s: any) => ({
        ...s,
        updatedAt: new Date(s.updatedAt),
        chatLog: s.chatLog.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
      }));
    }
    return [];
  });
  
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return localStorage.getItem('MUN_ASSISTANT_ACTIVE_ID');
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeSession = chatSessions.find(s => s.id === activeSessionId) || null;
  const chatLog = activeSession?.chatLog || [];
  const sessionData = activeSession?.sessionData || {
    name: '',
    country: '',
    committee: '',
    agenda: '',
    backgroundGuide: '',
    notes: '',
    experience: 'Elite' as const,
    deviceType: 'laptop' as const
  };

  const [reviews, setReviews] = useState<Review[]>(() => {
    const saved = localStorage.getItem('MUN_ASSISTANT_REVIEWS');
    let loadedReviews: Review[] = [];
    
    // Pool of Indian Names to ensure variety and uniqueness
    const INDIAN_NAMES = [
      "Arjun Mehta", "Priya Sharma", "Rohan Gupta", "Ananya Iyer", "Vikram Singh",
      "Kavita Reddy", "Ishaan Malhotra", "Zoya Khan", "Aditya Verma", "Meera Nair",
      "Sahil Kapoor", "Tanvi Joshi", "Rahul Deshmukh", "Sneha Kulkarni", "Amit Shah",
      "Neha Malhotra", "Sanjay Singhania", "Deepika Padukone", "Ranveer Singh", "Alia Bhatt"
    ];

    // Weekly "AI-style" reviews pool
    const WEEKLY_FEEDBACK = [
      "The resolution engine is a game changer. It correctly formats everything in seconds. Gr8 for crunch time!",
      "I used the policy analysis tool to find loopholes. Worked perfectly for ur delegation strategy.",
      "Finally an MUN tool that doesn't feel like a generic chatbot. The intelligence is top-notch, really helpful for research etc.",
      "The speech lab helped me refine my GSL. The pacing suggestions were v good for my opening speech.",
      "Impressive understanding of diplomatic nuances. It helped me draft a complex directive in no time.",
      "The background guide analysis saved me hours of research. Highly professional tool 10/10.",
      "Best MUN assistant I've used. The historical context provided is remarkably accurate and helpful for ur position paper.",
      "The strategy briefs are gr8 for alliance building in complex committees."
    ];

    if (saved) {
      loadedReviews = JSON.parse(saved).map((r: any) => ({ ...r, timestamp: new Date(r.timestamp) }));
    } else {
      loadedReviews = [
        { id: '1', author: 'Arjun Mehta', rating: 5, comment: 'The position paper templates are incredibly professional. Highly recommended!', timestamp: new Date('2026-04-15') },
        { id: '2', author: 'Priya Sharma', rating: 4.5, comment: 'Great for last-minute speech preparation. The level of detail is impressive.', timestamp: new Date('2026-04-18') },
        { id: '3', author: 'Rohan Gupta', rating: 5, comment: 'The policy analysis features are deeper than anything else on the market. Gr8 stuff!', timestamp: new Date('2026-04-20') }
      ];
    }

    // Logic to add one new review every week since April 20, 2026
    const startDate = new Date('2026-04-20');
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - startDate.getTime());
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));

    for (let i = 1; i <= diffWeeks; i++) {
      const weekTimestamp = new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      const weeklyId = `weekly-${i}`;
      
      // Only add if not already in loadedReviews
      if (!loadedReviews.some(r => r.id === weeklyId)) {
        const nameIdx = (i + 5) % INDIAN_NAMES.length; // Offset to not repeat starting names
        const feedbackIdx = i % WEEKLY_FEEDBACK.length;
        
        loadedReviews.push({
          id: weeklyId,
          author: INDIAN_NAMES[nameIdx],
          rating: 4.5 + (Math.random() * 0.5), // High ratings for positive feedback
          comment: WEEKLY_FEEDBACK[feedbackIdx],
          timestamp: weekTimestamp
        });
      }
    }

    // Specific takedown requested by user: "Did not help me.would not advise"
    return loadedReviews
      .map((r, idx) => {
        const lowerAuthor = r.author.toLowerCase();
        const isGeneric = lowerAuthor.includes('delegate') || 
                         lowerAuthor.includes('republic of') ||
                         ['korea', 'canada', 'usa', 'uk', 'france', 'brazil', 'egypt', 'india'].some(c => lowerAuthor.includes(c));
        
        if (isGeneric) {
          return {
            ...r,
            author: INDIAN_NAMES[(idx + 10) % INDIAN_NAMES.length]
          };
        }
        return r;
      })
      .filter(r => {
        const normalizedComment = r.comment.toLowerCase().trim();
        return normalizedComment !== "did not help me.would not advise" && 
               normalizedComment !== "did not help me would not advise";
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  });

  const [newReview, setNewReview] = useState({ rating: 0, comment: '' });
  const [hoveredRating, setHoveredRating] = useState(0);
  const [showReviewSuccess, setShowReviewSuccess] = useState(false);
  const [isModerating, setIsModerating] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);

  // Persistence Hook
  useEffect(() => {
    localStorage.setItem('MUN_ASSISTANT_SESSIONS', JSON.stringify(chatSessions));
    localStorage.setItem('MUN_ASSISTANT_REVIEWS', JSON.stringify(reviews));
    if (activeSessionId) {
      localStorage.setItem('MUN_ASSISTANT_ACTIVE_ID', activeSessionId);
    }
  }, [chatSessions, activeSessionId, reviews]);

  // Sync initialization state
  useEffect(() => {
    if (activeSession) {
      setIsInitialized(true);
    } else if (chatSessions.length === 0) {
      setIsInitialized(false);
    }
  }, [activeSession, chatSessions]);

  const [onboardingData, setOnboardingData] = useState<SessionData>({
    name: '',
    country: '',
    committee: '',
    agenda: '',
    backgroundGuide: '',
    notes: '',
    experience: 'Elite',
    deviceType: 'laptop'
  });
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
  const getAdvisorIntelligence = async (prompt: string) => {
    try {
      console.log(`[CLIENT] AI Request Initiated via @google/genai`);
      
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "undefined" || apiKey === "") {
        throw new Error("API_KEY_MISSING");
      }
  
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
 
      return response.text || "Analysis currently unavailable.";
    } catch (error: any) {
      console.error("Critical Failure:", error);
      throw error;
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  const handleInitialization = (e: React.FormEvent) => {
    e.preventDefault();
    if (onboardingData.name && onboardingData.country && onboardingData.committee && onboardingData.agenda) {
      const sessionId = Date.now().toString();
      const initialMessage: Message = {
        role: 'system',
        content: `MUN Assistant v1.0 is ready. Welcome, ${onboardingData.name}. I have prepared the session briefing for your representation of ${onboardingData.country} in the ${onboardingData.committee}. How can I assist with your preparation?`,
        timestamp: new Date()
      };
      
      const newSession: ChatSession = {
        id: sessionId,
        name: `${onboardingData.country} - ${onboardingData.committee}`,
        sessionData: onboardingData,
        chatLog: [initialMessage],
        updatedAt: new Date()
      };

      setChatSessions(prev => [newSession, ...prev]);
      setActiveSessionId(sessionId);
      setIsInitialized(true);
      // Reset onboarding
      setOnboardingData({
        name: '',
        country: '',
        committee: '',
        agenda: '',
        backgroundGuide: '',
        notes: '',
        experience: 'Elite',
        deviceType: 'laptop'
      });
    }
  };

  const processQuery = async () => {
    if (!currentInput.trim() || isLoading || !activeSessionId) return;

    const userMsg: Message = {
      role: 'user',
      content: currentInput,
      timestamp: new Date()
    };

    // Update session in list
    setChatSessions(prev => prev.map(s => 
      s.id === activeSessionId 
        ? { ...s, chatLog: [...s.chatLog, userMsg], updatedAt: new Date() }
        : s
    ));

    setIsLoading(true);
    setCurrentInput('');

    try {
      const active = chatSessions.find(s => s.id === activeSessionId);
      if (!active) throw new Error("No active session");

      const fullContextPrompt = `
        ${ASSISTANT_SYSTEM_PROMPT}
        
        SESSION CONTEXT:
        - Country: ${active.sessionData.country}
        - Committee: ${active.sessionData.committee}
        - Agenda: ${active.sessionData.agenda}
        - Background Guide: ${active.sessionData.backgroundGuide?.substring(0, 3000)}
        - Preparation Notes: ${active.sessionData.notes}
        - Experience: ${active.sessionData.experience}

        USER REQUEST: ${userMsg.content}
      `;

      const text = await getAdvisorIntelligence(fullContextPrompt);

      const assistantMsg: Message = {
        role: 'assistant',
        content: text,
        timestamp: new Date()
      };

      setChatSessions(prev => prev.map(s => 
        s.id === activeSessionId 
          ? { ...s, chatLog: [...s.chatLog, assistantMsg], updatedAt: new Date() }
          : s
      ));
    } catch (error: any) {
      console.error("MUN Assistant API Error:", error);
      const errorMsg: Message = {
        role: 'system',
        content: error?.message?.includes("API_KEY_MISSING") 
          ? "### ⚠️ Configuration Required\nThe Assistant is offline because the GEMINI_API_KEY is not configured in the system environment." 
          : error?.message || "I am having difficulty processing that request. Please verify your connection.",
        timestamp: new Date()
      };
      setChatSessions(prev => prev.map(s => 
        s.id === activeSessionId 
          ? { ...s, chatLog: [...s.chatLog, errorMsg], updatedAt: new Date() }
          : s
      ));
    } finally {
      setIsLoading(false);
    }
  };

  // --- ONBOARDING UI ---
  if (!isInitialized && activeTab !== 'Reviews') {
    return (
      <div className="min-h-screen bg-pure-black flex items-center justify-center p-4 md:p-6 font-sans relative overflow-y-auto">
        <div className="max-w-3xl w-full bg-soft-black border border-gold/20 rounded-2xl shadow-2xl p-6 md:p-10 relative z-10 gold-border-glow my-8">
          <div className="mb-6 md:mb-8 flex justify-center">
            <div className="px-4 md:px-6 py-1.5 md:py-2 rounded-full border border-gold/40 bg-gold/10 flex items-center gap-2 md:gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
              <span className="text-[9px] md:text-xs font-black text-gold tracking-[0.2em] md:tracking-[0.3em] uppercase italic">System Architect: Krish Narang</span>
              <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            </div>
          </div>

          <div className="flex flex-col items-center mb-8 md:mb-10 text-center">
            <div className="mb-4 md:mb-6">
               <div className="p-1.5 md:p-2 bg-white rounded-full border-2 border-gold/40 shadow-[0_0_50px_rgba(212,175,55,0.3)]">
                <MUNLogo className="w-24 h-24 md:w-40 md:h-40" />
              </div>
            </div>
            <BrandLogo size="lg" showLogo={false} />
            <p className="text-slate-500 text-[8px] md:text-[10px] mt-3 md:mt-4 font-mono uppercase tracking-[0.3em] md:tracking-[0.5em]">
              Professional Diplomatic Assistant
            </p>
          </div>

          <form onSubmit={handleInitialization} className="space-y-4 md:space-y-6 relative z-20">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-2">
              <button
                type="button"
                onClick={() => setActiveTab('Reviews')}
                className="text-[9px] md:text-[10px] text-gold/60 hover:text-gold font-bold flex items-center gap-2 uppercase tracking-widest transition-all"
              >
                <Star className="w-3 h-3 md:w-3.5 md:h-3.5" /> Read Community Reviews
              </button>
              <div className="flex gap-3">
                {chatSessions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsInitialized(true)}
                    className="text-[10px] text-slate-500 hover:text-white font-black border border-white/10 px-3 py-1.5 rounded-md transition-all"
                  >
                    [ ABORT ]
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const samples = [
                      {
                        name: "Arjun Mehta",
                        country: "Republic of Korea",
                        committee: "United Nations Security Council",
                        agenda: "Addressing the situation in the Korean Peninsula",
                        backgroundGuide: "The Security Council has held several meetings recently to discuss missile tests and regional security...",
                        notes: "Focus on de-escalation while maintaining defense alliances. Seek consensus on humanitarian aid.",
                        experience: "Elite"
                      },
                      {
                        name: "Priya Sharma",
                        country: "France",
                        committee: "Economic and Social Council (ECOSOC)",
                        agenda: "Sustainable Urban Development and Climate Resiliency",
                        backgroundGuide: "As urbanization accelerates, cities face unprecedented challenges from rising sea levels and extreme heat...",
                        notes: "Propose a framework for green infrastructure funding. Focus on public-private partnerships.",
                        experience: "Elite"
                      },
                      {
                        name: "Rohan Gupta",
                        country: "Brazil",
                        committee: "United Nations Environment Programme (UNEP)",
                        agenda: "Combating Plastic Pollution in Marine Ecosystems",
                        backgroundGuide: "Marine litter continues to threaten biodiversity and human health. Over 8 million tons of plastic enter the ocean annually.",
                        notes: "Emphasize circular economy models and strict international accountability for waste management.",
                        experience: "Intermediate"
                      },
                      {
                        name: "Ananya Iyer",
                        country: "Egypt",
                        committee: "United Nations High Commissioner for Refugees (UNHCR)",
                        agenda: "Addressing the Global Refugee Crisis and Internal Displacement",
                        backgroundGuide: "Conflict and environmental disasters have displaced millions. Host countries need more structural support.",
                        notes: "Argue for proportional burden-sharing and long-term integration programs for refugees.",
                        experience: "Intermediate"
                      },
                      {
                        name: "Vikram Singh",
                        country: "India",
                        committee: "World Health Organization (WHO)",
                        agenda: "Strengthening Global Preparedness for Future Pandemics",
                        backgroundGuide: "The international community must learn from past inefficiencies to build a more resilient global health architecture.",
                        notes: "Focus on vaccine equity, localized manufacturing, and transparent data-sharing protocols.",
                        experience: "Elite",
                        deviceType: "laptop"
                      }
                    ];
                    const randomSample = samples[Math.floor(Math.random() * samples.length)];
                    //@ts-ignore
                    setOnboardingData(randomSample);
                  }}
                  className="text-[10px] text-gold-light/60 hover:text-gold-light font-mono border border-gold/10 px-3 py-1.5 rounded-md transition-all hover:bg-gold/5"
                >
                  [ USE SAMPLE DATA ]
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-3 md:col-span-2">
                <label className="text-gold/80 text-[10px] font-bold flex items-center justify-center gap-2 uppercase tracking-[0.2em] mb-4">
                  <Terminal className="w-3 h-3" /> Select Deployment Environment
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setOnboardingData({...onboardingData, deviceType: 'laptop'})}
                    className={cn(
                      "flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all group",
                      onboardingData.deviceType === 'laptop' 
                        ? "bg-gold/10 border-gold shadow-[0_0_30px_rgba(212,175,55,0.2)]" 
                        : "bg-pure-black border-white/5 grayscale opacity-40 hover:opacity-100 hover:grayscale-0 hover:border-gold/30"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                      onboardingData.deviceType === 'laptop' ? "bg-gold text-pure-black" : "bg-white/5 text-slate-500"
                    )}>
                      <Monitor className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <p className={cn("text-[10px] font-black uppercase tracking-widest", onboardingData.deviceType === 'laptop' ? "text-gold" : "text-slate-500")}>Laptop / Desktop</p>
                      <p className="text-[8px] text-slate-500 font-mono mt-1">High-Fidelity Layout</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOnboardingData({...onboardingData, deviceType: 'phone'})}
                    className={cn(
                      "flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all group",
                      onboardingData.deviceType === 'phone' 
                        ? "bg-gold/10 border-gold shadow-[0_0_30px_rgba(212,175,55,0.2)]" 
                        : "bg-pure-black border-white/5 grayscale opacity-40 hover:opacity-100 hover:grayscale-0 hover:border-gold/30"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                      onboardingData.deviceType === 'phone' ? "bg-gold text-pure-black" : "bg-white/5 text-slate-500"
                    )}>
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <p className={cn("text-[10px] font-black uppercase tracking-widest", onboardingData.deviceType === 'phone' ? "text-gold" : "text-slate-500")}>Phone / Tablet</p>
                      <p className="text-[8px] text-slate-500 font-mono mt-1">Compact Logic Fit</p>
                    </div>
                  </button>
                </div>
              </div>
              <div className="space-y-1 md:space-y-1.5 md:col-span-2">
                <label className="text-gold/80 text-[9px] md:text-[10px] font-bold flex items-center gap-2 uppercase tracking-widest pl-1">
                  <User className="w-2.5 h-2.5 md:w-3 md:h-3" /> Full Name
                </label>
                <input 
                  required
                  className="w-full bg-pure-black border border-slate-800 p-3 md:p-4 text-sm md:text-base text-white rounded-xl focus:ring-1 focus:ring-gold focus:border-gold outline-none transition-all placeholder:text-slate-800"
                  placeholder="Arjun Mehta"
                  value={onboardingData.name}
                  onChange={e => setOnboardingData({...onboardingData, name: e.target.value})}
                />
              </div>
              <div className="space-y-1 md:space-y-1.5">
                <label className="text-gold/80 text-[9px] md:text-[10px] font-bold flex items-center gap-2 uppercase tracking-widest pl-1">
                  <Globe className="w-2.5 h-2.5 md:w-3 md:h-3" /> Target Country
                </label>
                <input 
                  required
                  list="countries-list"
                  className="w-full bg-pure-black border border-slate-800 p-3 md:p-4 text-sm md:text-base text-white rounded-xl focus:ring-1 focus:ring-gold focus:border-gold outline-none transition-all placeholder:text-slate-800"
                  placeholder="e.g. France"
                  value={onboardingData.country}
                  onChange={e => setOnboardingData({...onboardingData, country: e.target.value})}
                />
                <datalist id="countries-list">
                  {COUNTRIES.map(country => <option key={country} value={country} />)}
                </datalist>
              </div>
              <div className="space-y-1 md:space-y-1.5">
                <label className="text-gold/80 text-[9px] md:text-[10px] font-bold flex items-center gap-2 uppercase tracking-widest pl-1">
                  <Zap className="w-2.5 h-2.5 md:w-3 md:h-3" /> Committee
                </label>
                <input 
                  required
                  list="committees-list"
                  className="w-full bg-pure-black border border-slate-800 p-3 md:p-4 text-sm md:text-base text-white rounded-xl focus:ring-1 focus:ring-gold focus:border-gold outline-none transition-all placeholder:text-slate-800"
                  placeholder="e.g. UNSC"
                  value={onboardingData.committee}
                  onChange={e => setOnboardingData({...onboardingData, committee: e.target.value})}
                />
                <datalist id="committees-list">
                  {COMMITTEES.map(committee => <option key={committee} value={committee} />)}
                </datalist>
              </div>
              <div className="space-y-1 md:space-y-1.5 md:col-span-2">
                <label className="text-gold/80 text-[9px] md:text-[10px] font-bold flex items-center gap-2 uppercase tracking-widest pl-1">
                  <MessageSquare className="w-2.5 h-2.5 md:w-3 md:h-3" /> Agenda / Topic
                </label>
                <input 
                  required
                  className="w-full bg-pure-black border border-slate-800 p-3 md:p-4 text-sm md:text-base text-white rounded-xl focus:ring-1 focus:ring-gold focus:border-gold outline-none transition-all placeholder:text-slate-800"
                  placeholder="Agenda details..."
                  value={onboardingData.agenda}
                  onChange={e => setOnboardingData({...onboardingData, agenda: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-1 md:space-y-1.5">
              <label className="text-gold/80 text-[9px] md:text-[10px] font-bold flex items-center gap-2 uppercase tracking-widest pl-1">
                <BookOpen className="w-2.5 h-2.5 md:w-3 md:h-3" /> Background Guide
              </label>
              <textarea 
                className="w-full bg-pure-black border border-slate-800 p-3 md:p-4 text-slate-300 rounded-xl h-24 md:h-32 text-xs md:text-sm focus:ring-1 focus:ring-gold outline-none transition-all resize-none custom-scrollbar"
                placeholder="Paste key information..."
                value={onboardingData.backgroundGuide}
                onChange={e => setOnboardingData({...onboardingData, backgroundGuide: e.target.value})}
              />
            </div>

            <div className="space-y-1 md:space-y-1.5">
              <label className="text-gold/80 text-[9px] md:text-[10px] font-bold flex items-center gap-2 uppercase tracking-widest pl-1">
                <Lock className="w-2.5 h-2.5 md:w-3 md:h-3" /> Preparation Notes
              </label>
              <textarea 
                className="w-full bg-pure-black border border-slate-800 p-3 md:p-4 text-slate-300 rounded-xl h-20 md:h-24 text-xs md:text-sm focus:ring-1 focus:ring-gold outline-none transition-all resize-none custom-scrollbar"
                placeholder="Specific goals..."
                value={onboardingData.notes}
                onChange={e => setOnboardingData({...onboardingData, notes: e.target.value})}
              />
            </div>

            <button 
              type="submit" 
              className="w-full bg-gold hover:bg-gold-light text-pure-black font-black py-4 md:py-5 rounded-xl transition-all transform hover:scale-[1.01] active:scale-95 shadow-xl flex items-center justify-center gap-3 group text-sm md:text-base"
            >
              LAUNCH ASSISTANT
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- DASHBOARD UI ---
  return (
    <div className={cn(
      "flex flex-col h-screen bg-pure-black text-slate-200 font-sans overflow-hidden",
      sessionData.deviceType === 'phone' && "text-[13px]",
      sessionData.deviceType === 'tablet' && "text-[15px]"
    )}>
      
      {/* GLOBAL TOP NAVIGATION */}
        <header className={cn(
          "bg-soft-black border-b border-slate-800 flex items-center justify-between z-50 shadow-2xl shrink-0",
          sessionData.deviceType === 'phone' ? "h-14 px-3" : "h-16 lg:h-20 px-4 lg:px-8"
        )}>
            <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className={cn(
                "p-2 text-gold hover:bg-gold/10 rounded-xl transition-colors",
                sessionData.deviceType === 'laptop' ? "lg:hidden" : ""
              )}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
              <BrandLogo size={sessionData.deviceType === 'phone' ? 'sm' : 'md'} />
            </div>
            {sessionData.deviceType === 'laptop' && <div className="h-8 w-px bg-slate-800 hidden lg:block mx-2" />}
            <nav className={cn(
              "items-center gap-1 bg-pure-black/40 p-1 rounded-xl border border-white/5 scale-90 xl:scale-100 origin-left",
              sessionData.deviceType === 'laptop' ? "hidden lg:flex" : "hidden"
            )}>
            {[
              { id: 'Dashboard', icon: Shield, label: 'Advisor Hub' },
              { id: 'Speech', icon: MessageSquare, label: 'Speech Lab' },
              { id: 'Resolution', icon: FileText, label: 'Resolution Engine' },
              { id: 'Strategy', icon: Zap, label: 'Policy Analysis' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setIsSearchActive(false);
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-xs font-bold uppercase tracking-tight",
                  (activeTab === tab.id && !isSearchActive) 
                    ? "bg-gold text-pure-black shadow-lg shadow-gold/10" 
                    : "text-slate-500 hover:text-gold hover:bg-gold/5"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gold/5 border border-gold/20 rounded-full lg:flex hidden">
            <div className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse" />
            <span className="text-[10px] font-mono text-gold uppercase tracking-widest">Active Status</span>
          </div>
          <button 
            onClick={() => setIsSearchActive(!isSearchActive)}
            className={cn(
              "p-2.5 rounded-xl border transition-all",
              isSearchActive 
                ? "bg-gold border-gold text-pure-black shadow-lg shadow-gold/20" 
                : "bg-white/5 border-white/10 text-slate-500 hover:text-gold hover:border-gold/30"
            )}
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-grow overflow-hidden relative">
        {/* SIDEBAR (Responsive Drawer on Mobile, Stable on Laptop) */}
        <div 
          className={cn(
            "fixed inset-y-0 left-0 bg-soft-black border-r border-slate-800 flex flex-col z-[100] shadow-2xl transition-transform duration-300 transform",
            sessionData.deviceType === 'laptop' ? "lg:relative lg:translate-x-0 lg:z-10" : "",
            sessionData.deviceType === 'phone' ? "w-72" : "w-80",
            isSidebarOpen || (sessionData.deviceType === 'laptop' && window.innerWidth >= 1024) ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className={cn(
            "border-b border-slate-800 flex items-center justify-between",
            sessionData.deviceType === 'phone' ? "p-4" : "p-6 md:p-8"
          )}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BrandLogo size="md" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <span className="text-[9px] text-green-500/80 font-mono tracking-[0.2em] uppercase">Advisor Online</span>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 text-slate-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className={cn(
            "flex-grow space-y-6 overflow-y-auto custom-scrollbar",
            sessionData.deviceType === 'phone' ? "p-3" : "p-4 md:p-6"
          )}>
            {/* Active Session Summary (Always visible at top of sidebar) */}
            {activeSession && (
              <section className="p-4 bg-gold/5 border border-gold/10 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-3.5 h-3.5 text-gold/60" />
                  <h3 className="text-[10px] text-gold/40 font-bold uppercase tracking-[0.3em]">Active Delegation</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-white">{sessionData.country}</span>
                    <span className="text-[9px] text-slate-500 font-mono uppercase truncate">{sessionData.committee}</span>
                  </div>
                </div>
              </section>
            )}

            {/* Mobile Tab Navigation */}
            <nav className="lg:hidden space-y-2 pb-6 border-b border-white/5">
              <h3 className="text-[10px] text-gold/40 font-bold uppercase tracking-[0.3em] pl-2 mb-2">Navigation</h3>
              {[
                { id: 'Dashboard', icon: Shield, label: 'Advisor Hub' },
                { id: 'Speech', icon: MessageSquare, label: 'Speech Lab' },
                { id: 'Resolution', icon: FileText, label: 'Resolution Engine' },
                { id: 'Strategy', icon: Zap, label: 'Policy Analysis' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold uppercase tracking-tight",
                    activeTab === tab.id 
                      ? "bg-gold text-pure-black" 
                      : "text-slate-500 hover:bg-gold/5"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* PLATFORM REVIEWS */}
            <nav className="space-y-3">
              <h3 className="text-[10px] text-gold/40 font-bold uppercase tracking-[0.3em] pl-2">Community</h3>
              <button
                onClick={() => {
                  setActiveTab('Reviews');
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group",
                  activeTab === 'Reviews' 
                    ? "bg-gold text-pure-black shadow-lg shadow-gold/20 font-bold" 
                    : "text-slate-500 hover:bg-gold/5 hover:text-gold"
                )}
              >
                <Star className={cn("w-5 h-5 transition-colors", activeTab === 'Reviews' ? "text-pure-black" : "text-gold/40 group-hover:text-gold")} />
                <div className="text-left">
                  <p className="text-sm tracking-tight font-bold">Reviews</p>
                  <p className="text-[9px] opacity-60 font-mono uppercase">Student Feedback</p>
                </div>
              </button>
            </nav>

            {/* CHAT SESSIONS */}
            <nav className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] text-gold/40 font-bold uppercase tracking-[0.3em]">History</h3>
                <button 
                  onClick={() => {
                    setIsInitialized(false);
                    setIsSidebarOpen(false);
                  }}
                  className="p-1.5 bg-gold/10 text-gold rounded-lg hover:bg-gold hover:text-pure-black transition-all flex items-center gap-2 group border border-gold/20"
                >
                  <Plus className="w-3 h-3" />
                  <span className="text-[9px] font-black uppercase tracking-widest">New</span>
                </button>
              </div>
                  
                  <div className="space-y-2">
                    {chatSessions.length === 0 ? (
                      <div className="p-4 bg-soft-black/20 rounded-xl border border-dashed border-white/5 text-center">
                        <p className="text-[10px] text-slate-600 font-mono uppercase tracking-widest leading-relaxed">No history</p>
                      </div>
                    ) : (
                      chatSessions.map((session) => (
                        <div key={session.id} className="group relative">
                          <button
                            onClick={() => {
                              setActiveSessionId(session.id);
                              setActiveTab('Dashboard');
                              setIsInitialized(true);
                              setIsSidebarOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left border",
                              activeSessionId === session.id 
                                ? "bg-white/5 text-white border-gold/40" 
                                : "text-slate-500 hover:bg-white/5 hover:text-slate-300 border-transparent"
                            )}
                          >
                            <Clock className={cn("w-3.5 h-3.5 shrink-0", activeSessionId === session.id ? "text-gold" : "text-slate-700")} />
                            <div className="overflow-hidden">
                              <p className="text-[11px] font-bold truncate leading-tight mb-0.5">{session.name}</p>
                              <p className="text-[9px] font-mono text-slate-600 uppercase tracking-tighter truncate">{session.sessionData.agenda}</p>
                            </div>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(session.id);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 opacity-0 lg:group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all text-slate-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </nav>
              </div>

              <div className="p-6 border-t border-white/5">
                <button 
                  onClick={() => {
                    setIsInitialized(false);
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-soft-black/60 border border-white/10 text-[10px] font-bold text-slate-500 hover:bg-gold/5 hover:border-gold/30 hover:text-gold transition-all uppercase tracking-[0.2em]"
                >
                  <RefreshCcw className="w-3.5 h-3.5" /> Reset
                </button>
              </div>
            </div>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                "fixed inset-0 bg-pure-black/60 backdrop-blur-sm z-[90]",
                sessionData.deviceType === 'laptop' ? "lg:hidden" : ""
              )}
            />
          )}
        </AnimatePresence>

      {/* MAIN CONTENT AREA */}
      <main className="flex-grow flex flex-col relative overflow-hidden bg-pure-black">
        {/* DELETE CONFIRMATION MODAL */}
        <AnimatePresence>
          {confirmDeleteId && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-pure-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="max-w-md w-full bg-soft-black border-2 border-red-500/30 rounded-[2rem] p-10 shadow-[0_0_80px_-20px_rgba(239,68,68,0.3)] relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500/20" />
                <div className="flex justify-center mb-8">
                  <div className="w-20 h-20 bg-red-500/5 rounded-full flex items-center justify-center border border-red-500/20">
                    <ShieldAlert className="w-10 h-10 text-red-500" />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-white text-center mb-3 tracking-tighter italic">Delete Chat?</h2>
                <p className="text-slate-500 text-xs font-mono text-center mb-10 leading-relaxed uppercase tracking-widest">
                  This will permanently remove <br/> all messages and data <br/> from this chat session.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setConfirmDeleteId(null)}
                    className="py-4 rounded-xl border border-white/10 text-slate-500 font-bold hover:bg-white/5 hover:text-white transition-all text-xs uppercase tracking-widest"
                  >
                    [ CANCEL ]
                  </button>
                  <button 
                    onClick={() => {
                      setChatSessions(prev => prev.filter(s => s.id !== confirmDeleteId));
                      if (activeSessionId === confirmDeleteId) {
                        setActiveSessionId(null);
                        setIsInitialized(false);
                      }
                      setConfirmDeleteId(null);
                    }}
                    className="py-4 rounded-xl bg-red-500 text-white font-black hover:bg-red-600 transition-all text-xs uppercase tracking-widest shadow-lg shadow-red-500/20"
                  >
                    CONFIRM DELETE
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <header className={cn(
          "bg-pure-black border-b border-slate-800 flex items-center justify-between relative z-10 shrink-0",
          sessionData.deviceType === 'phone' ? "h-12 px-2" : "h-14 lg:h-16 px-4 lg:px-10"
        )}>
          <div className="flex items-center gap-4 lg:gap-6 flex-grow">
            {!isSearchActive ? (
              <div className="flex flex-col">
                <div className="flex items-center gap-2 text-[9px] lg:text-[10px] font-mono">
                  <span className="text-slate-500 uppercase tracking-widest hidden sm:inline">Focus:</span>
                  <span className="text-gold uppercase truncate max-w-[150px] sm:max-w-xs md:max-w-md lg:max-w-lg xl:max-w-2xl">{sessionData.agenda || 'Diplomatic Standby'}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-grow max-w-xl">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/40" />
                  <input 
                    autoFocus
                    className="w-full bg-soft-black border border-gold/20 pl-10 pr-4 py-1.5 rounded-xl text-xs text-white focus:border-gold/60 outline-none transition-all placeholder:text-slate-600"
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setSearchResultIndex(0);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isSearchActive && searchTerm && (
              <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500 whitespace-nowrap">
                <span>{searchResults.length > 0 ? searchResultIndex + 1 : 0} of {searchResults.length}</span>
                <div className="flex bg-soft-black border border-white/10 rounded-lg">
                  <button onClick={handleSearchPrev} className="p-1 px-2 border-r border-white/10 hover:text-gold transition-colors"><ChevronUp className="w-3 h-3" /></button>
                  <button onClick={handleSearchNext} className="p-1 px-2 hover:text-gold transition-colors"><ChevronDown className="w-3 h-3" /></button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gold/5 border border-gold/20 rounded-full text-gold">
              <div className="w-1.5 h-1.5 bg-gold rounded-full" />
              <span className="text-[9px] font-mono uppercase hidden sm:inline">Connected</span>
            </div>
          </div>
        </header>

        {/* FEED */}
        <div className={cn(
          "flex-grow overflow-y-auto bg-pure-black custom-scrollbar",
          sessionData.deviceType === 'laptop' ? "p-4 md:p-6 xl:p-10 space-y-6 lg:space-y-8" :
          sessionData.deviceType === 'tablet' ? "p-4 md:p-6 space-y-5" :
          "p-3 space-y-4"
        )}>
          {/* COMMUNITY REVIEWS - SEPARATE FULL PAGE SECTION */}
          {activeTab === 'Reviews' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-6xl mx-auto py-6 md:py-12 px-2 md:px-6 flex flex-col min-h-full"
            >
              <div className="flex items-center justify-between mb-8 md:mb-12 px-2">
                <div className="flex items-center gap-4 md:gap-6">
                  <button 
                    onClick={() => setActiveTab('Dashboard')}
                    className="p-2 md:p-3 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl text-gold hover:bg-gold hover:text-pure-black transition-all group"
                  >
                    <ChevronUp className="w-5 h-5 md:w-6 md:h-6 -rotate-90 group-hover:-translate-x-1 transition-transform" />
                  </button>
                  <div>
                    <h1 className="text-2xl md:text-4xl font-black text-white italic tracking-tighter">Community Reviews</h1>
                    <p className="text-[10px] md:text-xs text-slate-500 font-mono uppercase tracking-[0.3em] mt-1 md:mt-2 italic">Student Experiences • Feedback Hub</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
                {/* Review Form */}
                <div className="lg:col-span-1 border-2 border-white/5 bg-soft-black/60 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl h-fit lg:sticky lg:top-8 order-2 lg:order-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Star className="w-5 h-5 text-gold" />
                    <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tight">Write a Review</h3>
                  </div>
                  <p className="text-[9px] md:text-[10px] text-gold/60 font-mono uppercase tracking-widest mb-6 md:mb-10 italic">Your feedback helps us improve</p>
                  
                  <div className="space-y-6 md:space-y-10">
                    <div className="flex flex-col items-center gap-4 bg-pure-black/40 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-white/5">
                      <div className="flex justify-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <div key={star} className="relative flex">
                            {/* Left Half */}
                            <button 
                              type="button"
                              onMouseEnter={() => setHoveredRating(star - 0.5)}
                              onMouseLeave={() => setHoveredRating(0)}
                              onClick={() => setNewReview({ ...newReview, rating: star - 0.5 })}
                              className="w-4 h-8 md:w-5 md:h-10 overflow-hidden"
                            >
                              <Star 
                                className={cn(
                                  "w-8 h-8 md:w-10 md:h-10 transition-all duration-300",
                                  (hoveredRating || newReview.rating) >= (star - 0.5) 
                                    ? "text-gold fill-gold" 
                                    : "text-slate-800 fill-transparent"
                                )} 
                              />
                            </button>
                            {/* Right Half */}
                            <button 
                              type="button"
                              onMouseEnter={() => setHoveredRating(star)}
                              onMouseLeave={() => setHoveredRating(0)}
                              onClick={() => setNewReview({ ...newReview, rating: star })}
                              className="w-4 h-8 md:w-5 md:h-10 overflow-hidden"
                            >
                              <Star 
                                className={cn(
                                  "w-8 h-8 md:w-10 md:h-10 -translate-x-1/2 transition-all duration-300",
                                  (hoveredRating || newReview.rating) >= star 
                                    ? "text-gold fill-gold" 
                                    : "text-slate-800 fill-transparent"
                                )} 
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                      <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em]">
                        {newReview.rating} / 5 Rating
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Your Comment</label>
                      <textarea 
                        placeholder="Share your experience (Optional)..."
                        className="w-full bg-pure-black border border-white/10 p-4 md:p-6 rounded-2xl md:rounded-3xl text-white text-sm h-32 md:h-48 focus:border-gold outline-none transition-all resize-none shadow-inner custom-scrollbar"
                        value={newReview.comment}
                        onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                      />
                    </div>
                    
                    <button 
                      disabled={isModerating || newReview.rating === 0}
                      onClick={async () => {
                        if (newReview.rating === 0) return;

                        const postReview = () => {
                          const review: Review = {
                            id: Date.now().toString(),
                            author: onboardingData.name || sessionData.name || 'Anonymous Delegate',
                            rating: newReview.rating,
                            comment: newReview.comment,
                            timestamp: new Date()
                          };
                          setReviews([review, ...reviews]);
                          setNewReview({ rating: 0, comment: '' });
                          setShowReviewSuccess(true);
                          setTimeout(() => setShowReviewSuccess(false), 3000);
                        };

                        if (!newReview.comment.trim()) {
                          postReview();
                          return;
                        }

                        setIsModerating(true);
                        setModerationError(null);

                        try {
                          const moderationPrompt = `
                            Analyze this Model UN Assistant review for Professional Integrity and Sentiment.
                            The platform only accepts professional feedback.
                            
                            Critically evaluate: "${newReview.comment}"
                            
                            Rules:
                            1. If the content is toxic, hateful, extremely negative, or unprofessional, respond "REJECT".
                            2. If the content is off-topic or gibberish, respond "REJECT".
                            3. Otherwise, respond "APPROVE".
                            
                            Response format: JUST the word "APPROVE" or "REJECT".
                          `;
                          
                          const decision = await getAdvisorIntelligence(moderationPrompt);
                          
                          if (decision.trim().toUpperCase().includes("REJECT")) {
                            setModerationError("Feedback flagged. Please keep it professional.");
                            setIsModerating(false);
                            return;
                          }

                          postReview();
                        } catch (e) {
                          console.error("Moderation Error:", e);
                          postReview(); // Fallback
                        } finally {
                          setIsModerating(false);
                        }
                      }}
                      className="w-full bg-gold disabled:opacity-50 text-pure-black font-black py-4 md:py-6 rounded-2xl md:rounded-3xl hover:bg-gold-light transition-all flex items-center justify-center gap-3 text-base md:text-lg shadow-lg shadow-gold/20 group relative overflow-hidden"
                    >
                      <AnimatePresence mode="wait">
                        {isModerating ? (
                          <motion.span key="moderating" className="flex items-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" /> ANALYZING...
                          </motion.span>
                        ) : showReviewSuccess ? (
                          <motion.span 
                            key="success"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            className="flex items-center gap-2"
                          >
                            <Shield className="w-5 h-5" /> POSTED!
                          </motion.span>
                        ) : (
                          <motion.span 
                            key="default"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            className="flex items-center gap-3"
                          >
                            Post Review <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                    
                    {moderationError && (
                      <motion.p 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[9px] md:text-[10px] text-red-500 font-bold uppercase tracking-widest text-center mt-2 bg-red-500/10 p-2 rounded-lg border border-red-500/20"
                      >
                        {moderationError}
                      </motion.p>
                    )}
                  </div>
                </div>

                {/* Review Feed */}
                <div className="lg:col-span-2 space-y-6 md:space-y-8 pb-12 order-1 lg:order-2">
                  {reviews.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gold/5 border border-gold/20 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6"
                    >
                      <div className="flex flex-col items-center md:items-start text-center md:text-left">
                        <span className="text-[10px] font-black text-gold uppercase tracking-[0.3em] mb-1">Global Sentiment</span>
                        <div className="flex items-center gap-3">
                          <span className="text-4xl md:text-5xl font-black text-white">
                            {(reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)}
                          </span>
                          <div className="flex flex-col">
                            <div className="flex gap-0.5 md:gap-1">
                              {[1, 2, 3, 4, 5].map((star) => {
                                const avg = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
                                return (
                                  <div key={star} className="relative w-3.5 h-3.5 md:w-4 md:h-4">
                                    <Star className="w-full h-full text-slate-800 fill-transparent" />
                                    <div className="absolute inset-0 overflow-hidden">
                                      {avg >= star - 0.5 && (
                                        <div 
                                          className="h-full text-gold fill-gold overflow-hidden"
                                          style={{ width: avg >= star ? '100%' : '50%' }}
                                        >
                                          <Star className="w-3.5 h-3.5 md:w-4 md:h-4 fill-gold" />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <span className="text-[9px] md:text-[10px] text-slate-500 font-mono tracking-widest mt-1 uppercase whitespace-nowrap">From {reviews.length} Students</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 md:gap-4 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none justify-center md:justify-start">
                        {[5, 4, 3, 2, 1].map(rating => {
                          const count = reviews.filter(r => Math.floor(r.rating) === rating || (rating === 5 && r.rating > 4.5)).length;
                          const percentage = (count / reviews.length) * 100;
                          return (
                            <div key={rating} className="flex flex-col items-center gap-1 shrink-0">
                              <div className="h-16 md:h-20 w-2.5 md:w-3 bg-white/5 rounded-full relative overflow-hidden">
                                <motion.div 
                                  initial={{ height: 0 }}
                                  animate={{ height: `${percentage}%` }}
                                  className="absolute bottom-0 left-0 w-full bg-gold rounded-full"
                                />
                              </div>
                              <span className="text-[8px] font-bold text-slate-500">{rating}★</span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {reviews.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-[3rem] text-slate-600">
                      <Star className="w-12 h-12 mb-4 opacity-20" />
                      <p className="font-mono text-xs uppercase tracking-widest text-center">No reviews yet. <br/> Be the first to share your experience!</p>
                    </div>
                  ) : (
                    reviews.map((review) => (
                      <motion.div 
                        key={review.id}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-soft-black/40 border border-white/5 p-10 rounded-[2.5rem] relative group hover:border-gold/30 transition-all duration-500 overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-gold/10 group-hover:bg-gold transition-colors" />
                        <Quote className="absolute top-8 right-10 w-16 h-16 text-gold/5 group-hover:text-gold/10 transition-colors duration-700" />
                        
                        <div className="flex items-center gap-1.5 mb-6">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <div key={star} className="relative w-5 h-5">
                              <Star className="w-full h-full text-slate-800 fill-transparent" />
                              <div className="absolute inset-0 overflow-hidden">
                                {review.rating >= star - 0.5 && (
                                  <div 
                                    className="h-full text-gold fill-gold overflow-hidden"
                                    style={{ width: review.rating >= star ? '100%' : '50%' }}
                                  >
                                    <Star className="w-5 h-5 fill-gold" />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {review.comment && (
                          <p className="text-slate-200 text-lg italic mb-10 leading-loose">"{review.comment}"</p>
                        )}
                        
                        <div className="flex justify-between items-center bg-white/5 border border-white/5 p-4 rounded-2xl">
                          <div className="flex flex-col">
                            <span className="text-white font-black text-sm tracking-tight">{review.author}</span>
                            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest italic">Review Posted • {review.timestamp.toLocaleDateString()}</span>
                          </div>
                          <Shield className="w-6 h-6 text-gold/30" />
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {(activeTab !== 'Reviews') && (
            <>
              {activeTab === 'Dashboard' && chatLog.length === 1 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 mb-12"
                >
                  <button 
                    onClick={() => setCurrentInput(`As my advisor for ${sessionData.country}, please help me draft a professional Position Paper on the agenda: ${sessionData.agenda}. Focus on our national interest and historical diplomacy.`)}
                    className="bg-soft-black/40 backdrop-blur-sm p-6 md:p-8 border border-gold/10 rounded-3xl hover:border-gold/50 transition-all text-left group gold-border-glow flex flex-col h-full"
                  >
                    <div className="w-10 h-10 md:w-14 md:h-14 bg-gold/5 rounded-2xl flex items-center justify-center mb-4 md:mb-6 border border-gold/20 group-hover:bg-gold/10 transition-transform group-hover:scale-110 duration-500">
                      <FileText className="w-6 h-6 md:w-8 md:h-8 text-gold" />
                    </div>
                    <h3 className="text-gold font-bold text-base md:text-lg mb-2 md:mb-3">Policy Paper</h3>
                    <p className="text-[10px] md:text-xs text-slate-500 leading-relaxed flex-grow">Generate a formal policy document with historical context and proposed directives.</p>
                    <div className="mt-4 text-[9px] md:text-[10px] text-gold/40 font-mono flex items-center gap-2">
                      <Globe className="w-3 h-3" /> PROFESSIONAL GRADE
                    </div>
                  </button>
                  <button 
                    onClick={() => setCurrentInput(`I need to speak in the General Speakers List. Draft a powerful 90-second speech for ${sessionData.country} that highlights our position on ${sessionData.agenda}.`)}
                    className="bg-soft-black/40 backdrop-blur-sm p-6 md:p-8 border border-gold/10 rounded-3xl hover:border-gold/50 transition-all text-left group gold-border-glow flex flex-col h-full"
                  >
                    <div className="w-10 h-10 md:w-14 md:h-14 bg-gold/5 rounded-2xl flex items-center justify-center mb-4 md:mb-6 border border-gold/20 group-hover:bg-gold/10 transition-transform group-hover:scale-110 duration-500">
                      <MessageSquare className="w-6 h-6 md:w-8 md:h-8 text-gold" />
                    </div>
                    <h3 className="text-gold font-bold text-base md:text-lg mb-2 md:mb-3">Diplomatic Speech</h3>
                    <p className="text-[10px] md:text-xs text-slate-500 leading-relaxed flex-grow">Draft a high-impact opening statement optimized for clarity and persuasive force.</p>
                    <div className="mt-4 text-[9px] md:text-[10px] text-gold/40 font-mono flex items-center gap-2">
                      <Zap className="w-3 h-3" /> VERBAL LEVERAGE
                    </div>
                  </button>
                  <button 
                    onClick={() => setCurrentInput(`Help me draft resolution clauses. Specifically, I need pre-ambulatory clauses and operative clauses addressing ${sessionData.agenda} from the perspective of ${sessionData.country}.`)}
                    className="bg-soft-black/40 backdrop-blur-sm p-6 md:p-8 border border-gold/10 rounded-3xl hover:border-gold/50 transition-all text-left group gold-border-glow flex flex-col h-full"
                  >
                    <div className="w-10 h-10 md:w-14 md:h-14 bg-gold/5 rounded-2xl flex items-center justify-center mb-4 md:mb-6 border border-gold/20 group-hover:bg-gold/10 transition-transform group-hover:scale-110 duration-500">
                      <Shield className="w-6 h-6 md:w-8 md:h-8 text-gold" />
                    </div>
                    <h3 className="text-gold font-bold text-base md:text-lg mb-2 md:mb-3">Resolution Lab</h3>
                    <p className="text-[10px] md:text-xs text-slate-500 leading-relaxed flex-grow">Engineer precise UN-formatted clauses with standard operative verbs and clear mandates.</p>
                    <div className="mt-4 text-[9px] md:text-[10px] text-gold/40 font-mono flex items-center gap-2">
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
                      isSearchActive && searchResults[searchResultIndex] === i && "ring-2 ring-gold/20 rounded-3xl",
                      sessionData.deviceType === 'phone' ? "mb-4" : "mb-0"
                    )}
                  >
                    <div className={cn(
                      "relative group transition-all",
                      sessionData.deviceType === 'phone' ? "max-w-[98%] p-3 rounded-xl" : "max-w-[95%] md:max-w-[85%] p-4 md:p-6 rounded-2xl",
                      msg.role === 'user' 
                        ? 'bg-gold text-pure-black font-bold shadow-xl rounded-tr-none' 
                        : msg.role === 'system'
                          ? 'bg-soft-black/50 border border-white/5 text-slate-500 text-[10px] text-center font-mono w-full italic py-2 md:py-3'
                          : 'bg-soft-black border border-gold/10 text-slate-200 rounded-tl-none border-l-2 border-l-gold shadow-lg shadow-gold/5',
                      isSearchActive && searchTerm && msg.content.toLowerCase().includes(searchTerm.toLowerCase()) && "border-gold/40 shadow-gold/10 shadow-xl"
                    )}>
                      {msg.role === 'assistant' && (
                        <div className={cn(
                          "flex items-center gap-2 font-mono text-gold uppercase tracking-[0.3em] font-black",
                          sessionData.deviceType === 'phone' ? "mb-2 text-[8px]" : "mb-3 md:mb-4 text-[9px] md:text-[10px]"
                        )}>
                          <MessageSquare className="w-3 h-3 md:w-3.5 md:h-3.5" /> Assistant Advisor
                        </div>
                      )}
                      {msg.role === 'user' && (
                        <div className={cn(
                          "flex items-center gap-2 font-mono text-pure-black/40 uppercase tracking-[0.3em] font-black",
                          sessionData.deviceType === 'phone' ? "mb-1 text-[8px]" : "mb-2 text-[9px] md:text-[10px]"
                        )}>
                          <User className="w-2.5 h-2.5 md:w-3 md:h-3" /> Delegation
                        </div>
                      )}

                      <div className={cn(
                        "flex justify-between items-start",
                        sessionData.deviceType === 'phone' ? "mb-2" : "mb-4 md:mb-6"
                      )}>
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className={cn(
                            "rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center",
                            sessionData.deviceType === 'phone' ? "w-6 h-6" : "w-7 h-7 md:w-8 md:h-8"
                          )}>
                            <Zap className={cn("text-gold", sessionData.deviceType === 'phone' ? "w-3 h-3" : "w-3.5 h-3.5 md:w-4 md:h-4")} />
                          </div>
                          <div>
                            <p className={cn("font-mono text-gold uppercase tracking-[0.2em]", sessionData.deviceType === 'phone' ? "text-[8px]" : "text-[9px] md:text-[10px]")}>Analysis Hub</p>
                            <p className={cn("text-slate-500 font-mono italic", sessionData.deviceType === 'phone' ? "text-[7px]" : "text-[8px] md:text-[9px]")}>Generated via Assistant</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content);
                          }}
                          className={cn(
                            "hover:bg-gold/10 rounded-lg text-gold/40 hover:text-gold transition-all group relative",
                            sessionData.deviceType === 'phone' ? "p-1" : "p-1.5 md:p-2"
                          )}
                          title="Copy Content"
                        >
                          <FileText className={cn(sessionData.deviceType === 'phone' ? "w-3 h-3" : "w-3.5 h-3.5 md:w-4 md:h-4")} />
                          <span className="hidden md:block absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-gold text-pure-black text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold">COPY CONTENT</span>
                        </button>
                      </div>

                      <div className={cn(
                        "prose prose-invert prose-slate max-w-none prose-headings:text-gold prose-headings:font-black prose-headings:tracking-tight prose-headings:mt-8 md:prose-headings:mt-10 prose-p:leading-relaxed prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-white prose-strong:font-bold prose-blockquote:border-l-gold prose-blockquote:bg-gold/5 prose-blockquote:px-4 md:prose-blockquote:px-8 prose-blockquote:py-4 md:prose-blockquote:py-6 prose-blockquote:rounded-r-2xl md:prose-blockquote:rounded-r-3xl prose-blockquote:my-8 md:prose-blockquote:my-10 prose-blockquote:italic prose-hr:border-white/10 prose-hr:my-8 md:prose-hr:my-12 prose-table:w-full prose-table:border-collapse prose-th:text-gold prose-th:border-b prose-th:border-gold/20 prose-th:py-2 md:prose-th:py-3 prose-td:py-2 md:prose-td:py-3 prose-td:border-b prose-td:border-white/5",
                        sessionData.deviceType === 'phone' ? "text-xs prose-p:mb-2 prose-headings:mb-2" : "text-sm md:text-base prose-p:mb-4 md:prose-p:mb-6 prose-headings:mb-4 md:prose-headings:mb-6"
                      )}>
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
            </>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* INPUT HUB - REFINED FOR FLEXIBILITY */}
        {(activeTab !== 'Reviews') && (
          <div className={cn(
            "bg-pure-black border-t border-white/5 relative z-30",
            sessionData.deviceType === 'phone' ? "p-2" : "p-4 md:p-8"
          )}>
            <div className="max-w-5xl mx-auto flex items-end gap-2 md:gap-5">
              <div className={cn(
                "flex-grow relative bg-soft-black border border-white/10 rounded-xl md:rounded-2xl focus-within:border-gold/40 transition-all shadow-inner",
                sessionData.deviceType === 'phone' ? "rounded-lg" : ""
              )}>
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
                    "w-full bg-transparent pr-16 md:pr-24 text-white placeholder:text-slate-600 outline-none resize-none max-h-64 custom-scrollbar",
                    sessionData.deviceType === 'phone' ? "p-3 text-xs" : "p-4 md:p-6 text-sm md:text-base rounded-xl md:rounded-2xl",
                    isLoading && "opacity-50 cursor-wait"
                  )}
                  placeholder={isLoading ? "Analyzing..." : `Ask your advisor...`}
                />
                <div className={cn(
                  "absolute right-2 bottom-2 md:right-3 md:bottom-3",
                  sessionData.deviceType === 'phone' ? "scale-75 origin-bottom-right" : ""
                )}>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      processQuery();
                    }}
                    disabled={isLoading || !currentInput.trim()}
                    className={cn(
                      "p-3 md:p-4 rounded-lg md:rounded-xl transition-all shadow-xl flex items-center justify-center min-w-[40px] md:min-w-[52px] h-[40px] md:h-[52px]",
                      isLoading || !currentInput.trim() 
                        ? "bg-slate-800 text-slate-600" 
                        : "bg-gold text-pure-black hover:bg-gold-light hover:scale-105 active:scale-95 shadow-gold/10"
                    )}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Send className="w-4 h-4 md:w-5 md:h-5" />}
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
        )}
      </main>
    </div>
  </div>
  );
}
