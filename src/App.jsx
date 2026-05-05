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

// --- 🍏 蘋果風 UI 元件 (明亮主題版) ---
const GlassButton = ({ children, onClick, className = "", disabled = false, type = "button", id }) => (
  <motion.button id={id} type={type} disabled={disabled} onClick={onClick} whileHover={{ scale: disabled ? 1 : 1.02 }} whileTap={{ scale: disabled ? 1 : 0.95 }}
    className={`relative overflow-hidden bg-white border border-slate-200 shadow-sm text-slate-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-slate-50 ${className}`}>
    {children}
  </motion.button>
);
const GlassCard = ({ children, className = "", id }) => (
  <div id={id} className={`bg-white/90 backdrop-blur-xl border border-slate-200 shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden ${className}`}>{children}</div>
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
// 🌟 模式一：學員歷史成績視角 (全新明亮版 + 日期過濾)
// ============================================================================
function StudentHistoryView({ authCode }) {
  const [records, setRecords] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // 🌟 日期過濾狀態
  const [filterDate, setFilterDate] = useState('');
  const [hasSetInitDate, setHasSetInitDate] = useState(false);

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

      // 🌟 自動抓取最新的一天並設為預設過濾日期
      if (data.length > 0 && !hasSetInitDate) {
         const latestTimestamp = data[0].detail.timestamp; // 例如 "2026/05/05 14:11:09"
         if (latestTimestamp) {
            const datePart = latestTimestamp.split(' ')[0].replace(/\//g, '-'); // 轉成 YYYY-MM-DD
            setFilterDate(datePart);
            setHasSetInitDate(true);
         }
      }
      setLoading(false);
    });
    return () => unsub();
  }, [authCode, hasSetInitDate]);

  // 根據選擇的日期進行過濾
  const displayedRecords = useMemo(() => {
    if (!filterDate) return records; // 如果清空日期，顯示全部
    return records.filter(rec => {
       if (!rec.detail || !rec.detail.timestamp) return false;
       const recDate = rec.detail.timestamp.split(' ')[0].replace(/\//g, '-');
       return recDate === filterDate;
    });
  }, [records, filterDate]);

  // 當過濾結果改變時，自動選擇第一筆，避免破圖
  useEffect(() => {
    setSelectedIndex(0);
  }, [displayedRecords]);

  const selectedRecord = displayedRecords[selectedIndex]?.detail;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="min-h-screen text-slate-800 font-sans relative bg-slate-50 selection:bg-blue-200">
      
      <div className="relative z-10 max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mb-8">
          <img src="/logo.png" alt="iSynReal Logo" className="h-14 md:h-16 mx-auto object-contain mb-4" />
          <h2 className="text-3xl font-extrabold text-slate-800 mb-2">戰術打靶紀錄查詢</h2>
          <p className="text-blue-600 font-bold tracking-wide">當前授權碼：{authCode}</p>
        </motion.div>

        {/* 🌟 日曆過濾按鈕區塊 */}
        {!loading && records.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto">
             <div className="flex items-center gap-3 w-full sm:w-auto justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-slate-700 whitespace-nowrap">檢視日期：</span>
                <input 
                  type="date" 
                  value={filterDate} 
                  onChange={e => setFilterDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                />
             </div>
             {filterDate && (
               <button 
                 onClick={() => setFilterDate('')} 
                 className="text-sm text-slate-500 hover:text-red-500 flex items-center gap-1 font-bold transition-colors bg-slate-100 hover:bg-red-50 px-3 py-2 rounded-lg"
               >
                 <X className="w-4 h-4" /> 顯示所有紀錄
               </button>
             )}
          </motion.div>
        )}

        {loading ? (
          <div className="text-center text-slate-500 py-20 flex flex-col items-center gap-4">
             <Loader2 className="w-8 h-8 animate-spin text-blue-600" /> 正在載入歷史資料...
          </div>
        ) : records.length === 0 ? (
          <GlassCard className="text-center py-20 border-dashed border-slate-300">
            <p className="text-slate-500 font-medium">這個授權碼目前還沒有任何打靶紀錄喔！</p>
          </GlassCard>
        ) : displayedRecords.length === 0 ? (
          <GlassCard className="text-center py-20 border-dashed border-slate-300">
            <p className="text-slate-500 font-medium">該日期沒有打靶紀錄，請選擇其他日期或顯示所有紀錄。</p>
          </GlassCard>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-1/3 space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <AnimatePresence>
                {displayedRecords.map((rec, index) => {
                  const total = rec.detail.scores.reduce((a, b) => a + b, 0);
                  const isSelected = index === selectedIndex;
                  return (
                    <motion.div layout key={rec.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedIndex(index)}
                      className={`p-4 rounded-xl cursor-pointer border transition-all ${isSelected ? 'bg-blue-50 border-blue-400 shadow-md' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="font-bold text-lg text-slate-800">{rec.detail.studentName}</div>
                        <div className="text-xs text-slate-500 font-mono">{rec.detail.timestamp}</div>
                      </div>
                      <div className="text-sm text-slate-600 flex justify-between">
                        <span>總分：<span className={isSelected ? 'text-green-600 font-bold' : 'text-slate-800 font-bold'}>{total} 分</span></span>
                        <span className="font-medium bg-slate-100 px-2 py-0.5 rounded-md">{rec.detail.scores.length} 發</span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {selectedRecord && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} key={selectedRecord.timestamp} className="flex-1">
                <GlassCard className="p-6 md:p-10 flex flex-col items-center h-full">
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">{selectedRecord.studentName} 的射擊報告</h3>
                  <p className="text-slate-500 text-sm mb-6 font-mono tracking-wider bg-slate-100 px-3 py-1 rounded-full">{selectedRecord.timestamp}</p>
                  
                  <h4 className="text-xl text-blue-600 font-extrabold mb-8 bg-blue-50 px-6 py-2 rounded-full border border-blue-200">
                    總成績：{selectedRecord.scores.reduce((a, b) => a + b, 0)} 分
                  </h4>

                  <div className="flex flex-col md:flex-row items-center gap-10 w-full justify-center">
                    <div className="w-[300px] h-[300px] md:w-[350px] md:h-[350px] bg-white rounded-full shadow-[0_0_30px_rgba(0,0,0,0.1)] relative overflow-hidden border border-slate-200">
                      <svg viewBox='-400 -400 800 800' className="w-full h-full">
                        {[...Array(10)].map((_, i) => {
                          const score = i + 1; const r = 400 - ((score - 1) * 40); const isBlackZone = score >= 8;
                          return <circle key={`c-${score}`} cx='0' cy='0' r={r} fill={isBlackZone ? '#222' : 'white'} stroke={isBlackZone ? 'white' : '#cbd5e1'} strokeWidth='1.5' />;
                        })}
                        {[...Array(9)].map((_, i) => {
                          const score = i + 1; const textRadius = (400 - ((score - 1) * 40)) - 20; const isBlackZone = score >= 8; const textColor = isBlackZone ? 'white' : '#64748b';
                          return (
                            <g key={`t-${score}`} fill={textColor} fontSize="18" fontFamily="Arial" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                              <text x='0' y={-textRadius}>{score}</text><text x='0' y={textRadius}>{score}</text>
                              <text x={-textRadius} y='0'>{score}</text><text x={textRadius} y='0'>{score}</text>
                            </g>
                          );
                        })}
                        <text x='0' y='0' fill='white' fontSize='18' fontFamily='Arial' fontWeight='bold' textAnchor='middle' dominantBaseline='central'>10</text>
                        {selectedRecord.hitPositions.map((pos, i) => (
                          <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + (i * 0.1), type: "spring" }} key={`hit-${i}`} cx={pos.x} cy={-pos.y} r='12' fill='#ef4444' stroke='#fde047' strokeWidth='3'/>
                        ))}
                      </svg>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 min-w-[220px] shadow-sm">
                      <h5 className="text-slate-600 font-bold mb-4 border-b border-slate-200 pb-2">單發成績明細</h5>
                      <div className="space-y-3">
                        {selectedRecord.scores.map((s, i) => (
                          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + (i * 0.05) }} key={i} className="flex justify-between text-lg items-center">
                            <span className="text-slate-500 font-medium">第 {i + 1} 發</span>
                            <span className={`font-extrabold ${s === 10 ? 'text-green-600' : s === 0 ? 'text-red-500' : 'text-slate-800'}`}>{s} 分</span>
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
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.3); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(59,130,246,0.5); }
        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; transition: 0.2s; }
        input[type="date"]::-webkit-calendar-picker-indicator:hover { opacity: 1; }
      `}</style>
    </motion.div>
  );
}

// ============================================================================
// 🌟 模式二：管理員後台 (明亮版)
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen text-slate-800 font-sans relative bg-slate-50 selection:bg-blue-200">
      
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          {!adminUser ? (
            <motion.div key="login" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <LoginPage setAdminUser={setAdminUser} loading={loading} setLoading={setLoading} />
            </motion.div>
          ) : (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <nav className="bg-white/80 backdrop-blur-2xl border-b border-slate-200 sticky top-0 z-50 shadow-sm relative z-40">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex justify-between h-20 items-center">
                    <div className="flex items-center gap-4">
                      <img src="/logo.png" alt="iSynReal Logo" className="h-10 md:h-12 object-contain transition-transform hover:scale-105" />
                      <span className="font-extrabold text-xl tracking-wider text-slate-800 border-l-2 border-slate-200 pl-4 hidden sm:inline-block">
                        數位打靶授權系統
                      </span>
                    </div>
                    <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-red-500 transition-colors bg-slate-100 hover:bg-red-50 px-4 py-2 rounded-full"><LogOut className="w-4 h-4" /> 登出</button>
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
        <GlassCard className="p-10 shadow-2xl shadow-slate-200/50">
          <div className="text-center mb-10">
            <motion.img 
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}
              src="/logo.png" alt="iSynReal Logo" className="h-16 md:h-20 mx-auto object-contain mb-6" 
            />
            <h2 className="text-3xl font-extrabold text-slate-800 mb-2">管理員登入</h2>
            <p className="text-blue-600 font-bold tracking-wide">數位打靶授權系統</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="relative">
              <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input type="text" value={account} onChange={(e) => setAccount(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner" placeholder="管理員帳號" />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner" placeholder="管理員密碼" />
            </div>
            {error && <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-red-600 font-bold text-sm text-center bg-red-50 py-2 rounded-lg border border-red-200">{error}</motion.div>}
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-600/30 transition-all active:scale-95 disabled:opacity-50 mt-4">
              {loading ? '驗證中...' : '登入系統'}
            </button>
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

  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem('hasSeenTutorialV3');
    if (!hasSeen) {
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
      <AnimatePresence>
        {showTutorial && <SpotlightTutorial onComplete={() => { localStorage.setItem('hasSeenTutorialV3', 'true'); setShowTutorial(false); }} />}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-800 pl-3 border-l-4 border-blue-500 flex items-center gap-2">已建立的驗證碼清單 {isDataLoading && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}</h3>
        {isSearchActive ? <span className="bg-blue-50 px-4 py-1 rounded-full text-xs font-bold text-blue-600 border border-blue-200">過濾後 {displayedCodes.length} 筆</span> : <span className="bg-slate-100 px-4 py-1 rounded-full text-xs font-bold text-slate-500 border border-slate-200">第 {page + 1} 頁</span>}
      </div>

      <div id="tour-search" className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-3 w-5 h-5 text-slate-400" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="搜尋備註或序號..." className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-11 pr-10 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all" />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 flex-1 md:max-w-md">
          <div className="relative flex-1 text-slate-800"><span className="absolute -top-2.5 left-3 bg-white px-1 text-[10px] font-bold text-slate-500 z-10">開始日期</span><Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" /><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-2 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all" /></div>
          <div className="hidden sm:flex items-center text-slate-300 font-bold">-</div>
          <div className="relative flex-1 text-slate-800"><span className="absolute -top-2.5 left-3 bg-white px-1 text-[10px] font-bold text-slate-500 z-10">結束日期</span><Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" /><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-2 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all" /></div>
          {(startDate || endDate) && <button onClick={() => {setStartDate(''); setEndDate('')}} className="text-slate-400 hover:text-red-500 p-2 font-bold bg-slate-100 rounded-lg hover:bg-red-50" title="清除日期"><X className="w-5 h-5" /></button>}
        </div>
      </div>

      <div className="flex flex-col w-full">
        <div className="flex flex-col lg:flex-row gap-4 w-full">
          <GlassCard id="tour-generate" className="flex-1 p-4 flex flex-col sm:flex-row items-center gap-4 bg-green-50/30 border-green-200">
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <Plus className="w-5 h-5 text-green-600 font-bold" />
              <h3 className="text-base font-extrabold text-slate-800 whitespace-nowrap">產生序號</h3>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto flex-1 sm:justify-end">
               <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 w-full sm:w-40 shadow-inner">
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap">天數</span>
                  <input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} className="w-full bg-transparent text-slate-800 focus:outline-none font-mono font-bold text-right text-sm" />
               </div>
               <button onClick={handleGenerate} disabled={generating} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-green-600/20 whitespace-nowrap shrink-0 transition-colors active:scale-95 disabled:opacity-50">
                  {generating ? '產生中...' : '建立'}
               </button>
            </div>
          </GlassCard>

          <GlassCard id="tour-stats" className="flex-1 p-4">
            <div onClick={() => setIsStatsOpen(!isStatsOpen)} className="flex items-center justify-between cursor-pointer group h-full">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg"><BarChart3 className="w-5 h-5 text-blue-600" /></div>
                <div className="flex items-end gap-2">
                  <span className="text-sm font-extrabold text-slate-800 leading-none">{globalTotalCount} <span className="text-xs font-bold text-slate-500">筆資料</span></span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-slate-400 group-hover:text-blue-600 transition-colors">
                展開標籤過濾 {isStatsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </GlassCard>
        </div>

        <AnimatePresence>
          {isStatsOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="overflow-hidden">
              <div className="pt-4">
                <GlassCard className="p-4 flex flex-col sm:flex-row gap-4 bg-slate-50">
                  <div onClick={() => toggleFilter('unused')} className={`flex-1 flex justify-between items-center p-3 rounded-xl cursor-pointer transition-all border bg-white ${statusFilters.includes('unused') ? 'border-slate-800 shadow-md ring-1 ring-slate-800' : 'border-slate-200 hover:border-slate-400'}`}>
                    <span className="text-sm font-bold text-slate-600">未啟用</span>
                    <span className="text-lg font-mono font-bold text-slate-800">{isDataLoading ? '...' : stats.unused}</span>
                  </div>
                  <div onClick={() => toggleFilter('used')} className={`flex-1 flex justify-between items-center p-3 rounded-xl cursor-pointer transition-all border bg-white ${statusFilters.includes('used') ? 'border-green-600 shadow-md ring-1 ring-green-600' : 'border-slate-200 hover:border-green-400'}`}>
                    <span className="text-sm font-bold text-green-600">已啟用</span>
                    <span className="text-lg font-mono font-bold text-slate-800">{isDataLoading ? '...' : stats.used}</span>
                  </div>
                  <div onClick={() => toggleFilter('expired')} className={`flex-1 flex justify-between items-center p-3 rounded-xl cursor-pointer transition-all border bg-white ${statusFilters.includes('expired') ? 'border-red-500 shadow-md ring-1 ring-red-500' : 'border-slate-200 hover:border-red-400'}`}>
                    <span className="text-sm font-bold text-red-500">已過期</span>
                    <span className="text-lg font-mono font-bold text-slate-800">{isDataLoading ? '...' : stats.expired}</span>
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
          <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full py-20 text-center bg-white border border-slate-200 shadow-sm rounded-2xl border-dashed"><p className="text-slate-500 font-bold">找不到符合條件的資料。</p></motion.div>
        )}
      </motion.div>

      {!isSearchActive && displayedCodes.length > 0 && (
        <div className="flex justify-center items-center gap-6 pt-6 mt-4 border-t border-slate-200">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-2 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"><ChevronLeft className="w-6 h-6 text-slate-700" /></button>
          <span className="text-slate-600 font-bold">第 {page + 1} 頁</span>
          <button onClick={() => setPage(p => p + 1)} disabled={!hasMore} className="p-2 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"><ChevronRight className="w-6 h-6 text-slate-700" /></button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 🌟 單筆序號卡片 (明亮主題版)
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
  let statusColor = 'text-slate-500 bg-slate-100 border-slate-200';
  let statusText = '未使用';
  let cardBorderClass = 'border-slate-200'; 
  let cardBgClass = 'bg-white';

  if (item.isUsed) {
    if (isExpired) {
      statusColor = 'text-red-600 bg-red-50 border-red-200';
      statusText = '已過期';
      cardBorderClass = 'border-red-300'; 
      cardBgClass = 'bg-red-50/30';
    } else {
      statusColor = 'text-green-600 bg-green-50 border-green-200';
      statusText = '已啟用';
      cardBorderClass = 'border-green-300 shadow-[0_0_15px_rgba(123,193,88,0.1)]'; 
      cardBgClass = 'bg-green-50/20';
    }
  }

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}
      className={`${cardBgClass} backdrop-blur-xl border ${cardBorderClass} shadow-md rounded-2xl p-5 hover:shadow-lg transition-all relative group flex flex-col xl:flex-row gap-6 w-full items-stretch`}
    >
      <button onClick={handleDelete} disabled={isDeleting} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-600 bg-slate-100 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100 z-10" title="刪除序號">
        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Trash2 className="w-4 h-4" />}
      </button>

      <div className="flex flex-col gap-4 xl:min-w-[320px] shrink-0 justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-mono text-slate-800 font-extrabold tracking-widest drop-shadow-sm">{item.code}</span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border ${statusColor}`}>
            {item.isUsed ? (isExpired ? <X className="w-3.5 h-3.5"/> : <CheckCircle className="w-3.5 h-3.5" />) : <Clock className="w-3.5 h-3.5" />}
            {statusText}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-auto">
           <button onClick={handleCopyCode} className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors whitespace-nowrap shadow-sm">
              {copiedCode ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />} 複製驗證碼
           </button>
           <button onClick={handleCopyLink} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1.5 text-xs font-bold text-blue-600 transition-colors whitespace-nowrap shadow-sm">
              {copiedLink ? <Check className="w-3.5 h-3.5 text-green-600" /> : <LinkIcon className="w-3.5 h-3.5" />} 複製成績網址
           </button>
           <button onClick={handleDownloadQR} disabled={isDownloading} className="px-3 py-1.5 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg flex items-center gap-1.5 text-xs font-bold text-green-700 transition-colors disabled:opacity-50 whitespace-nowrap shadow-sm">
              {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />} 下載 QR 圖片
           </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-3">
        <div className="flex gap-3 flex-col sm:flex-row flex-1">
           <div className="flex-1 flex items-center justify-between sm:justify-start bg-slate-50/80 px-4 py-3 rounded-xl border border-slate-200 gap-4 shrink-0 shadow-inner">
              <span className="text-slate-500 font-bold text-xs whitespace-nowrap shrink-0">建立時間</span>
              <span className="text-slate-700 font-bold whitespace-nowrap">{formatDate(item.createdAt)}</span>
           </div>
           <div className="flex-1 flex items-center justify-between sm:justify-start bg-slate-50/80 px-4 py-3 rounded-xl border border-slate-200 gap-4 shrink-0 shadow-inner">
              <span className="text-slate-500 font-bold text-xs whitespace-nowrap shrink-0">授權天數</span>
              <span className="text-slate-700 font-bold whitespace-nowrap">{formatDuration(item.durationSeconds)}</span>
           </div>
        </div>

        <div className="flex gap-3 flex-col sm:flex-row flex-1">
           <div className="flex-[1.5] flex items-center justify-between sm:justify-start bg-slate-50/80 px-4 py-3 rounded-xl border border-slate-200 gap-4 overflow-hidden shadow-inner">
              <span className="text-slate-500 font-bold text-xs whitespace-nowrap shrink-0">綁定裝置 (MAC)</span>
              <span className="text-slate-700 font-mono font-bold text-xs truncate" title={item.boundMac}>{item.boundMac || '尚未綁定'}</span>
           </div>
           <div id={isFirst ? "tour-input" : undefined} className="flex-[2] flex items-center bg-blue-50/80 px-4 py-3 rounded-xl border border-blue-200 relative group/input gap-3 shrink-0 shadow-inner">
              <span className="text-blue-600 flex items-center font-bold gap-1.5 text-xs whitespace-nowrap shrink-0"><Edit3 className="w-3.5 h-3.5" /> 備註/綁定者</span>
              <div className="flex items-center relative w-full">
                  <input type="text" value={boundUserInput} onChange={(e) => setBoundUserInput(e.target.value)} onBlur={handleSaveBoundUser} placeholder="點擊輸入..." className="w-full bg-transparent text-slate-800 font-bold text-sm focus:outline-none focus:border-b focus:border-blue-400 pb-0.5 placeholder-slate-400 transition-colors text-right sm:text-left" />
                  {isSaving && <span className="absolute right-0 top-1 w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>}
              </div>
           </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// 🌟 SVG 聚光燈新手教學系統
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
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      <svg className="absolute inset-0 w-full h-full pointer-events-none transition-all duration-500">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <motion.rect initial={false} animate={{ x: targetRect.x, y: targetRect.y, width: targetRect.w, height: targetRect.h }} transition={{ type: "spring", stiffness: 100, damping: 20 }} rx="20" fill="black" />
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(15,23,42,0.7)" mask="url(#spotlight-mask)" />
        
        {linePath && <motion.path initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }} d={linePath} stroke="#fff" strokeWidth="2" strokeDasharray="4 4" fill="none" />}
        {targetRect && steps[step].align === "bottom" && <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }} cx={targetRect.x + targetRect.w / 2} cy={targetRect.y + targetRect.h} r="4" fill="#fff" />}
        {targetRect && steps[step].align === "top" && <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }} cx={targetRect.x + targetRect.w / 2} cy={targetRect.y} r="4" fill="#fff" />}
      </svg>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} transition={{ duration: 0.3, delay: targetRect ? 0.2 : 0 }}
          className="absolute bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 text-center w-[320px] pointer-events-none" style={tooltipStyle}>
          {steps[step].align === "center" && (
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Sparkles className="w-6 h-6 text-blue-600" />
            </div>
          )}
          <h2 className="text-xl font-extrabold text-slate-800 mb-2">{steps[step].title}</h2>
          <p className="text-slate-600 whitespace-pre-line text-sm leading-relaxed font-medium">{steps[step].desc}</p>
          
          <div className="flex justify-center gap-2 mt-6">
            {steps.map((_, i) => <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'bg-blue-500 w-5' : 'bg-slate-200 w-1.5'}`} />)}
          </div>
          
          {steps[step].align === "center" && (
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }} className="mt-4 text-slate-400 flex items-center justify-center gap-1.5 text-xs font-bold">
              <MousePointerClick className="w-3.5 h-3.5" /> 點擊畫面繼續
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}