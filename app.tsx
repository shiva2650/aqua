import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Droplets, 
  Thermometer, 
  Waves, 
  Activity, 
  Settings, 
  LayoutDashboard, 
  MessageSquare, 
  ShieldAlert,
  Power,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  History,
  Plus,
  Send,
  User as UserIcon,
  Zap,
  Fish,
  LogOut,
  Bell,
  BellRing,
  Volume2,
  Trash2,
  Calendar
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  Brush
} from 'recharts';
import { format } from 'date-fns';

import Gauge from './components/Gauge';
import { useSensors } from './hooks/useSensors';
import { INITIAL_TASKS, DEFAULT_CONFIG } from './constants';
import { 
  Sensors, 
  Priority, 
  MaintenanceTask, 
  AquariumConfig, 
  HealthAnalysis, 
  ChatMessage 
} from './types';
import { analyzeAquariumHealth, getChatResponse, generateMaintenancePlan } from './services/geminiService';
import { auth, signIn, rtdb } from './lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { ref, update, onValue } from 'firebase/database';
import { cn } from './lib/utils';
import Markdown from 'react-markdown';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analysis' | 'maintenance' | 'chat' | 'settings'>('dashboard');
  
  // App State
  const [config, setConfig] = useState<AquariumConfig>(DEFAULT_CONFIG);
  const { sensors, devices, history, toggleDevice } = useSensors(config, config.aiSensitivity !== 'low', user?.uid);
  const [tasks, setTasks] = useState<MaintenanceTask[]>(INITIAL_TASKS);
  const [analysis, setAnalysis] = useState<HealthAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'assistant', content: 'Hello! I am your AquaPulse AI. How can I help you manage your aquarium today?', timestamp: Date.now() }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [notifications, setNotifications] = useState<{ id: string; message: string; type: 'info' | 'warning' | 'alert' }[]>([]);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: Priority.MEDIUM, isRecurring: false });
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [hoveredDevice, setHoveredDevice] = useState<string | null>(null);

  // Auth Listener
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Sync tasks and config with RTDB
  useEffect(() => {
    if (!user) return;

    const configRef = ref(rtdb, `aquariums/${user.uid}/config`);
    const tasksRef = ref(rtdb, `aquariums/${user.uid}/tasks`);

    const unsubConfig = onValue(configRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setConfig(data);
    });

    const unsubTasks = onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setTasks(data);
    });

    return () => {
      unsubConfig();
      unsubTasks();
    };
  }, [user]);

  // Persist local changes to RTDB
  useEffect(() => {
    if (!user) return;
    const updateRef = ref(rtdb, `aquariums/${user.uid}`);
    update(updateRef, { config, tasks });
  }, [config, tasks, user]);

  // AI Health Check on interval
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(async () => {
      setIsAnalyzing(true);
      const res = await analyzeAquariumHealth(sensors, config, history.slice(0, 5), config.aiSensitivity);
      setAnalysis({ ...res, lastUpdated: Date.now() });
      setIsAnalyzing(false);

      // Trigger automatic alerts based on analysis
      if (res.status !== 'Healthy') {
        const id = Date.now().toString();
        setNotifications(prev => [{ 
          id, 
          message: `AI Alert: ${res.summary}`, 
          type: res.status === 'Critical' ? 'alert' : 'warning' 
        }, ...prev]);
      }
    }, 60000); // Analyze every minute

    return () => clearInterval(interval);
  }, [user, sensors, config, history]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    const newMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: inputMessage, timestamp: Date.now() };
    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');

    const response = await getChatResponse(inputMessage, sensors, config, messages);
    setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: response, timestamp: Date.now() }]);
  };

  const completeTask = (taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const completedTask = { ...t, completedAt: Date.now() };
        if (t.isRecurring && t.frequencyDays) {
           // Auto-reschedule logic
           const nextDue = Date.now() + 1000 * 60 * 60 * 24 * t.frequencyDays;
           setTimeout(() => {
             setTasks(current => [...current, { ...t, id: Math.random().toString(), dueDate: nextDue, completedAt: undefined }]);
           }, 100);
        }
        return completedTask;
      }
      return t;
    }));
  };

  const handleGeneratePlan = async () => {
    setIsGeneratingPlan(true);
    try {
      const newTasks = await generateMaintenancePlan(config, sensors);
      setTasks(prev => [...newTasks, ...prev]);
    } catch (error) {
      console.error("Plan generation error:", error);
    } finally {
      setIsGeneratingPlan(false);
    }
  };
  const addTask = (task: Omit<MaintenanceTask, 'id' | 'dueDate'>) => {
    const freshTask: MaintenanceTask = {
      ...task,
      id: Math.random().toString(36).substr(2, 9),
      dueDate: Date.now() + 1000 * 60 * 60 * 2, // Default 2 hours from now for manual tasks
    };
    setTasks(prev => [freshTask, ...prev]);
    setIsAddTaskModalOpen(false);
    setNewTask({ title: '', description: '', priority: Priority.MEDIUM, isRecurring: false });
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-aqua-deep">
      <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }}>
        <Droplets className="w-12 h-12 text-aqua-primary" />
      </motion.div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-aqua-deep flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 to-aqua-deep">
      <div className="glass p-12 w-full max-w-md text-center glow-blue">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex justify-center mb-8">
          <div className="p-4 bg-aqua-primary/10 rounded-2xl border border-aqua-primary/20 glow-cyan">
            <Fish className="w-12 h-12 text-aqua-primary" />
          </div>
        </motion.div>
        <h1 className="text-4xl font-bold mb-2 tracking-tight">AquaPulse <span className="text-slate-500 font-light">AI</span></h1>
        <p className="text-slate-400 mb-10 text-sm font-medium uppercase tracking-widest">Next Generation Ecosystems</p>
        <button 
          onClick={() => signIn()}
          className="w-full flex items-center justify-center gap-3 bg-aqua-primary text-slate-900 py-4 rounded-2xl font-bold hover:scale-[1.02] transition-all glow-cyan"
        >
          <UserIcon className="w-5 h-5" />
          Access Central Interface
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-aqua-deep pb-24 lg:pb-0 lg:pl-64">
      {/* Notifications overlay */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none w-full max-w-sm">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className={cn(
                "p-4 rounded-xl border pointer-events-auto shadow-2xl backdrop-blur-md",
                n.type === 'alert' ? "bg-red-500/20 border-red-500/50 text-red-200" :
                n.type === 'warning' ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-200" :
                "bg-aqua-primary/20 border-aqua-primary/50 text-white"
              )}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex gap-2">
                  {n.type === 'alert' ? <ShieldAlert className="w-5 h-5 shrink-0" /> : <Bell className="w-5 h-5 shrink-0" />}
                  <p className="text-sm font-medium">{n.message}</p>
                </div>
                <button onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}>
                  <Trash2 className="w-4 h-4 opacity-50 hover:opacity-100" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sidebar Navigation */}
      <nav className="fixed left-0 top-0 bottom-0 w-64 bg-aqua-dark/50 border-r border-white/5 hidden lg:flex flex-col p-8 glass m-4 glow-blue rounded-none lg:rounded-3xl">
        <div className="flex items-center gap-3 mb-12">
          <div className="p-2.5 bg-aqua-primary/10 rounded-xl border border-aqua-primary/20 glow-cyan">
            <Fish className="w-6 h-6 text-aqua-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight">AquaPulse</span>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Neural Link</span>
          </div>
        </div>

        <div className="space-y-3 flex-grow">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'analysis', icon: Activity, label: 'AI Health' },
            { id: 'maintenance', icon: CheckCircle2, label: 'Maintenance' },
            { id: 'chat', icon: MessageSquare, label: 'Assistant' },
            { id: 'settings', icon: Settings, label: 'Control Unit' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300",
                activeTab === item.id 
                  ? "bg-aqua-primary text-slate-950 font-bold glow-cyan shadow-lg" 
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto glass p-3 border-white/5 flex items-center justify-between glow-blue">
          <div className="flex items-center gap-3">
            <img src={user.photoURL || ''} className="w-10 h-10 rounded-xl border border-aqua-primary/30 shadow-lg" alt="" />
            <div className="overflow-hidden">
               <p className="text-[10px] font-black uppercase tracking-widest truncate">{user.displayName?.split(' ')[0]}</p>
               <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">Level 4 Operator</span>
            </div>
          </div>
          <button onClick={() => signOut(auth)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
             <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-4 right-4 h-20 bg-aqua-dark/50 glass mb-4 lg:hidden flex justify-around items-center px-4 z-40 glow-blue rounded-3xl">
        {[
          { id: 'dashboard', icon: LayoutDashboard },
          { id: 'analysis', icon: Activity },
          { id: 'maintenance', icon: CheckCircle2 },
          { id: 'chat', icon: MessageSquare },
          { id: 'settings', icon: Settings },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={cn(
              "p-3 rounded-2xl transition-all duration-300",
              activeTab === item.id 
                ? "bg-aqua-primary text-slate-950 glow-cyan scale-110 shadow-lg" 
                : "text-slate-500"
            )}
          >
            <item.icon className="w-6 h-6" />
          </button>
        ))}
      </nav>

      {/* Main Content Area */}
      <main className="p-4 lg:p-8 max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-aqua-primary uppercase tracking-[0.3em] mb-1">Central Habitat Link</span>
            <h2 className="text-4xl font-bold tracking-tight capitalize">
              {activeTab} <span className="text-slate-500 font-light ml-1">v3.0</span>
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="glass px-6 py-3 flex items-center gap-4 glow-cyan">
              <span className={cn("status-dot w-2 h-2 rounded-full pulse", analysis?.status === 'Healthy' ? 'bg-green-500' : 'bg-yellow-500')}></span>
              <span className="text-xs font-bold uppercase tracking-widest">
                Status: {analysis?.status === 'Healthy' ? 'Optimal' : 'Checking'}
              </span>
              <div className="h-4 w-px bg-slate-700"></div>
              <span className="text-[10px] font-mono text-slate-400">{format(sensors.timestamp, 'MMM dd, HH:mm')}</span>
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Core Gauges */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Gauge 
                  value={sensors.ph} 
                  min={4} max={10} 
                  label="pH Level" unit="ph" 
                  color={sensors.ph < config.thresholds.ph.min || sensors.ph > config.thresholds.ph.max ? '#ff4d4d' : '#00f2ff'}
                />
                <Gauge 
                  value={sensors.temperature} 
                  min={15} max={35} 
                  label="Water Temp" unit="°c" 
                  color={sensors.temperature < config.thresholds.temperature.min || sensors.temperature > config.thresholds.temperature.max ? '#ff4d4d' : '#00f2ff'}
                />
                <Gauge 
                  value={sensors.turbidity} 
                  min={0} max={20} 
                  label="Turbidity" unit="ntu" 
                  color={sensors.turbidity > config.thresholds.turbidity.max ? '#ff4d4d' : '#00f2ff'}
                />
                <Gauge 
                  value={sensors.waterLevel} 
                  min={0} max={100} 
                  label="Water Level" unit="%" 
                  color={sensors.waterLevel < config.thresholds.waterLevel.min ? '#ff4d4d' : '#00f2ff'}
                />
              </div>

              {/* Status & Trends */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Historical Chart */}
                <div className="lg:col-span-2 glass p-8">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="font-bold flex items-center gap-3 text-sm uppercase tracking-widest text-slate-400">
                       <History className="w-5 h-5 text-aqua-primary" /> Parameter Analytics
                    </h3>
                    <div className="flex bg-slate-900 rounded-xl p-1 gap-1">
                       <button className="px-5 py-2 text-[10px] font-bold bg-aqua-primary text-slate-900 rounded-lg shadow-lg uppercase tracking-widest">Live</button>
                       <button className="px-5 py-2 text-[10px] font-bold text-slate-500 hover:text-white uppercase tracking-widest">History</button>
                    </div>
                  </div>
                  <div className="h-72 w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[...history].reverse()}>
                        <defs>
                          <linearGradient id="colorPh" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="5 5" stroke="#ffffff05" vertical={false} />
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={(time) => format(time, 'HH:mm')}
                          stroke="#ffffff10"
                          fontSize={10}
                          fontWeight={600}
                        />
                        <YAxis stroke="#ffffff10" fontSize={10} fontWeight={600} />
                        <Tooltip 
                          contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(14, 165, 233, 0.2)', borderRadius: '16px', backdropFilter: 'blur(12px)' }}
                          labelFormatter={(l) => format(l, 'HH:mm:ss MMM dd')}
                        />
                        <Area type="monotone" dataKey="ph" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorPh)" strokeWidth={3} name="pH Level" animationDuration={1000} />
                        <Area type="monotone" dataKey="temperature" stroke="#f59e0b" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={3} name="Temp (°C)" animationDuration={1000} />
                        <Brush 
                          dataKey="timestamp" 
                          height={40} 
                          stroke="#0ea5e950" 
                          fill="rgba(15, 23, 42, 0.5)"
                          travellerWidth={10}
                          tickFormatter={(time) => format(time, 'HH:mm')}
                          className="brush-custom"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Device Control Panel */}
                <div className="glass p-8 flex flex-col glow-blue">
                  <h3 className="font-bold mb-8 flex items-center gap-3 text-sm uppercase tracking-widest text-slate-400">
                    <Zap className="w-5 h-5 text-aqua-primary" /> Ecosystem Grid
                  </h3>
                  <div className="space-y-4 flex-grow">
                    {[
                      { id: 'pump', icon: Droplets, label: 'Main Reservoir' },
                      { id: 'heater', icon: Thermometer, label: 'Thermal Core' },
                      { id: 'filter', icon: Waves, label: 'Bio Processor' },
                      { id: 'lights', icon: Zap, label: 'Photon Array' },
                    ].map((d) => (
                      <div 
                        key={d.id} 
                        className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-white/5 group hover:border-aqua-primary/20 transition-all relative"
                        onMouseEnter={() => setHoveredDevice(d.id)}
                        onMouseLeave={() => setHoveredDevice(null)}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn("p-2.5 rounded-xl transition-all", (devices as any)[d.id] ? "bg-aqua-primary/20 text-aqua-primary glow-cyan" : "bg-slate-800 text-slate-600")}>
                            <d.icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold tracking-tight">{(d as any).label}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className={cn(
                                "w-2.5 h-2.5 rounded-full border border-white/20 shadow-inner",
                                (devices as any)[d.id] ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-slate-700"
                              )} />
                              <p className={cn(
                                "text-[10px] font-bold uppercase tracking-widest",
                                (devices as any)[d.id] ? "text-green-400/80" : "text-slate-500"
                              )}>
                                {(devices as any)[d.id] ? 'Active' : 'Standby'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {hoveredDevice === d.id && (
                          <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-950 border border-aqua-primary/30 p-3 rounded-xl text-[10px] whitespace-nowrap z-50 shadow-2xl backdrop-blur-md glow-blue min-w-[140px]">
                            <div className="flex flex-col gap-1">
                               <p className="font-bold text-aqua-primary uppercase tracking-tighter">
                                 {d.label.split(' ')[0]}: <span className={cn((devices as any)[d.id] ? "text-green-400" : "text-slate-500")}>{(devices as any)[d.id] ? 'Active' : 'Standby'}</span>
                               </p>
                               <div className="h-px bg-white/5 w-full my-1"></div>
                               <div className="text-slate-400 flex items-center gap-1">
                                 <History className="w-3 h-3" /> Last Active: {format(sensors.timestamp, 'HH:mm:ss')}
                               </div>
                            </div>
                            {/* Decorative tail */}
                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-950 border-r border-b border-aqua-primary/30 rotate-45"></div>
                          </div>
                        )}
                        <button 
                          onClick={() => toggleDevice(d.id as any)}
                          className={cn(
                            "w-12 h-6 rounded-full relative transition-all duration-500 border border-white/10",
                            (devices as any)[d.id] ? "bg-aqua-primary shadow-[0_0_15px_rgba(14,165,233,0.4)]" : "bg-slate-800"
                          )}
                        >
                          <motion.div 
                            animate={{ x: (devices as any)[d.id] ? 26 : 4 }}
                            className="w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm"
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => setConfig(prev => ({ ...prev, aiSensitivity: prev.aiSensitivity === 'low' ? 'medium' : 'low' }))}
                    className="w-full mt-6 py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black tracking-[0.3em] uppercase hover:bg-aqua-primary hover:text-slate-950 transition-all"
                  >
                    Override Neural Logic Mode
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'analysis' && (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass p-10 flex flex-col items-center text-center glow-cyan">
                  <div className="relative mb-8">
                    <svg className="w-52 h-52">
                      <circle cx="104" cy="104" r="96" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                      <motion.circle 
                        cx="104" cy="104" r="96" 
                        fill="transparent" 
                        stroke="var(--color-aqua-primary)" 
                        strokeWidth="12"
                        strokeDasharray={2 * Math.PI * 96}
                        initial={{ strokeDashoffset: 2 * Math.PI * 96 }}
                        animate={{ strokeDashoffset: (2 * Math.PI * 96) * (1 - (analysis?.score || 0) / 100) }}
                        transition={{ duration: 2, ease: "easeOut" }}
                        className="filter drop-shadow-[0_0_15px_var(--color-aqua-glow)]"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-6xl font-black tracking-tighter text-slate-50">{analysis?.score || '--'}</span>
                      <span className="text-[10px] uppercase tracking-[0.4em] text-slate-500 font-bold">Health Index</span>
                    </div>
                  </div>
                  
                  <div className={cn(
                    "px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border mb-6",
                    analysis?.status === 'Healthy' ? "bg-green-500/10 border-green-500/20 text-green-400" :
                    analysis?.status === 'Warning' ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" :
                    "bg-red-500/10 border-red-500/20 text-red-400"
                  )}>
                    {analysis?.status || 'Analyzing Ecosystem...'}
                  </div>

                  <p className="text-lg text-slate-400 leading-relaxed max-w-sm font-medium italic">
                    "{analysis?.summary || 'Engaging neural networks to evaluate biometrics...'}"
                  </p>
                </div>

                <div className="space-y-6">
                   <div className="glass p-8 border-l-4 border-l-aqua-primary bg-gradient-to-r from-aqua-primary/5 to-transparent">
                    <h4 className="font-bold mb-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em]">
                       <ShieldAlert className="w-5 h-5 text-aqua-primary" /> AI Recommendations
                    </h4>
                    <div className="space-y-4">
                       {analysis?.recommendations.map((rec, i) => (
                         <div key={i} className="flex gap-4 text-sm text-slate-300 font-medium">
                           <div className="mt-1.5 w-1.5 h-1.5 bg-aqua-primary rounded-full shrink-0 glow-cyan" />
                           <p>{rec}</p>
                         </div>
                       ))}
                       {!analysis && <div className="animate-pulse space-y-3"><div className="h-4 bg-white/5 rounded w-full"></div><div className="h-4 bg-white/5 rounded w-3/4"></div></div>}
                    </div>

                    {analysis?.recommendations && analysis.recommendations.length > 0 && (
                      <div className="mt-8 pt-6 border-t border-white/5">
                        <h5 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 mb-4">AI Suggested Actions</h5>
                        <div className="flex flex-wrap gap-2">
                          {analysis.recommendations.map((rec, i) => {
                            // Enhanced Action Name Logic
                            let actionName = rec.split('.')[0].split(',')[0].slice(0, 30);
                            
                            // Specific mapping as per user request examples
                            if (rec.toLowerCase().includes('water change')) actionName = "Schedule Water Change";
                            if (rec.toLowerCase().includes('filter')) actionName = "Clean Filter Unit";
                            if (rec.toLowerCase().includes('feed')) actionName = "Dispense Nutrients";
                            if (rec.toLowerCase().includes('substrate')) actionName = "Vacuum Substrate";
                            if (rec.toLowerCase().includes('algae')) actionName = "Manual Algae Scrub";

                            return (
                              <button
                                key={i}
                                id={`action-chip-${i}`}
                                onClick={() => addTask({
                                  title: actionName,
                                  description: rec,
                                  priority: Priority.MEDIUM,
                                  isRecurring: false
                                })}
                                className="px-4 py-2 bg-aqua-primary/10 hover:bg-aqua-primary/20 border border-aqua-primary/20 rounded-full text-[10px] font-bold text-aqua-primary transition-all flex items-center gap-2 group cursor-pointer hover:scale-105 active:scale-95"
                              >
                                <Plus className="w-3 h-3 group-hover:scale-125 transition-transform" />
                                {actionName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                   </div>

                   <div className="glass p-8 border-l-4 border-l-orange-500/50 bg-gradient-to-r from-orange-500/5 to-transparent">
                    <h4 className="font-bold mb-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em]">
                       <AlertTriangle className="w-5 h-5 text-orange-400" /> Forecast Patterns
                    </h4>
                    <div className="space-y-4">
                       {analysis?.predictions.map((pred, i) => (
                         <div key={i} className="flex gap-4 text-sm text-slate-300 font-medium">
                           <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                           <p>{pred}</p>
                         </div>
                       ))}
                       {!analysis && <div className="animate-pulse space-y-3"><div className="h-4 bg-white/5 rounded w-full"></div><div className="h-4 bg-white/5 rounded w-3/4"></div></div>}
                    </div>
                   </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'maintenance' && (
            <motion.div
              key="maintenance"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center glass p-6 border border-white/5">
                 <div className="grid grid-cols-3 gap-8 text-center flex-grow">
                    <div>
                       <p className="text-3xl font-black text-slate-50">{tasks.filter(t => !t.completedAt).length}</p>
                       <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Active</p>
                    </div>
                    <div>
                       <p className="text-3xl font-black text-slate-50">{tasks.filter(t => !!t.completedAt).length}</p>
                       <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Resolved</p>
                    </div>
                    <div>
                       <p className="text-3xl font-black text-red-500">{tasks.filter(t => !t.completedAt && t.dueDate < Date.now()).length}</p>
                       <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Critical</p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <button 
                      onClick={handleGeneratePlan}
                      disabled={isGeneratingPlan}
                      className={cn(
                        "flex-grow flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all",
                        isGeneratingPlan 
                          ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                          : "bg-aqua-primary/10 border border-aqua-primary/20 text-aqua-primary hover:bg-aqua-primary/20"
                      )}
                    >
                      <Zap className={cn("w-4 h-4", isGeneratingPlan && "animate-pulse")} />
                      {isGeneratingPlan ? 'Calibrating Neural Plan...' : 'Generate AI Plan'}
                    </button>
                    <button 
                      onClick={() => setIsAddTaskModalOpen(true)}
                      className="w-14 h-14 bg-aqua-primary text-slate-950 rounded-2xl flex items-center justify-center hover:scale-105 transition-all glow-cyan shadow-xl shrink-0"
                    >
                        <Plus className="w-7 h-7" />
                    </button>
                 </div>
              </div>

              {/* Add Task Modal */}
              <AnimatePresence>
                {isAddTaskModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div 
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       exit={{ opacity: 0 }}
                       onClick={() => setIsAddTaskModalOpen(false)}
                       className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm pointer-events-auto"
                    />
                    <motion.div 
                       initial={{ opacity: 0, scale: 0.9, y: 20 }}
                       animate={{ opacity: 1, scale: 1, y: 0 }}
                       exit={{ opacity: 0, scale: 0.9, y: 20 }}
                       className="relative glass w-full max-w-lg p-8 glow-cyan border border-aqua-primary/20 pointer-events-auto"
                    >
                      <h3 className="text-2xl font-bold tracking-tight mb-6 text-slate-50">New Maintenance Protocol</h3>
                      
                      <div className="space-y-6">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Subject</label>
                          <input 
                            type="text" 
                            value={newTask.title}
                            onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="e.g., Algae Scrubbing"
                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-aqua-primary/40 text-slate-50"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Procedure Details</label>
                          <textarea 
                            value={newTask.description}
                            onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                            rows={3}
                            placeholder="Detailed steps for the maintenance operation..."
                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-aqua-primary/40 resize-none text-slate-50"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Priority Level</label>
                          <div className="flex gap-2">
                            {[Priority.LOW, Priority.MEDIUM, Priority.HIGH].map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setNewTask(prev => ({ ...prev, priority: p as any }))}
                                className={cn(
                                  "flex-grow py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all",
                                  newTask.priority === p 
                                   ? "bg-slate-800 border-aqua-primary text-aqua-primary shadow-[0_0_10px_rgba(0,242,255,0.2)]" 
                                   : "border-white/5 text-slate-500"
                                )}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                          <button 
                            type="button"
                            onClick={() => setIsAddTaskModalOpen(false)}
                            className="flex-grow py-4 bg-slate-800 text-slate-400 rounded-2xl font-bold hover:bg-slate-700 transition-all uppercase tracking-widest text-xs"
                          >
                            Abort
                          </button>
                          <button 
                            type="button"
                            onClick={() => addTask(newTask)}
                            disabled={!newTask.title}
                            className="flex-grow py-4 bg-aqua-primary text-slate-950 rounded-2xl font-bold hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 uppercase tracking-widest text-xs glow-cyan"
                          >
                            Initialize Protocol
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              <div className="space-y-4">
                {tasks.sort((a, b) => b.priority === Priority.HIGH ? 1 : -1).map((task) => (
                  <div key={task.id} className={cn(
                    "glass p-6 flex flex-col md:flex-row gap-6 border border-white/5 hover:border-aqua-primary/30",
                    task.completedAt ? "opacity-40 grayscale" : "glow-blue"
                  )}>
                    <div className="flex flex-col gap-2 flex-grow">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full pulse",
                          task.priority === Priority.HIGH ? "bg-red-500" :
                          task.priority === Priority.MEDIUM ? "bg-yellow-500" : "bg-green-500"
                        )} />
                        <h4 className="font-bold text-lg tracking-tight flex items-center gap-2">
                          {task.title}
                          {task.isRecurring && <History className="w-4 h-4 text-slate-500" />}
                        </h4>
                      </div>
                      <p className="text-sm text-slate-400 font-medium leading-relaxed">{task.description}</p>
                      <div className="flex gap-4 mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                         <span className="flex items-center gap-1.5 shrink-0">
                           <Calendar className="w-3.5 h-3.5" /> {format(task.dueDate, 'MMM dd, HH:mm')}
                         </span>
                         {task.completedAt && (
                           <span className="text-aqua-primary flex items-center gap-1.5">
                             <CheckCircle2 className="w-3.5 h-3.5" /> RESOLVED {format(task.completedAt, 'HH:mm')}
                           </span>
                         )}
                      </div>
                    </div>
                    <div className="flex items-center">
                      {!task.completedAt ? (
                        <button 
                          onClick={() => completeTask(task.id)}
                          className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-aqua-primary text-slate-950 font-bold rounded-2xl hover:scale-105 transition-all glow-cyan"
                        >
                          <CheckCircle2 className="w-5 h-5" /> Resolve Unit
                        </button>
                      ) : (
                        <button className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all" onClick={() => setTasks(p => p.filter(x => x.id !== task.id))}>
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass h-[calc(100vh-280px)] lg:h-[calc(100vh-220px)] flex flex-col border border-white/5 overflow-hidden"
            >
              <div className="bg-aqua-primary/10 border-b border-aqua-primary/20 px-8 py-4">
                 <div className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-aqua-primary pulse glow-cyan"></div>
                   <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-aqua-primary">AI Neural Processor Online</span>
                 </div>
              </div>
              <div className="flex-grow overflow-y-auto p-8 space-y-6 scrollbar-hide">
                {messages.map((m) => (
                  <div key={m.id} className={cn("flex flex-col", m.role === 'user' ? "items-end" : "items-start")}>
                    <div className={cn(
                      "max-w-[80%] p-5 rounded-3xl text-sm leading-relaxed font-medium",
                      m.role === 'user' 
                        ? "bg-aqua-primary text-slate-950 rounded-tr-none glow-cyan" 
                        : "bg-slate-900 text-slate-200 rounded-tl-none border border-white/5 shadow-xl"
                    )}>
                      <Markdown>{m.content}</Markdown>
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 mt-2 px-2 uppercase tracking-widest">{format(m.timestamp, 'HH:mm')}</span>
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-white/5 bg-slate-950/40">
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Inquire about ecosystem metrics..."
                    className="flex-grow bg-slate-900/50 border border-white/5 rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:border-aqua-primary/40 focus:ring-1 focus:ring-aqua-primary/20 transition-all placeholder:text-slate-600"
                  />
                  <button 
                    onClick={handleSendMessage}
                    className="p-4 bg-aqua-primary text-slate-950 rounded-2xl hover:scale-105 transition-transform glow-cyan shadow-xl"
                  >
                    <Send className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-32 lg:pb-0"
            >
              <div className="space-y-8">
                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-aqua-primary mb-5 flex items-center gap-3">
                    <Fish className="w-5 h-5" /> Biological Interface
                  </h3>
                  <div className="glass p-8 space-y-6 border border-white/5">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-4">Species Cluster</label>
                      <div className="flex flex-wrap gap-3">
                        {config.fishSpecies.map(s => (
                          <span key={s} className="px-4 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold flex items-center gap-3 transition-colors hover:border-aqua-primary/40">
                            {s} <button className="text-slate-500 hover:text-red-400" onClick={() => setConfig(prev => ({ ...prev, fishSpecies: prev.fishSpecies.filter(x => x !== s) }))}>×</button>
                          </span>
                        ))}
                        <button className="px-4 py-2 border-2 border-dashed border-aqua-primary/30 text-aqua-primary rounded-xl text-xs font-bold hover:bg-aqua-primary/5 transition-all">Connect Entity +</button>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Population Matrix</label>
                        <span className="text-lg font-black text-aqua-primary">{config.fishCount} Units</span>
                      </div>
                      <input 
                        type="range" min="1" max="50" step="1" 
                        value={config.fishCount} 
                        onChange={(e) => setConfig(prev => ({ ...prev, fishCount: parseInt(e.target.value) }))}
                        className="w-full accent-aqua-primary h-1.5 cursor-pointer"
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-aqua-primary mb-5 flex items-center gap-3">
                    <Activity className="w-5 h-5" /> Sensitivity Matrix
                  </h3>
                  <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 space-y-6">
                    <div className="relative h-2 bg-slate-800 rounded-full">
                      <div 
                        className="absolute h-full bg-aqua-primary rounded-full transition-all duration-500 glow-cyan"
                        style={{ width: config.aiSensitivity === 'low' ? '33%' : config.aiSensitivity === 'medium' ? '66%' : '100%' }}
                      />
                      <div className="absolute inset-x-0 -top-2 flex justify-between px-1">
                        {(['low', 'medium', 'high'] as const).map(s => (
                          <button 
                            key={s} 
                            onClick={() => setConfig(prev => ({ ...prev, aiSensitivity: s }))}
                            className={cn(
                              "w-6 h-6 rounded-full border-2 transition-all",
                              config.aiSensitivity === s ? "bg-aqua-primary border-white scale-125 glow-cyan" : "bg-slate-900 border-slate-700"
                            )}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-600">
                      <span>Reactive</span>
                      <span>Balanced</span>
                      <span>Proactive</span>
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-slate-600 mt-4 leading-relaxed uppercase tracking-wider">Warning: High sensitivity enables aggressive automated life-support protocols.</p>
                </section>

                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-aqua-primary mb-5 flex items-center gap-3">
                    <BellRing className="w-5 h-5" /> Maintenance Protocols
                  </h3>
                  <div className="glass p-8 space-y-6 border border-white/5">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-4">Notification Frequency</label>
                      <div className="grid grid-cols-3 gap-3">
                        {(['daily', 'weekly', 'as-needed'] as const).map(freq => (
                          <button
                            key={freq}
                            onClick={() => setConfig(prev => ({ ...prev, reminderSettings: { ...prev.reminderSettings, frequency: freq } }))}
                            className={cn(
                              "py-3 rounded-xl border text-[10px] font-black tracking-[0.1em] transition-all",
                              config.reminderSettings.frequency === freq 
                                ? "bg-aqua-primary text-slate-950 border-aqua-primary glow-cyan shadow-lg" 
                                : "bg-slate-900 border-white/5 text-slate-500 hover:text-slate-300"
                            )}
                          >
                            {freq.replace('-', ' ').toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-4">Alert Resonance</label>
                      <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-2xl border border-white/5">
                        <div className="p-3 bg-slate-800 rounded-xl text-aqua-primary">
                          <Volume2 className="w-5 h-5" />
                        </div>
                        <select 
                          value={config.reminderSettings.sound}
                          onChange={(e) => setConfig(prev => ({ ...prev, reminderSettings: { ...prev.reminderSettings, sound: e.target.value as any } }))}
                          className="flex-grow bg-transparent border-none text-xs font-bold text-slate-300 uppercase tracking-widest focus:ring-0 cursor-pointer p-2"
                        >
                          <option value="subtle" className="bg-slate-900">Subtle Pulse</option>
                          <option value="techno" className="bg-slate-900">Digital Sequence</option>
                          <option value="nature" className="bg-slate-900">Aquatic Flow</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="space-y-8">
                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-aqua-primary mb-5 flex items-center gap-3">
                    <Zap className="w-5 h-5" /> Manual Override Junction
                  </h3>
                  <div className="glass p-8 border border-white/5 space-y-6">
                    <div className="flex items-center justify-between bg-aqua-primary/5 p-5 rounded-2xl border border-aqua-primary/20">
                      <div>
                        <p className="text-[10px] font-black text-aqua-primary uppercase tracking-[0.2em] mb-1">AI Cognitive Engine</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase">Automated Environmental Control</p>
                      </div>
                      <button 
                        onClick={() => toggleDevice('autoMode')}
                        className={cn(
                          "px-6 py-2 rounded-xl border text-[10px] font-black tracking-[0.2em] transition-all",
                          devices.autoMode 
                            ? "bg-aqua-primary text-slate-950 border-aqua-primary glow-cyan shadow-lg" 
                            : "bg-slate-800 border-white/10 text-slate-500"
                        )}
                      >
                        {devices.autoMode ? 'ACTIVE' : 'MANUAL'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { id: 'pump', label: 'Pump Unit', icon: Droplets },
                        { id: 'heater', label: 'Thermal Core', icon: Thermometer },
                        { id: 'filter', label: 'Bio Filter', icon: Waves },
                        { id: 'lights', label: 'Photon Array', icon: Zap },
                      ].map(d => (
                        <div key={d.id} className="bg-slate-900/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between hover:border-white/10 transition-all">
                           <div className="flex items-center gap-3">
                              <d.icon className="w-4 h-4 text-slate-400" />
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d.label}</span>
                           </div>
                           <button 
                             onClick={() => toggleDevice(d.id as any)}
                             className={cn(
                               "w-10 h-6 rounded-full relative transition-all duration-300 border flex items-center px-1",
                               (devices as any)[d.id] ? "bg-aqua-primary/20 border-aqua-primary/50" : "bg-slate-800 border-white/10"
                             )}
                           >
                             <motion.div 
                               animate={{ x: (devices as any)[d.id] ? 16 : 0 }}
                               className={cn("w-4 h-4 rounded-lg", (devices as any)[d.id] ? "bg-aqua-primary shadow-[0_0_10px_rgba(14,165,233,0.5)]" : "bg-slate-600")}
                             />
                           </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-aqua-primary mb-5 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5" /> Parameter Safeguards
                  </h3>
                  <div className="glass p-8 space-y-6 border border-white/5">
                    {[
                      { label: 'pH Gradient', key: 'ph' as const, step: 0.1 },
                      { label: 'Thermal Range (°C)', key: 'temperature' as const, step: 0.5 },
                      { label: 'Turbidity Max (NTU)', key: 'turbidity' as const, isSingle: true, step: 1 }
                    ].map((item) => (
                      <div key={item.key} className="flex justify-between items-center bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                         <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">{item.label}</span>
                         <div className="flex items-center gap-3">
                            {item.isSingle ? (
                              <input 
                                type="number" step={item.step} 
                                value={config.thresholds.turbidity.max} 
                                onChange={(e) => setConfig(prev => ({
                                  ...prev,
                                  thresholds: {
                                    ...prev.thresholds,
                                    turbidity: { max: parseFloat(e.target.value) }
                                  }
                                }))}
                                className="bg-slate-900 border border-white/10 w-20 text-center rounded-xl p-2 text-xs font-bold text-aqua-primary focus:outline-none focus:border-aqua-primary/50" 
                              />
                            ) : (
                              <>
                                <input 
                                  type="number" step={item.step} 
                                  value={(config.thresholds as any)[item.key].min} 
                                  onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    thresholds: {
                                      ...prev.thresholds,
                                      [item.key]: { ...prev.thresholds[item.key], min: parseFloat(e.target.value) }
                                    }
                                  }))}
                                  className="bg-slate-900 border border-white/10 w-16 text-center rounded-xl p-2 text-xs font-bold text-aqua-primary focus:outline-none focus:border-aqua-primary/50" 
                                />
                                <span className="text-slate-700 font-bold">—</span>
                                <input 
                                  type="number" step={item.step} 
                                  value={(config.thresholds as any)[item.key].max} 
                                  onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    thresholds: {
                                      ...prev.thresholds,
                                      [item.key]: { ...prev.thresholds[item.key], max: parseFloat(e.target.value) }
                                    }
                                  }))}
                                  className="bg-slate-900 border border-white/10 w-16 text-center rounded-xl p-2 text-xs font-bold text-aqua-primary focus:outline-none focus:border-aqua-primary/50" 
                                />
                              </>
                            )}
                         </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-red-500 mb-5 flex items-center gap-3">
                    <UserIcon className="w-5 h-5" /> Terminal Identity
                  </h3>
                  <div className="glass p-6 flex justify-between items-center glow-blue border border-white/5">
                     <div className="flex items-center gap-4">
                        <img src={user.photoURL || ''} className="w-10 h-10 rounded-2xl border-2 border-slate-800 shadow-lg" alt="" />
                        <div className="flex flex-col">
                           <span className="text-xs font-bold tracking-tight">{user.displayName}</span>
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{user.email}</span>
                        </div>
                     </div>
                     <button onClick={() => signOut(auth)} className="px-4 py-2 bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/5">Disconnect</button>
                  </div>
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
