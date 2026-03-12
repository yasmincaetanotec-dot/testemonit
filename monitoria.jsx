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
 * CONFIGURAÇÃO PARA DEPLOY (VERCEL/NETLIFY):
 * 1. Preset no Vercel: "Create React App"
 * 2. Certifique-se de que o ficheiro 'package.json' existe na raiz.
 * 3. As dependências necessárias são: firebase e lucide-react.
 */

// Configurações globais fornecidas pelo ambiente
// No Vercel, estas variáveis devem ser configuradas em 'Environment Variables'
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
  
  // --- DATABASE STATE ---
  const [atendimentos, setAtendimentos] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- AI STATE ---
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);

  // --- AUTHENTICATION ---
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

  // --- FIRESTORE DATA FETCHING ---
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

  // --- ACTIONS ---
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

  // --- GEMINI API ---
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
      setAiResult("Ocorreu um erro ao consultar a IA. Verifique as configurações de rede.");
    } finally {
      setAiLoading(false);
    }
  };

  // --- CALCULATIONS ---
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
          <p className="text-slate-500 font-medium">A ligar ao Firebase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col">
        <div className="flex items-center space-x-2 mb-10">
          <div className="bg-indigo-600 p-2 rounded-lg"><BookOpen className="text-white" size={20} /></div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight text-center">MONITORIA CLOUD</h1>
        </div>
        <nav className="space-y-2 flex-1">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><LayoutDashboard size={18}/> Dashboard</button>
          <button onClick={() => setActiveTab('atendimentos')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${activeTab === 'atendimentos' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><MessageSquare size={18}/> Atendimentos</button>
          <button onClick={() => setActiveTab('projetos')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${activeTab === 'projetos' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><Database size={18}/> Projetos</button>
        </nav>
        <div className="mt-auto p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">Sincronizado</p>
          </div>
          <p className="text-[10px] font-mono text-indigo-300 truncate">{user?.uid}</p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 capitalize">{activeTab}</h2>
            <p className="text-sm text-slate-400">Dados persistidos no Firestore</p>
          </div>
          <button 
            onClick={addAtendimentoRapido}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 active:scale-95"
          >
            <Plus size={18} /> Novo Atendimento
          </button>
        </header>

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-7 rounded-3xl shadow-sm border border-slate-100">
              <div className="bg-blue-50 text-blue-600 w-10 h-10 rounded-xl flex items-center justify-center mb-4"><MessageSquare size={20}/></div>
              <p className="text-slate-400 text-xs font-bold uppercase mb-1 tracking-tight">Total Atendimentos</p>
              <p className="text-3xl font-black text-slate-800">{kpis.total}</p>
            </div>
            <div className="bg-white p-7 rounded-3xl shadow-sm border border-slate-100">
              <div className="bg-indigo-50 text-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center mb-4"><Users size={20}/></div>
              <p className="text-slate-400 text-xs font-bold uppercase mb-1 tracking-tight">Grupos Ativos</p>
              <p className="text-3xl font-black text-slate-800">{kpis.groups}</p>
            </div>
            <div className="bg-white p-7 rounded-3xl shadow-sm border border-slate-100">
              <div className="bg-green-50 text-green-600 w-10 h-10 rounded-xl flex items-center justify-center mb-4"><TrendingUp size={20}/></div>
              <p className="text-slate-400 text-xs font-bold uppercase mb-1 tracking-tight">Progresso Médio</p>
              <p className="text-3xl font-black text-green-600">{kpis.progresso}%</p>
            </div>
          </div>
        )}

        {activeTab === 'atendimentos' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-5">Data</th>
                  <th className="p-5">Aluno / Grupo</th>
                  <th className="p-5">Dúvida</th>
                  <th className="p-5 text-right">Assistência IA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {atendimentos.length === 0 ? (
                  <tr><td colSpan="4" className="p-10 text-center text-slate-400 font-medium italic">Sem registos. Adicione um novo atendimento acima.</td></tr>
                ) : (
                  atendimentos.map(at => (
                    <tr key={at.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-5 text-slate-500 font-medium">{at.data}</td>
                      <td className="p-5">
                        <p className="font-bold text-slate-800">{at.aluno}</p>
                        <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">{at.grupo}</p>
                      </td>
                      <td className="p-5 text-slate-600 max-w-md">{at.duvida}</td>
                      <td className="p-5 text-right">
                        <button 
                          onClick={() => handleAiConsult(at)} 
                          className="bg-indigo-50 text-indigo-600 p-2 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                          title="Consultar Gemini"
                        >
                          <Sparkles size={18}/>
                        </button>
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 z-50">
            <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl">
              <div className="bg-indigo-600 p-5 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-lg"><Sparkles size={20}/></div>
                  <span className="font-bold text-lg">Sugestão do Assistente ✨</span>
                </div>
                <button onClick={() => setShowAiModal(false)} className="hover:bg-white/20 p-1.5 rounded-full transition"><X size={22}/></button>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto">
                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Loader2 className="animate-spin text-indigo-600 mb-4" size={32}/>
                    <p className="text-slate-400 font-medium">A analisar conhecimentos de BD...</p>
                  </div>
                ) : (
                  <div className="prose prose-indigo max-w-none">
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                      {aiResult}
                    </p>
                  </div>
                )}
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setShowAiModal(false)}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
