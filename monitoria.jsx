import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, getDoc, 
  onSnapshot, query, addDoc, updateDoc, deleteDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  LayoutDashboard, Users, BookOpen, MessageSquare, Plus, 
  Search, AlertCircle, CheckCircle2, Clock, BarChart3,
  Filter, TrendingUp, Sparkles, Loader2, X, Database
} from 'lucide-react';

// Configurações globais fornecidas pelo ambiente
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'monitoria-bd-app';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);
  
  // --- DATABASE STATE ---
  const [atendimentos, setAtendimentos] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- AI STATE ---
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);

  // --- AUTHENTICATION (RULE 3) ---
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

  // --- FIRESTORE DATA FETCHING (RULE 1 & 2) ---
  useEffect(() => {
    if (!user) return;

    // Caminho público para dados compartilhados entre monitores (RULE 1)
    const atendimentosCol = collection(db, 'artifacts', appId, 'public', 'data', 'atendimentos');
    const projetosCol = collection(db, 'artifacts', appId, 'public', 'data', 'projetos');

    const unsubAtendimentos = onSnapshot(atendimentosCol, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAtendimentos(data);
        setLoading(false);
      },
      (error) => console.error("Erro ao buscar atendimentos:", error)
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

  // --- ACTIONS ---
  const addAtendimentoRapido = async () => {
    if (!user) return;
    const novo = {
      data: new Date().toISOString().split('T')[0],
      aluno: "Novo Aluno",
      grupo: "G01",
      duvida: "Dúvida registrada via sistema",
      tempo: 15,
      dificuldade: "Média",
      tipo: "Presencial",
      ods: "ODS Geral"
    };
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'atendimentos'), novo);
  };

  // --- GEMINI API ---
  const callGemini = async (prompt) => {
    const apiKey = ""; 
    const baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";
    const response = await fetch(`${baseUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  };

  const handleAiConsult = async (at) => {
    setAiLoading(true);
    setShowAiModal(true);
    setAiResult(null);
    try {
      const res = await callGemini(`Sugira uma explicação técnica para a dúvida: ${at.duvida}. Contexto: Banco de Dados.`);
      setAiResult(res);
    } catch (e) {
      setAiResult("Erro ao consultar IA.");
    } finally {
      setAiLoading(false);
    }
  };

  // --- CALCULATIONS ---
  const kpis = useMemo(() => {
    const total = atendimentos.length;
    const groups = new Set(projetos.map(p => p.id)).size;
    const progressoTotal = projetos.length > 0 
      ? projetos.reduce((acc, p) => acc + ((p.mer + p.relacional + p.sql) / 3), 0) / projetos.length 
      : 0;

    return { total, groups, progresso: Math.round(progressoTotal) };
  }, [atendimentos, projetos]);

  if (loading && !user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar e Modal permanecem similares, mas com lógica de dados reais */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col">
        <div className="flex items-center space-x-2 mb-10">
          <div className="bg-indigo-600 p-2 rounded-lg"><BookOpen className="text-white" size={20} /></div>
          <h1 className="text-lg font-bold text-slate-800">MONITORIA CLOUD</h1>
        </div>
        <nav className="space-y-2 flex-1">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => setActiveTab('atendimentos')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg ${activeTab === 'atendimentos' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><MessageSquare size={18}/> Atendimentos</button>
          <button onClick={() => setActiveTab('projetos')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg ${activeTab === 'projetos' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><Database size={18}/> Projetos</button>
        </nav>
        <div className="mt-auto p-3 bg-indigo-50 rounded-xl">
          <p className="text-[10px] font-bold text-indigo-400 uppercase">Usuário Autenticado</p>
          <p className="text-xs font-mono text-indigo-700 truncate">{user?.uid}</p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-slate-800 capitalize">{activeTab}</h2>
          <button 
            onClick={addAtendimentoRapido}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition"
          >
            <Plus size={18} /> Novo Registro Real
          </button>
        </header>

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-slate-400 text-xs font-bold uppercase mb-1">Total Atendimentos</p>
              <p className="text-3xl font-black text-slate-800">{kpis.total}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-slate-400 text-xs font-bold uppercase mb-1">Grupos Ativos</p>
              <p className="text-3xl font-black text-slate-800">{kpis.groups}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-slate-400 text-xs font-bold uppercase mb-1">Progresso Geral</p>
              <p className="text-3xl font-black text-indigo-600">{kpis.progresso}%</p>
            </div>
          </div>
        )}

        {activeTab === 'atendimentos' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-xs font-bold uppercase">
                <tr>
                  <th className="p-4">Data</th>
                  <th className="p-4">Aluno</th>
                  <th className="p-4">Dúvida</th>
                  <th className="p-4 text-right">IA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {atendimentos.length === 0 ? (
                  <tr><td colSpan="4" className="p-8 text-center text-slate-400">Nenhum dado salvo no banco ainda.</td></tr>
                ) : (
                  atendimentos.map(at => (
                    <tr key={at.id} className="hover:bg-slate-50">
                      <td className="p-4 text-sm text-slate-500">{at.data}</td>
                      <td className="p-4 font-bold">{at.aluno} <span className="text-xs text-indigo-500">[{at.grupo}]</span></td>
                      <td className="p-4 text-sm text-slate-600">{at.duvida}</td>
                      <td className="p-4 text-right">
                        <button onClick={() => handleAiConsult(at)} className="text-indigo-600 hover:text-indigo-800"><Sparkles size={18}/></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal de IA */}
        {showAiModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
              <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                <span className="font-bold flex items-center gap-2"><Sparkles size={18}/> Resposta do Gemini</span>
                <button onClick={() => setShowAiModal(false)}><X size={20}/></button>
              </div>
              <div className="p-6">
                {aiLoading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600"/></div> : <p className="text-slate-700 text-sm leading-relaxed">{aiResult}</p>}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;