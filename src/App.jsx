import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, query, getDocs, 
  addDoc, updateDoc, doc, deleteDoc, 
  serverTimestamp, onSnapshot, orderBy, limit, startAfter, where, getCountFromServer
} from 'firebase/firestore';
import { 
  Shield, Plus, Copy, Clock, CheckCircle, 
  Check, Trash2, User, Lock, LogOut, Edit3,
  Search, Calendar, X, ChevronLeft, ChevronRight, Loader2, Target,
  QrCode, Link as LinkIcon, BarChart3, ChevronDown, ChevronUp, Filter,
  MousePointerClick, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 設定區域 ---
const firebaseConfig = {
  apiKey: "AIzaSyDNgh09rBbwPraEHFyTSo2cMmkJEApvvnQ",
  authDomain: "shooting-auth-manager.firebaseapp.com",
  projectId: "shooting-auth-manager",
  storageBucket: "shooting-auth-manager.firebasestorage.app",
  messagingSenderId: "1061676989723",
  appId: "1:1061676989723:web:2de6b7ea5bad8e5e7567be",
  measurementId: "G-EZT00FYYGE"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const appId = "school-system-v1"; 
const CODES_COLLECTION = 'verification_codes';
const HISTORIES_COLLECTION = 'histories'; 
const PAGE_SIZE = 10; 

// --- 工具函數 ---
const formatDate = (timestamp) => {
  if (!timestamp) return '尚未啟用';
  return new Date(timestamp.seconds * 1000).toLocaleString('zh-TW');
};
const formatDuration = (seconds) => {
  if (!seconds) return '0天';
  const d = Math.floor(seconds / (24 * 3600));
  if (d >= 99999) return '永久 (買斷)';
  return d > 0 ? `${d} 天` : '小於 1 天';
};
const copyToClipboard = (text) => {
  const el = document.createElement('textarea');
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
};
const generateSafeCode = (length = 8) => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; 
  let result = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

const isCodeExpired = (item) => {
  if (!item.expiresAt) return false; 
  const exp = new Date(item.expiresAt.seconds * 1000);
  return exp.getTime() < Date.now();
};

// --- 🍏 蘋果風 UI 元件 ---
const GlassButton = ({ children, onClick, className = "", disabled = false, type = "button", id }) => (
  <motion.button id={id} type={type} disabled={disabled} onClick={onClick} whileHover={{ scale: disabled ? 1 : 1.02 }} whileTap={{ scale: disabled ? 1 : 0.95 }}
    className={`relative overflow-hidden bg-white/10 backdrop-blur-md border border-white/20 shadow-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-white/20 ${className}`}>
    {children}
  </motion.button>
);
const GlassCard = ({ children, className = "", id }) => (
  <div id={id} className={`bg-[#151822]/60 backdrop-blur-xl border shadow-2xl rounded-2xl overflow-hidden ${className}`}>{children}</div>
);

// --- 主要 App 組件 ---
export default function App() {
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (currentHash.startsWith('#/history-')) {
    const code = currentHash.replace('#/history-', '');
    return <StudentHistoryView authCode={code} />;
  }

  return <AdminApp />;
}

// ============================================================================
// 🌟 模式一：學員歷史成績視角 
// ============================================================================
function StudentHistoryView({ authCode }) {
  const [records, setRecords] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', HISTORIES_COLLECTION), where('code', '==', authCode), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const raw = doc.data();
        const parsedPayload = raw.payload ? JSON.parse(raw.payload) : null;
        return { id: doc.id, ...raw, detail: parsedPayload };
      }).filter(item => item.detail !== null); 
      setRecords(data);
      setLoading(false);
    });
    return () => unsub();
  }, [authCode]);

  const selectedRecord = records[selectedIndex]?.detail;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="min-h-screen text-gray-100 font-sans relative overflow-hidden bg-[#0a0a0c] selection:bg-[#2EB1E3]/50">
      <div className="absolute top-[-15%] left-[-10%] w-[700px] h-[700px] bg-[#2EB1E3]/25 rounded-full blur-[150px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-[800px] h-[800px] bg-[#7BC158]/20 rounded-full blur-[160px] pointer-events-none z-0"></div>

      <div className="relative z-10 max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mb-10">
          <img src="/logo.png" alt="iSynReal Logo" className="h-14 md:h-16 mx-auto object-contain drop-shadow-[0_0_20px_rgba(123,193,88,0.4)] mb-6" />
          <h2 className="text-3xl font-extrabold text-white mb-2">戰術打靶紀錄查詢</h2>
          <p className="text-[#2EB1E3] font-medium tracking-wide">當前授權碼：{authCode}</p>
        </motion.div>

        {loading ? (
          <div className="text-center text-gray-400 py-20 flex flex-col items-center gap-4">
             <Loader2 className="w-8 h-8 animate-spin text-[#2EB1E3]" /> 正在載入歷史資料...
          </div>
        ) : records.length === 0 ? (
          <GlassCard className="border-white/10 text-center py-20 border-dashed border-white/20">
            <p className="text-gray-400">這個授權碼目前還沒有任何打靶紀錄喔！</p>
          </GlassCard>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-1/3 space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <AnimatePresence>
                {records.map((rec, index) => {
                  const total = rec.detail.scores.reduce((a, b) => a + b, 0);
                  const isSelected = index === selectedIndex;
                  return (
                    <motion.div layout key={rec.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedIndex(index)}
                      className={`p-4 rounded-xl cursor-pointer border transition-all ${isSelected ? 'bg-[#2EB1E3]/20 border-[#2EB1E3] shadow-[0_0_15px_rgba(46,177,227,0.3)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                      <div className="font-bold text-lg text-white mb-1">{rec.detail.studentName}</div>
                      <div className="text-sm text-gray-400 flex justify-between">
                        <span>總分：<span className={isSelected ? 'text-[#7BC158] font-bold' : 'text-white'}>{total} 分</span></span>
                        <span>{rec.detail.scores.length} 發</span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {selectedRecord && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} key={selectedIndex} className="flex-1">
                <GlassCard className="border-white/10 p-6 md:p-10 flex flex-col items-center h-full">
                  <h3 className="text-2xl font-bold text-white mb-2">{selectedRecord.studentName} 的射擊報告</h3>
                  <h4 className="text-xl text-[#f1c40f] font-bold mb-8">總成績：{selectedRecord.scores.reduce((a, b) => a + b, 0)} 分</h4>

                  <div className="flex flex-col md:flex-row items-center gap-10 w-full justify-center">
                    <div className="w-[300px] h-[300px] md:w-[350px] md:h-[350px] bg-white rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden">
                      <svg viewBox='-400 -400 800 800' className="w-full h-full">
                        {[...Array(10)].map((_, i) => {
                          const score = i + 1; const r = 400 - ((score - 1) * 40); const isBlackZone = score >= 8;
                          return <circle key={`c-${score}`} cx='0' cy='0' r={r} fill={isBlackZone ? '#222' : 'white'} stroke={isBlackZone ? 'white' : 'black'} strokeWidth='1.5' />;
                        })}
                        {[...Array(9)].map((_, i) => {
                          const score = i + 1; const textRadius = (400 - ((score - 1) * 40)) - 20; const isBlackZone = score >= 8; const textColor = isBlackZone ? 'white' : 'black';
                          return (
                            <g key={`t-${score}`} fill={textColor} fontSize="18" fontFamily="Arial" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                              <text x='0' y={-textRadius}>{score}</text><text x='0' y={textRadius}>{score}</text>
                              <text x={-textRadius} y='0'>{score}</text><text x={textRadius} y='0'>{score}</text>
                            </g>
                          );
                        })}
                        <text x='0' y='0' fill='white' fontSize='18' fontFamily='Arial' fontWeight='bold' textAnchor='middle' dominantBaseline='central'>10</text>
                        {selectedRecord.hitPositions.map((pos, i) => (
                          <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + (i * 0.1), type: "spring" }} key={`hit-${i}`} cx={pos.x} cy={-pos.y} r='12' fill='#e74c3c' stroke='#f1c40f' strokeWidth='3'/>
                        ))}
                      </svg>
                    </div>

                    <div className="bg-black/30 p-6 rounded-2xl border border-white/10 min-w-[200px]">
                      <h5 className="text-gray-400 font-bold mb-4 border-b border-white/10 pb-2">單發成績明細</h5>
                      <div className="space-y-2">
                        {selectedRecord.scores.map((s, i) => (
                          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + (i * 0.05) }} key={i} className="flex justify-between text-lg">
                            <span className="text-gray-300">第 {i + 1} 發</span>
                            <span className={`font-bold ${s === 10 ? 'text-[#7BC158]' : s === 0 ? 'text-red-400' : 'text-white'}`}>{s} 分</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(46,177,227,0.5); border-radius: 10px; }
      `}</style>
    </motion.div>
  );
}

// ============================================================================
// 🌟 模式二：管理員後台 
// ============================================================================
function AdminApp() {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedAdmin = localStorage.getItem('adminUser');
    if (savedAdmin) setAdminUser(JSON.parse(savedAdmin));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminUser');
    setAdminUser(null);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen text-gray-100 font-sans relative overflow-hidden bg-[#0a0a0c] selection:bg-[#2EB1E3]/50">
      <div className="absolute top-[-15%] left-[-10%] w-[700px] h-[700px] bg-[#2EB1E3]/25 rounded-full blur-[150px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-[800px] h-[800px] bg-[#7BC158]/20 rounded-full blur-[160px] pointer-events-none z-0"></div>

      <div className="relative z-10">
        <AnimatePresence mode="wait">
          {!adminUser ? (
            <motion.div key="login" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <LoginPage setAdminUser={setAdminUser} loading={loading} setLoading={setLoading} />
            </motion.div>
          ) : (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <nav className="bg-black/30 backdrop-blur-2xl border-b border-white/10 sticky top-0 z-50 shadow-2xl relative z-40">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex justify-between h-20 items-center">
                    <div className="flex items-center gap-4">
                      <img src="/logo.png" alt="iSynReal Logo" className="h-10 md:h-12 object-contain drop-shadow-[0_0_15px_rgba(46,177,227,0.4)] transition-transform hover:scale-105" />
                      <span className="font-bold text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 border-l-2 border-white/20 pl-4 hidden sm:inline-block">
                        數位打靶授權系統
                      </span>
                    </div>
                    <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/10"><LogOut className="w-4 h-4" /> 登出</button>
                  </div>
                </div>
              </nav>
              <main className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8 flex flex-col gap-8 relative z-30">
                <AdminDashboard />
              </main>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function LoginPage({ setAdminUser, loading, setLoading }) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    if (account === 'admin' && password === '54279327') {
      const user = { username: 'admin', role: 'engineer' };
      localStorage.setItem('adminUser', JSON.stringify(user));
      setAdminUser(user); setLoading(false);
      return;
    }
    setError('帳號或密碼錯誤'); setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
      <div className="w-full max-w-md">
        <GlassCard className="border-white/10 p-10 border-t border-white/20">
          <div className="text-center mb-10">
            <motion.img 
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}
              src="/logo.png" alt="iSynReal Logo" className="h-16 md:h-20 mx-auto object-contain drop-shadow-[0_0_20px_rgba(46,177,227,0.4)] mb-6" 
            />
            <h2 className="text-3xl font-extrabold text-white mb-2">管理員登入</h2>
            <p className="text-[#7BC158] font-medium tracking-wide">數位打靶授權系統</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="relative">
              <User className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
              <input type="text" value={account} onChange={(e) => setAccount(e.target.value)} required className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-[#2EB1E3]/50 focus:bg-white/5 transition-all shadow-inner" placeholder="管理員帳號" />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-[#2EB1E3]/50 focus:bg-white/5 transition-all shadow-inner" placeholder="管理員密碼" />
            </div>
            {error && <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">{error}</motion.div>}
            <GlassButton type="submit" disabled={loading} className="w-full !bg-[#2EB1E3]/80 hover:!bg-[#2EB1E3] !border-[#2EB1E3]/50 py-3.5 rounded-xl font-bold shadow-[0_0_20px_rgba(46,177,227,0.3)] mt-4">
              {loading ? '驗證中...' : '登入系統'}
            </GlassButton>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [days, setDays] = useState(99999);
  const [generating, setGenerating] = useState(false);
  
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState([]); 
  const [globalTotalCount, setGlobalTotalCount] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [page, setPage] = useState(0); 
  const [cursors, setCursors] = useState([]); 
  const [pageCodes, setPageCodes] = useState([]); 
  const [hasMore, setHasMore] = useState(true);
  
  const [allCodes, setAllCodes] = useState([]); 
  const [isDataLoading, setIsDataLoading] = useState(true);

  // 🌟 新手教學狀態
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem('hasSeenTutorialV2');
    if (!hasSeen) {
      // 稍微延遲一下，確保底下的 DOM 都畫好了再來量座標
      setTimeout(() => setShowTutorial(true), 500);
    }
  }, []);

  useEffect(() => {
    getCountFromServer(collection(db, 'artifacts', appId, 'public', 'data', CODES_COLLECTION))
      .then(snap => setGlobalTotalCount(snap.data().count)).catch(() => {});
  }, [allCodes.length, generating]); 

  const isSearchActive = searchTerm.trim() !== '' || startDate !== '' || endDate !== '' || statusFilters.length > 0 || isStatsOpen;

  const handleGenerate = async () => {
    if (days <= 0) return alert('天數必須大於 0');
    setGenerating(true);
    try {
      const code = generateSafeCode(8);
      const totalSeconds = parseInt(days) * 24 * 3600;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', CODES_COLLECTION), {
        code: code, type: 'general', createdAt: serverTimestamp(),
        expiresAt: null, durationSeconds: totalSeconds,
        isUsed: false, boundMac: '', boundUser: '', 
      });
      setDays(99999); 
    } catch (err) { alert('生成錯誤: ' + err.message); }
    setGenerating(false);
  };

  useEffect(() => {
    if (isSearchActive) return; 
    setIsDataLoading(true);
    let q = query(collection(db, 'artifacts', appId, 'public', 'data', CODES_COLLECTION), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
    if (page > 0 && cursors[page - 1]) q = query(q, startAfter(cursors[page - 1]));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs;
      setPageCodes(docs.map(doc => ({ id: doc.id, ...doc.data() })));
      if (docs.length === PAGE_SIZE) {
        setHasMore(true);
        setCursors(prev => { const nc = [...prev]; nc[page] = docs[docs.length - 1]; return nc; });
      } else setHasMore(false);
      setIsDataLoading(false);
    });
    return () => unsub();
  }, [page, isSearchActive]); 

  useEffect(() => {
    if (!isSearchActive) { setAllCodes([]); return; }
    setIsDataLoading(true);
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', CODES_COLLECTION), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setAllCodes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsDataLoading(false);
    });
    return () => unsub();
  }, [isSearchActive]);

  const stats = useMemo(() => {
    if (allCodes.length === 0) return { unused: 0, used: 0, expired: 0 };
    let unused = 0, used = 0, expired = 0;
    allCodes.forEach(c => {
      const isExp = isCodeExpired(c);
      if (isExp && c.isUsed) expired++;
      else if (c.isUsed) used++;
      else unused++;
    });
    return { unused, used, expired };
  }, [allCodes]);

  const toggleFilter = (type) => {
    setStatusFilters(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
    setPage(0);
  };

  const displayedCodes = useMemo(() => {
    if (!isSearchActive) return pageCodes; 
    return allCodes.filter(item => {
      const matchText = !searchTerm || (item.boundUser || '').toLowerCase().includes(searchTerm.toLowerCase()) || (item.code || '').toLowerCase().includes(searchTerm.toLowerCase());
      let matchDate = true;
      if (item.createdAt) {
        const itemTime = (item.createdAt.seconds * 1000);
        if (startDate) { const start = new Date(startDate); start.setHours(0, 0, 0, 0); if (itemTime < start.getTime()) matchDate = false; }
        if (endDate) { const end = new Date(endDate); end.setHours(23, 59, 59, 999); if (itemTime > end.getTime()) matchDate = false; }
      } else { if (startDate || endDate) matchDate = false; }
      
      let matchStatus = true;
      if (statusFilters.length > 0) {
        const isExp = isCodeExpired(item);
        const isUsedActive = item.isUsed && !isExp;
        const isUnused = !item.isUsed;
        
        matchStatus = false; 
        if (statusFilters.includes('expired') && isExp) matchStatus = true;
        if (statusFilters.includes('used') && isUsedActive) matchStatus = true;
        if (statusFilters.includes('unused') && isUnused) matchStatus = true;
      }
      return matchText && matchDate && matchStatus;
    });
  }, [isSearchActive, pageCodes, allCodes, searchTerm, startDate, endDate, statusFilters]);

  return (
    <div className="flex flex-col w-full gap-5">
      {/* 🌟 聚光燈新手教學 */}
      <AnimatePresence>
        {showTutorial && <SpotlightTutorial onComplete={() => { localStorage.setItem('hasSeenTutorialV2', 'true'); setShowTutorial(false); }} />}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white pl-3 border-l-4 border-[#2EB1E3] flex items-center gap-2">已建立的驗證碼清單 {isDataLoading && <Loader2 className="w-4 h-4 text-[#2EB1E3] animate-spin" />}</h3>
        {isSearchActive ? <span className="bg-[#2EB1E3]/20 px-4 py-1 rounded-full text-xs font-bold text-[#2EB1E3] border border-[#2EB1E3]/30">過濾後 {displayedCodes.length} 筆</span> : <span className="bg-white/10 px-4 py-1 rounded-full text-xs text-gray-300 border border-white/10">第 {page + 1} 頁</span>}
      </div>

      <div id="tour-search" className="flex flex-col md:flex-row gap-4 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-3 w-5 h-5 text-gray-400" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="搜尋備註或序號..." className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-11 pr-10 text-white focus:outline-none focus:border-[#2EB1E3]/50 focus:bg-white/5 transition-all" />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3 text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 flex-1 md:max-w-md">
          <div className="relative flex-1 text-white"><span className="absolute -top-2.5 left-3 bg-[#151822] px-1 text-[10px] text-gray-400 z-10">開始日期</span><Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" /><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-2 text-sm text-white focus:outline-none focus:border-[#7BC158]/50 focus:bg-white/5 transition-all [color-scheme:dark]" /></div>
          <div className="hidden sm:flex items-center text-gray-500">-</div>
          <div className="relative flex-1 text-white"><span className="absolute -top-2.5 left-3 bg-[#151822] px-1 text-[10px] text-gray-400 z-10">結束日期</span><Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" /><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-2 text-sm text-white focus:outline-none focus:border-[#7BC158]/50 focus:bg-white/5 transition-all [color-scheme:dark]" /></div>
          {(startDate || endDate) && <button onClick={() => {setStartDate(''); setEndDate('')}} className="text-gray-400 hover:text-white p-2" title="清除日期"><X className="w-5 h-5" /></button>}
        </div>
      </div>

      <div className="flex flex-col w-full">
        <div className="flex flex-col lg:flex-row gap-4 w-full">
          <GlassCard id="tour-generate" className="flex-1 border-white/10 p-4 relative overflow-hidden flex flex-col sm:flex-row items-center gap-4">
            <div className="absolute right-[-20%] top-[-20%] w-32 h-32 bg-[#7BC158]/20 rounded-full blur-[40px] pointer-events-none"></div>
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <Plus className="w-5 h-5 text-[#7BC158]" />
              <h3 className="text-base font-bold text-white whitespace-nowrap">產生序號</h3>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto flex-1 sm:justify-end">
               <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2 w-full sm:w-40">
                  <span className="text-xs font-bold text-gray-400 whitespace-nowrap">天數</span>
                  <input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} className="w-full bg-transparent text-white focus:outline-none font-mono text-right text-sm" />
               </div>
               <GlassButton onClick={handleGenerate} disabled={generating} className="!bg-[#7BC158]/80 hover:!bg-[#7BC158] !border-[#7BC158]/50 px-6 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(123,193,88,0.3)] whitespace-nowrap shrink-0">
                  {generating ? '產生中...' : '建立'}
               </GlassButton>
            </div>
          </GlassCard>

          <GlassCard id="tour-stats" className="flex-1 border-white/10 p-4">
            <div onClick={() => setIsStatsOpen(!isStatsOpen)} className="flex items-center justify-between cursor-pointer group h-full">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#2EB1E3]/20 rounded-lg"><BarChart3 className="w-5 h-5 text-[#2EB1E3]" /></div>
                <div className="flex items-end gap-2">
                  <span className="text-sm font-bold text-white leading-none">{globalTotalCount} <span className="text-xs font-normal text-gray-400">筆資料</span></span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-white transition-colors">
                展開標籤過濾 {isStatsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </GlassCard>
        </div>

        <AnimatePresence>
          {isStatsOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="overflow-hidden">
              <div className="pt-4">
                <GlassCard className="p-4 border-white/10 flex flex-col sm:flex-row gap-4">
                  <div onClick={() => toggleFilter('unused')} className={`flex-1 flex justify-between items-center p-3 rounded-xl cursor-pointer transition-all border ${statusFilters.includes('unused') ? 'bg-white/20 border-white shadow-lg' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                    <span className="text-sm font-bold text-gray-300">未啟用</span>
                    <span className="text-lg font-mono font-bold text-white">{isDataLoading ? '...' : stats.unused}</span>
                  </div>
                  <div onClick={() => toggleFilter('used')} className={`flex-1 flex justify-between items-center p-3 rounded-xl cursor-pointer transition-all border ${statusFilters.includes('used') ? 'bg-[#7BC158]/30 border-[#7BC158] shadow-[0_0_15px_rgba(123,193,88,0.3)]' : 'bg-[#7BC158]/5 border-[#7BC158]/20 hover:bg-[#7BC158]/10'}`}>
                    <span className="text-sm font-bold text-[#7BC158]">已啟用</span>
                    <span className="text-lg font-mono font-bold text-white">{isDataLoading ? '...' : stats.used}</span>
                  </div>
                  <div onClick={() => toggleFilter('expired')} className={`flex-1 flex justify-between items-center p-3 rounded-xl cursor-pointer transition-all border ${statusFilters.includes('expired') ? 'bg-red-500/30 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'}`}>
                    <span className="text-sm font-bold text-red-400">已過期</span>
                    <span className="text-lg font-mono font-bold text-white">{isDataLoading ? '...' : stats.expired}</span>
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div layout className="flex flex-col gap-5 w-full">
        <AnimatePresence mode="popLayout">
          {displayedCodes.map((item, index) => <CodeItem key={item.id} item={item} isFirst={index === 0} />)}
        </AnimatePresence>
        {displayedCodes.length === 0 && !isDataLoading && (
          <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full py-20 text-center bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 border-dashed"><p className="text-gray-400">找不到符合條件的資料。</p></motion.div>
        )}
      </motion.div>

      {!isSearchActive && displayedCodes.length > 0 && (
        <div className="flex justify-center items-center gap-6 pt-6 mt-4 border-t border-white/10">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-2 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 border border-white/10 transition-colors"><ChevronLeft className="w-6 h-6 text-white" /></button>
          <span className="text-gray-400 font-medium">第 {page + 1} 頁</span>
          <button onClick={() => setPage(p => p + 1)} disabled={!hasMore} className="p-2 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 border border-white/10 transition-colors"><ChevronRight className="w-6 h-6 text-white" /></button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 🌟 單筆序號卡片
// ============================================================================
function CodeItem({ item, isFirst }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [boundUserInput, setBoundUserInput] = useState(item.boundUser || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { setBoundUserInput(item.boundUser || ''); }, [item.boundUser]);

  const historyUrl = `${window.location.origin}${window.location.pathname}#/history-${item.code}`;

  const handleCopyCode = () => {
    copyToClipboard(item.code);
    setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    copyToClipboard(historyUrl);
    setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadQR = async () => {
    setIsDownloading(true);
    try {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=20&data=${encodeURIComponent(historyUrl)}`;
      const response = await fetch(qrApiUrl);
      const blob = await response.blob();
      
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `成績查詢_${item.code}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      alert('下載 QR Code 失敗，請檢查網路連線。');
    }
    setIsDownloading(false);
  };

  const handleDelete = async () => {
    if (!confirm(`⚠️ 嚴重警告：確定要刪除驗證碼 ${item.code} 嗎？\n\n這將會「永久刪除」該驗證碼，且「一併清除」所有綁定此驗證碼的歷史打靶紀錄！\n\n(此操作完全無法復原，請確認後再執行)`)) return;
    
    setIsDeleting(true);
    try {
      const historyQuery = query(collection(db, 'artifacts', appId, 'public', 'data', HISTORIES_COLLECTION), where('code', '==', item.code));
      const snapshot = await getDocs(historyQuery);
      
      const deletePromises = snapshot.docs.map(historyDoc => 
        deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', HISTORIES_COLLECTION, historyDoc.id))
      );
      await Promise.all(deletePromises);

      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', CODES_COLLECTION, item.id));
    } catch (e) { 
      alert('刪除失敗: ' + e.message); 
      setIsDeleting(false);
    }
  };

  const handleSaveBoundUser = async () => {
    if (boundUserInput === (item.boundUser || '')) return; 
    setIsSaving(true);
    try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', CODES_COLLECTION, item.id), { boundUser: boundUserInput }); } 
    catch (e) { alert('儲存失敗'); setBoundUserInput(item.boundUser || ''); }
    setIsSaving(false);
  };

  const isExpired = isCodeExpired(item);
  let statusColor = 'text-gray-400 bg-white/5 border-white/10';
  let statusText = '未使用';
  let cardBorderClass = 'border-white/10'; 

  if (item.isUsed) {
    if (isExpired) {
      statusColor = 'text-red-400 bg-red-500/10 border-red-500/20';
      statusText = '已過期';
      cardBorderClass = 'border-red-400/60 shadow-[0_0_15px_rgba(248,113,113,0.15)]'; 
    } else {
      statusColor = 'text-[#7BC158] bg-[#7BC158]/10 border-[#7BC158]/20';
      statusText = '已啟用';
      cardBorderClass = 'border-[#7BC158]/60 shadow-[0_0_15px_rgba(123,193,88,0.15)]'; 
    }
  }

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}
      className={`bg-[#151822]/80 backdrop-blur-xl border ${cardBorderClass} rounded-2xl p-5 hover:bg-[#1a1e2a] transition-colors relative group flex flex-col xl:flex-row gap-6 w-full items-stretch`}
    >
      <button onClick={handleDelete} disabled={isDeleting} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-red-400 bg-black/20 hover:bg-black/40 rounded-full transition-all opacity-0 group-hover:opacity-100 z-10" title="刪除序號">
        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin text-red-400" /> : <Trash2 className="w-4 h-4" />}
      </button>

      <div className="flex flex-col gap-4 xl:min-w-[320px] shrink-0 justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-mono text-white font-bold tracking-widest drop-shadow-md">{item.code}</span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border ${statusColor}`}>
            {item.isUsed ? (isExpired ? <X className="w-3.5 h-3.5"/> : <CheckCircle className="w-3.5 h-3.5" />) : <Clock className="w-3.5 h-3.5" />}
            {statusText}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-auto">
           <button onClick={handleCopyCode} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center gap-1.5 text-xs font-bold text-gray-300 hover:text-white transition-colors whitespace-nowrap">
              {copiedCode ? <Check className="w-3.5 h-3.5 text-[#7BC158]" /> : <Copy className="w-3.5 h-3.5" />} 複製驗證碼
           </button>
           <button onClick={handleCopyLink} className="px-3 py-1.5 bg-[#2EB1E3]/10 hover:bg-[#2EB1E3]/20 border border-[#2EB1E3]/30 rounded-lg flex items-center gap-1.5 text-xs font-bold text-[#2EB1E3] transition-colors whitespace-nowrap">
              {copiedLink ? <Check className="w-3.5 h-3.5 text-[#7BC158]" /> : <LinkIcon className="w-3.5 h-3.5" />} 複製成績網址
           </button>
           <button onClick={handleDownloadQR} disabled={isDownloading} className="px-3 py-1.5 bg-[#7BC158]/10 hover:bg-[#7BC158]/20 border border-[#7BC158]/30 rounded-lg flex items-center gap-1.5 text-xs font-bold text-[#7BC158] transition-colors disabled:opacity-50 whitespace-nowrap">
              {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />} 下載 QR 圖片
           </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-3">
        <div className="flex gap-3 flex-col sm:flex-row flex-1">
           <div className="flex-1 flex items-center justify-between sm:justify-start bg-black/30 px-4 py-3 rounded-xl border border-white/5 gap-4 shrink-0">
              <span className="text-gray-400 text-xs whitespace-nowrap shrink-0">建立時間</span>
              <span className="text-gray-300 font-medium whitespace-nowrap">{formatDate(item.createdAt)}</span>
           </div>
           <div className="flex-1 flex items-center justify-between sm:justify-start bg-black/30 px-4 py-3 rounded-xl border border-white/5 gap-4 shrink-0">
              <span className="text-gray-400 text-xs whitespace-nowrap shrink-0">授權天數</span>
              <span className="text-white font-medium whitespace-nowrap">{formatDuration(item.durationSeconds)}</span>
           </div>
        </div>

        <div className="flex gap-3 flex-col sm:flex-row flex-1">
           <div className="flex-[1.5] flex items-center justify-between sm:justify-start bg-black/30 px-4 py-3 rounded-xl border border-white/5 gap-4 overflow-hidden">
              <span className="text-gray-400 text-xs whitespace-nowrap shrink-0">綁定裝置 (MAC)</span>
              <span className="text-white font-mono text-xs truncate" title={item.boundMac}>{item.boundMac || '尚未綁定'}</span>
           </div>
           <div id={isFirst ? "tour-input" : undefined} className="flex-[2] flex items-center bg-[#2EB1E3]/10 px-4 py-3 rounded-xl border border-[#2EB1E3]/20 relative group/input gap-3 shrink-0">
              <span className="text-[#2EB1E3] flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0"><Edit3 className="w-3.5 h-3.5" /> 備註/綁定者</span>
              <div className="flex items-center relative w-full">
                  <input type="text" value={boundUserInput} onChange={(e) => setBoundUserInput(e.target.value)} onBlur={handleSaveBoundUser} placeholder="點擊輸入..." className="w-full bg-transparent text-white font-bold text-sm focus:outline-none focus:border-b focus:border-[#2EB1E3] pb-0.5 placeholder-gray-500 transition-colors text-right sm:text-left" />
                  {isSaving && <span className="absolute right-0 top-1 w-2 h-2 bg-[#2EB1E3] rounded-full animate-ping"></span>}
              </div>
           </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// 🌟 SVG 聚光燈新手教學系統 (Coach Marks)
// ============================================================================
function SpotlightTutorial({ onComplete }) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const steps = useMemo(() => [
    { id: null, title: "👋 歡迎使用", desc: "這是您第一次在此裝置登入。\n點擊畫面任何地方，快速了解系統核心功能！", align: "center" },
    { id: "tour-generate", title: "✨ 產生專屬序號", desc: "輸入天數（預設 99999 為買斷制），\n點擊建立即可產生一組安全授權碼。", align: "bottom" },
    { id: "tour-stats", title: "📊 標籤過濾與統計", desc: "點開面板可以查看狀態，\n並點擊標籤快速過濾下方的清單！", align: "bottom" },
    { id: "tour-search", title: "🔍 搜尋與日期", desc: "隨時利用關鍵字或日期區間，\n快速找回過往的序號紀錄。", align: "bottom" },
    { id: "tour-input", title: "📝 備註自動儲存", desc: "在卡片右下角輸入綁定者名稱。\n點擊畫面其他處，系統就會自動儲存！", align: "top" },
    { id: null, title: "🚀 準備就緒", desc: "點擊卡片上的按鈕，即可將成績網址分享給學員。\n\n🎉 點擊畫面結束教學！", align: "center" }
  ], []);

  const measureTarget = useCallback(() => {
    const currentId = steps[step].id;
    if (!currentId) {
      setTargetRect(null);
      return;
    }
    const el = document.getElementById(currentId);
    if (el) {
      const rect = el.getBoundingClientRect();
      // 讓目標自動平滑滾動到畫面中間
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 延遲一下讓捲動完成後再抓座標，畫面更順
      setTimeout(() => {
        const updatedRect = el.getBoundingClientRect();
        setTargetRect({
          x: updatedRect.left - 12,
          y: updatedRect.top - 12,
          w: updatedRect.width + 24,
          h: updatedRect.height + 24
        });
      }, 300);
    } else {
      setTargetRect(null);
    }
  }, [step, steps]);

  useEffect(() => {
    measureTarget();
    window.addEventListener('resize', measureTarget);
    return () => window.removeEventListener('resize', measureTarget);
  }, [measureTarget]);

  const handleNext = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else onComplete();
  };

  // 計算引導線與提示框的位置
  let tooltipStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  let linePath = null;

  if (targetRect && steps[step].align !== "center") {
    const cx = targetRect.x + targetRect.w / 2;
    if (steps[step].align === "bottom") {
      tooltipStyle = { top: targetRect.y + targetRect.h + 40, left: Math.min(Math.max(cx, 160), window.innerWidth - 160), transform: 'translate(-50%, 0)' };
      linePath = `M ${cx} ${targetRect.y + targetRect.h} L ${cx} ${targetRect.y + targetRect.h + 40}`;
    } else {
      tooltipStyle = { bottom: window.innerHeight - targetRect.y + 40, left: Math.min(Math.max(cx, 160), window.innerWidth - 160), transform: 'translate(-50%, 0)' };
      linePath = `M ${cx} ${targetRect.y} L ${cx} ${targetRect.y - 40}`;
    }
  }

  return (
    <div className="fixed inset-0 z-[100] cursor-pointer" onClick={handleNext}>
      {/* 🌟 SVG 聚光燈遮罩 */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none transition-all duration-500">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <motion.rect 
                initial={false}
                animate={{ x: targetRect.x, y: targetRect.y, width: targetRect.w, height: targetRect.h }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                rx="20" fill="black" 
              />
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(10,10,12,0.85)" mask="url(#spotlight-mask)" />
        
        {/* 🌟 科技引導線 */}
        {linePath && (
          <motion.path 
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }}
            d={linePath} stroke="#2EB1E3" strokeWidth="2" strokeDasharray="4 4" fill="none" 
          />
        )}
        {targetRect && steps[step].align === "bottom" && (
           <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }} cx={targetRect.x + targetRect.w / 2} cy={targetRect.y + targetRect.h} r="4" fill="#2EB1E3" />
        )}
        {targetRect && steps[step].align === "top" && (
           <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }} cx={targetRect.x + targetRect.w / 2} cy={targetRect.y} r="4" fill="#2EB1E3" />
        )}
      </svg>

      {/* 🌟 提示文字卡片 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} transition={{ duration: 0.3, delay: targetRect ? 0.2 : 0 }}
          className="absolute bg-[#151822] border border-[#2EB1E3]/50 shadow-[0_0_30px_rgba(46,177,227,0.3)] rounded-2xl p-6 text-center w-[320px] pointer-events-none"
          style={tooltipStyle}
        >
          {steps[step].align === "center" && (
            <div className="w-12 h-12 bg-[#2EB1E3]/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_15px_rgba(46,177,227,0.3)]">
              <Sparkles className="w-6 h-6 text-[#2EB1E3]" />
            </div>
          )}
          <h2 className="text-xl font-extrabold text-white mb-2">{steps[step].title}</h2>
          <p className="text-gray-300 whitespace-pre-line text-sm leading-relaxed">{steps[step].desc}</p>
          
          <div className="flex justify-center gap-2 mt-6">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'bg-[#2EB1E3] w-5 shadow-[0_0_10px_rgba(46,177,227,0.5)]' : 'bg-white/20 w-1.5'}`} />
            ))}
          </div>
          
          {steps[step].align === "center" && (
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }} className="mt-4 text-[#2EB1E3] flex items-center justify-center gap-1.5 text-xs font-bold">
              <MousePointerClick className="w-3.5 h-3.5" /> 點擊畫面繼續
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}