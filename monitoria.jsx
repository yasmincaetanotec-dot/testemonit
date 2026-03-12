import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, addDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  LayoutDashboard, Users, BookOpen, MessageSquare, Plus, 
  Search, AlertCircle, CheckCircle2, Clock, BarChart3,
  Filter, TrendingUp, Sparkles, Loader2, X, Database
} from 'lucide-react';

/**
 * 🚀 GUIA PARA RESOLVER O ERRO 404 NO VERCEL:
 * * 1. ESTRUTURA DE PASTAS: O Vercel precisa desta estrutura no seu repositório:
 * - /public
 * - index.html (O ficheiro principal que o browser lê)
 * - /src
 * - index.js (Onde faz o render do App)
 * - App.js (Ou este ficheiro monitoria_bd.jsx renomeado)
 * - package.json
 * * 2. DEFINIÇÕES NO VERCEL:
 * - Framework Preset: "Create React App"
 * - Output Directory: "build" (Certifique-se de que não está vazio)
 * * 3. FICHEIRO vercel.json (Opcional - Adicione na raiz para evitar 404 em rotas):
 * { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
 */

// Configurações globais
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { 
      apiKey: "SUA_API_KEY", 
      authDomain: "SEU_PROJECT_ID.firebaseapp.com", 
      projectId: "SEU_PROJECT_ID",
      storageBucket: "SEU_PROJECT_ID.appspot.com",
      messagingSenderId: "ID",
      appId: "ID"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'monitoria-bd-app';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);
  
  const [atendimentos, setAtendimentos] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Erro na autenticação:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const atendimentosCol = collection(db, 'artifacts', appId, 'public', 'data', 'atendimentos');
    const projetosCol = collection(db, 'artifacts', appId, 'public', 'data', 'projetos');

    const unsubAtendimentos = onSnapshot(atendimentosCol, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAtendimentos(data);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao buscar atendimentos:", error);
        setLoading(false);
      }
    );

    const unsubProjetos = onSnapshot(projetosCol, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProjetos(data);
      },
      (error) => console.error("Erro ao buscar projetos:", error)
    );

    return () => {
      unsubAtendimentos();
      unsubProjetos();
    };
  }, [user]);

  const addAtendimentoRapido = async () => {
    if (!user) return;
    try {
      const novo = {
        data: new Date().toISOString().split('T')[0],
        aluno: "Novo Aluno",
        grupo: "G01",
        duvida: "Dúvida registada via sistema",
        tempo: 15,
        dificuldade: "Média",
        tipo: "Presencial",
        ods: "ODS Geral"
      };
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'atendimentos'), novo);
    } catch (e) {
      console.error("Erro ao salvar:", e);
    }
  };

  const callGemini = async (prompt) => {
    const apiKey = ""; 
    const baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";
    
    const response = await fetch(`${baseUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    if (!response.ok) throw new Error("Falha na API");
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  };

  const handleAiConsult = async (at) => {
    setAiLoading(true);
    setShowAiModal(true);
    setAiResult(null);
    try {
      const res = await callGemini(`Sugira uma explicação técnica para a dúvida: ${at.duvida}. Contexto: Monitoria de Banco de Dados.`);
      setAiResult(res);
    } catch (e) {
      setAiResult("Ocorreu um erro ao consultar a IA.");
    } finally {
      setAiLoading(false);
    }
  };

  const kpis = useMemo(() => {
    const total = atendimentos.length;
    const groups = new Set(projetos.map(p => p.id)).size || 0;
    const progressoTotal = projetos.length > 0 
      ? projetos.reduce((acc, p) => acc + ((p.mer + p.relacional + p.sql) / 3), 0) / projetos.length 
      : 0;

    return { total, groups, progresso: Math.round(progressoTotal) };
  }, [atendimentos, projetos]);

  if (loading && !user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="animate-spin text-indigo-600 mb-4 mx-auto" size={40} />
          <p className="text-slate-500 font-medium italic font-serif">A estabelecer ligação segura...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col shadow-sm">
        <div className="flex items-center space-x-2 mb-10">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-100">
            <BookOpen className="text-white" size={20} />
          </div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">MONITORIA BD</h1>
        </div>
        <nav className="space-y-2 flex-1">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => setActiveTab('atendimentos')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${activeTab === 'atendimentos' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><MessageSquare size={18}/> Atendimentos</button>
          <button onClick={() => setActiveTab('projetos')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${activeTab === 'projetos' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><Database size={18}/> Projetos</button>
        </nav>
        <div className="mt-auto p-4 bg-slate-50 border border-slate-100 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Online</p>
          </div>
          <p className="text-[10px] font-mono text-slate-400 truncate">{user?.uid}</p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-800 capitalize tracking-tight">{activeTab}</h2>
            <p className="text-sm text-slate-400 font-medium">Gestão Académica Inteligente</p>
          </div>
          <button 
            onClick={addAtendimentoRapido}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-indigo-700 transition shadow-xl shadow-indigo-100 active:scale-95 font-bold text-sm"
          >
            <Plus size={18} /> Novo Registo
          </button>
        </header>

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="bg-blue-50 text-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-
