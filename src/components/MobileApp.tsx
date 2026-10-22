import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  X, 
  User as UserIcon, 
  Users, 
  Shield, 
  Plus, 
  Clock, 
  Calendar, 
  ClipboardList, 
  AlertCircle, 
  Smartphone, 
  Camera, 
  LogOut, 
  Search, 
  ArrowLeft, 
  CheckCircle2, 
  Info,
  Scan,
  Truck,
  Hash,
  Sparkles,
  QrCode,
  Ban
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, addDoc, onSnapshot, orderBy, limit, db, handleFirestoreError, OperationType } from '../firebase';
import { Employee, Vehicle, Machine, ServiceProvider } from '../types';

interface MobileAppProps {
  setIsMobileMode: (mode: boolean) => void;
  settings: any;
}

function formatCPF(value: string) {
  const val = value.replace(/\D/g, '').substring(0, 11);
  let formatted = val;
  if (val.length > 9) formatted = val.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  else if (val.length > 6) formatted = val.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  else if (val.length > 3) formatted = val.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  return formatted;
}

export default function MobileApp({ setIsMobileMode, settings }: MobileAppProps) {
  // Authentication states
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [loggedInWatchman, setLoggedInWatchman] = useState<Employee | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // App Navigation inside mobile view
  // 'home' | 'scan' | 'manual' | 'history'
  const [screen, setScreen] = useState<'login' | 'home' | 'scan' | 'manual' | 'history'>('login');

  // Real-time metrics
  const [logsToday, setLogsToday] = useState<any[]>([]);
  const [logsRecent, setLogsRecent] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [machinesList, setMachinesList] = useState<Machine[]>([]);
  const [vehiclesList, setVehiclesList] = useState<Vehicle[]>([]);

  // Scanning / Entry States
  const [scanType, setScanType] = useState<'IN' | 'OUT'>('IN');
  const [scannedItem, setScannedItem] = useState<{
    type: 'employee' | 'machine' | 'vehicle' | 'visitor';
    id?: string;
    name: string;
    detail: string;
    cpf?: string;
    plate?: string;
    asset_number?: string;
    brand?: string;
    model?: string;
  } | null>(null);

  // Form Fields
  const [km, setKm] = useState('');
  const [horometer, setHorometer] = useState('');
  const [destination, setDestination] = useState('');
  const [hasUniform, setHasUniform] = useState<boolean | null>(null);
  const [hasBadge, setHasBadge] = useState<boolean | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [submittingLog, setSubmittingLog] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Set up real-time listeners for stats
  useEffect(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayISO = startOfToday.toISOString();

    // 1. Logs of today
    const qToday = query(
      collection(db, 'logs'),
      where('timestamp', '>=', startOfTodayISO)
    );
    const unsubToday = onSnapshot(qToday, (snap) => {
      const list = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      list.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Newest first
      setLogsToday(list);
    });

    // 2. Recent logs for presence calculation
    const qRecent = query(
      collection(db, 'logs'),
      orderBy('timestamp', 'desc'),
      limit(500)
    );
    const unsubRecent = onSnapshot(qRecent, (snap) => {
      setLogsRecent(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    // 3. Employees, machines and vehicles for search
    const unsubEmp = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployeesList(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Employee));
    });
    const unsubMach = onSnapshot(collection(db, 'machines'), (snap) => {
      setMachinesList(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Machine));
    });
    const unsubVeh = onSnapshot(collection(db, 'vehicles'), (snap) => {
      setVehiclesList(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Vehicle));
    });

    return () => {
      unsubToday();
      unsubRecent();
      unsubEmp();
      unsubMach();
      unsubVeh();
    };
  }, []);

  // Play a synthesized beep sound on scan success
  const playBeepSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime); // 1.2 kHz frequency (high pitch beep)
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15); // Duration of 150ms
    } catch {
      // Audio context silently disabled if muted or restricted
    }
  };

  const handleMobileLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11) {
      setAuthError('CPF inválido. Deve conter 11 dígitos.');
      setLoading(false);
      return;
    }

    try {
      const q = query(collection(db, 'employees'), where('cpf', '==', cleanCPF), limit(1));
      const snap = await getDocs(q);

      if (snap.empty) {
        setAuthError('Nenhum vigia encontrado com este CPF.');
      } else {
        const empDoc = snap.docs[0];
        const empData = empDoc.data() as Employee;

        if (!empData.is_watchman) {
          setAuthError('Este funcionário não possui cargo de Vigia.');
          setLoading(false);
          return;
        }

        // Check password if exists
        if (empData.password) {
          if (empData.password !== password) {
            setAuthError('Senha incorreta. Verifique os dados.');
            setLoading(false);
            return;
          }
        } else {
          // If watchman doesn't have password defined, let them in but notify
          showToast('Acesso permitido. Cadastre uma senha nas configurações para maior segurança.', 'info');
        }

        setLoggedInWatchman({ ...empData, id: empDoc.id });
        setScreen('home');
      }
    } catch (err) {
      console.error(err);
      setAuthError('Erro ao conectar ao banco de dados.');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleLogout = () => {
    setLoggedInWatchman(null);
    setCpf('');
    setPassword('');
    setScreen('login');
  };

  // Process Presence calculations
  const calculatePresence = () => {
    const presentEmployees = new Set<string>();
    const presentMachines = new Set<string>();
    const processedEmployees = new Set<string>();
    const processedMachines = new Set<string>();

    logsRecent.forEach(log => {
      if (log.employee_id && !processedEmployees.has(log.employee_id)) {
        processedEmployees.add(log.employee_id);
        if (log.type === 'IN') {
          presentEmployees.add(log.employee_id);
        }
      }
      if (log.machine_id && !processedMachines.has(log.machine_id)) {
        processedMachines.add(log.machine_id);
        if (log.type === 'IN') {
          presentMachines.add(log.machine_id);
        }
      }
    });

    return {
      employees: presentEmployees.size,
      machines: presentMachines.size
    };
  };

  const stats = calculatePresence();

  // QR Scan simulation triggers
  const triggerSimulation = (item: any) => {
    playBeepSound();
    setScannedItem(item);
    showToast(`QR Code escaneado: ${item.name}!`, 'success');
    
    // Clear draft form inputs
    setKm('');
    setHorometer('');
    setDestination('');
    setHasBadge(null);
    setHasUniform(null);
    setCapturedPhoto(null);
  };

  // QR Simulated Quick Codes
  const simulatedQRs = [
    { type: 'employee', name: 'Antônio Santos', detail: 'Operador de Pá Carregadeira', cpf: '34567890123' },
    { type: 'employee', name: 'Carlos Oliveira', detail: 'Vigia Reserva', cpf: '56789012345' },
    { type: 'machine', name: 'Pá Carregadeira Caterpillar', detail: 'Patrimônio: PC-102', asset_number: 'PC-102', brand: 'Caterpillar', model: '924K' },
    { type: 'machine', name: 'Escavadeira Hidráulica Komatsu', detail: 'Patrimônio: EH-405', asset_number: 'EH-405', brand: 'Komatsu', model: 'PC200' },
    { type: 'vehicle', name: 'Caminhão Mercedes-Benz (Pipa)', detail: 'Placa: ABC-1234', plate: 'ABC-1234', brand: 'Mercedes-Benz', model: 'Atron' },
  ];

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, width, height);
        setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedItem || !loggedInWatchman) return;

    setSubmittingLog(true);

    try {
      const timestamp = new Date().toISOString();
      const logData: any = {
        type: scanType,
        timestamp: timestamp,
        watchman_id: loggedInWatchman.id,
        shift_id: 'app_mobile_shift',
        photo: capturedPhoto || null,
        destination: destination || '',
        has_uniform: hasUniform,
        has_badge: hasBadge,
      };

      if (scannedItem.type === 'employee') {
        logData.employee_id = scannedItem.id || null;
        logData.employee_name = scannedItem.name;
        logData.service_provider_id = null;
        logData.vehicle_id = null;
        logData.machine_id = null;
      } else if (scannedItem.type === 'machine') {
        logData.employee_name = `Operação: ${scannedItem.brand} ${scannedItem.model}`;
        logData.machine_id = scannedItem.id || 'temp_mach_id';
        logData.machine_type = scannedItem.brand || 'Máquina';
        logData.machine_asset = scannedItem.asset_number || 'N/A';
        logData.horometer = horometer !== '' ? parseFloat(horometer) : null;
        logData.employee_id = null;
        logData.vehicle_id = null;
      } else if (scannedItem.type === 'vehicle') {
        logData.employee_name = `Condutor de ${scannedItem.brand} ${scannedItem.model}`;
        logData.vehicle_id = scannedItem.id || 'temp_veh_id';
        logData.vehicle_plate = scannedItem.plate || 'N/A';
        logData.vehicle_asset = scannedItem.asset_number || 'N/A';
        logData.km = km !== '' ? parseFloat(km) : null;
        logData.employee_id = null;
        logData.machine_id = null;
      }

      await addDoc(collection(db, 'logs'), logData);

      showToast(`Movimentação de ${scanType === 'IN' ? 'Entrada' : 'Saída'} registrada!`, 'success');
      setScannedItem(null);
      setScreen('home');
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar no banco de dados remoto.', 'error');
    } finally {
      setSubmittingLog(false);
    }
  };

  const [manualSearch, setManualSearch] = useState('');
  const [manualResults, setManualResults] = useState<any[]>([]);

  useEffect(() => {
    if (manualSearch.trim() === '') {
      setManualResults([]);
      return;
    }

    const term = manualSearch.toLowerCase();
    
    // Search in employees, machines, vehicles
    const res: any[] = [];
    employeesList.forEach(e => {
      if (e.name.toLowerCase().includes(term) || e.cpf.includes(term)) {
        res.push({ 
          type: 'employee', 
          id: e.id, 
          name: e.name, 
          detail: e.role_name || 'Funcionário', 
          cpf: e.cpf,
          is_authorized: e.is_authorized !== false
        });
      }
    });

    machinesList.forEach(m => {
      if (m.type.toLowerCase().includes(term) || m.asset_number?.toLowerCase().includes(term)) {
        res.push({ type: 'machine', id: m.id, name: `${m.type} - ${m.brand}`, detail: `Patrimônio: ${m.asset_number}`, asset_number: m.asset_number, brand: m.brand, model: m.model });
      }
    });

    vehiclesList.forEach(v => {
      if (v.plate.toLowerCase().includes(term) || v.brand.toLowerCase().includes(term)) {
        res.push({ type: 'vehicle', id: v.id, name: `${v.brand} ${v.model}`, detail: `Placa: ${v.plate}`, plate: v.plate, brand: v.brand, model: v.model, asset_number: v.asset_number });
      }
    });

    setManualResults(res.slice(0, 5));
  }, [manualSearch, employeesList, machinesList, vehiclesList]);

  return (
    <div className="min-h-screen bg-[#1F2937] p-2 sm:p-6 flex flex-col items-center justify-center font-sans select-none">
      
      {/* Floating Mode Switch Banner */}
      <div className="w-full max-w-sm mb-4 flex items-center justify-between bg-gray-900 border border-gray-800 p-3 rounded-2xl shadow-xl text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-emerald-500 animate-pulse" />
          <span className="font-semibold text-gray-300">Modo Aplicativo Móvel (Vigia)</span>
        </div>
        <button 
          onClick={() => setIsMobileMode(false)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg transition-all"
        >
          Ir para Desktop Panel
        </button>
      </div>

      {/* REALISTIC MOBILE APP WRAPPER / DEVICE FRAMER */}
      <div className="w-full max-w-[390px] h-[760px] bg-black rounded-[48px] border-[12px] border-gray-800 shadow-2xl relative overflow-hidden flex flex-col">
        
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-6 bg-black rounded-b-2xl z-[100] flex items-center justify-center">
          <div className="w-12 h-1.5 bg-gray-800 rounded-full mb-1"></div>
        </div>

        {/* Status Bar */}
        <div className="h-10 bg-gray-900 text-white flex items-end justify-between px-6 pb-1.5 text-[11px] font-medium tracking-wide z-50">
          <span>{currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] px-1 bg-emerald-500 text-black font-extrabold rounded-sm">4G</span>
            <div className="w-5 h-2.5 border border-white/50 rounded-xs p-0.5 flex items-center">
              <div className="h-full w-4/5 bg-white rounded-2xs"></div>
            </div>
          </div>
        </div>

        {/* Global Toast Alert */}
        <AnimatePresence>
          {notification && (
            <motion.div 
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -60, opacity: 0 }}
              className={`absolute top-12 left-3 right-3 p-3.5 rounded-2xl text-xs font-bold shadow-lg z-[200] flex items-center gap-2.5 ${
                notification.type === 'success' ? 'bg-emerald-600 text-white' : 
                notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
              }`}
            >
              {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{notification.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SCREEN SCROLL CONTAINER */}
        <div className="flex-1 bg-gray-50 overflow-y-auto relative flex flex-col">
          
          {/* SCREEN: LOGIN */}
          {screen === 'login' && (
            <div className="flex-1 flex flex-col justify-between p-6 pt-10">
              <div className="space-y-6 mt-6">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-md p-1.5 border border-gray-100 overflow-hidden">
                    <img 
                      src={settings?.company_logo || "/icon.png"} 
                      alt="Ícone VigiaControl" 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target.src.includes('icon.png')) {
                          target.src = '/icon.png';
                        }
                      }}
                    />
                  </div>
                  <h2 className="text-xl font-extrabold text-gray-900">VigiaControl Mobile</h2>
                  <p className="text-gray-500 text-xs px-4 leading-relaxed">
                    Aplicativo exclusivo para registro em portarias e frentes de trabalho.
                  </p>
                </div>

                <form onSubmit={handleMobileLogin} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">CPF do Vigia</label>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      value={cpf}
                      onChange={e => setCpf(formatCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono tracking-wide"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Senha de Acesso</label>
                    <input 
                      type="password" 
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono"
                      required
                    />
                  </div>

                  {authError && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs flex items-center gap-2 font-medium">
                      <AlertCircle size={16} />
                      <span>{authError}</span>
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Autenticando...' : 'Fazer Login Vigia'}
                  </button>
                </form>

                <div className="mt-4 pt-3 border-t border-gray-100">
                  <button 
                    type="button"
                    onClick={() => setIsMobileMode(false)}
                    className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 border border-blue-200"
                  >
                    <Shield size={14} />
                    Acesso Administrativo (Google)
                  </button>
                </div>
              </div>

              <div className="text-center space-y-1 text-[10px] text-gray-400 mt-6 border-t border-gray-100 pt-4">
                <p>VigiaControl Mobile v2.1.0</p>
                <p className="uppercase font-mono">{currentTime.toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          )}

          {/* SCREEN: HOME (Dashboard & Daily Stats) */}
          {screen === 'home' && loggedInWatchman && (
            <div className="flex-1 flex flex-col p-5 space-y-5">
              
              {/* Header Profile Info */}
              <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold text-sm overflow-hidden border border-emerald-100">
                    {loggedInWatchman.photo ? (
                      <img src={loggedInWatchman.photo} alt={loggedInWatchman.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={20} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs text-gray-400 uppercase tracking-widest leading-none font-bold">Vigilante Ativo</h3>
                    <h4 className="text-sm font-extrabold text-gray-900 leading-tight mt-1">{loggedInWatchman.name}</h4>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  title="Sair"
                >
                  <LogOut size={18} />
                </button>
              </div>

              {/* Status Counters */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-600 p-4 rounded-2xl text-white shadow-md relative overflow-hidden">
                  <div className="absolute right-[-10px] bottom-[-10px] opacity-15">
                    <Users size={80} />
                  </div>
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-emerald-100 leading-none">Pessoas Presentes</h5>
                  <p className="text-3xl font-extrabold mt-2 leading-none">{stats.employees}</p>
                  <p className="text-[9px] mt-2 text-emerald-100 font-semibold">Atualizado em Tempo Real</p>
                </div>
                
                <div className="bg-blue-600 p-4 rounded-2xl text-white shadow-md relative overflow-hidden">
                  <div className="absolute right-[-10px] bottom-[-10px] opacity-15">
                    <Truck size={80} />
                  </div>
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-blue-100 leading-none">Máquinas Presentes</h5>
                  <p className="text-3xl font-extrabold mt-2 leading-none">{stats.machines}</p>
                  <p className="text-[9px] mt-2 text-blue-100 font-semibold">Atualizado em Tempo Real</p>
                </div>
              </div>

              {/* Transit Stats Row */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
                <div className="space-y-0.5">
                  <h5 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Trânsito de Hoje</h5>
                  <p className="text-sm font-extrabold text-gray-900">Total de {logsToday.length} Movimentos</p>
                </div>
                <div className="flex gap-2 text-[10px] font-bold">
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                    {logsToday.filter(l => l.type === 'IN').length} Entradas
                  </span>
                  <span className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full border border-rose-100">
                    {logsToday.filter(l => l.type === 'OUT').length} Saídas
                  </span>
                </div>
              </div>

              {/* Primary Action Buttons */}
              <div className="space-y-2.5">
                <button 
                  onClick={() => setScreen('scan')}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-3 active:scale-95 transition-all text-sm uppercase tracking-wider"
                >
                  <Scan size={20} className="animate-bounce" />
                  Escanear QR / Código
                </button>
                
                <button 
                  onClick={() => setScreen('manual')}
                  className="w-full bg-white hover:bg-gray-50 text-gray-700 font-bold py-3.5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-center gap-2.5 active:scale-95 transition-all text-xs uppercase tracking-wider"
                >
                  <Search size={18} />
                  Inserção Manual
                </button>
              </div>

              {/* Recent Activity List */}
              <div className="flex-1 bg-white p-4 rounded-3xl border border-gray-100 shadow-xs flex flex-col overflow-hidden">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <ClipboardList size={14} className="text-emerald-500" />
                  Logs de Hoje ({logsToday.slice(0, 5).length})
                </h4>
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {logsToday.slice(0, 5).map((log, idx) => (
                    <div key={log.id || idx} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100/50">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full ${log.type === 'IN' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-gray-900 truncate leading-none">{log.employee_name || 'N/A'}</p>
                          <p className="text-[9px] text-gray-400 font-mono mt-1">
                            {log.machine_asset || log.vehicle_plate || 'Sem veículo'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-gray-500 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  {logsToday.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center py-6 text-gray-400">
                      <ClipboardList size={24} className="opacity-40 mb-1" />
                      <p className="text-[11px] italic">Nenhuma movimentação registrada hoje.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SCREEN: SCANNER SCREEN (Interactive simulated scanner) */}
          {screen === 'scan' && (
            <div className="flex-1 flex flex-col p-5 justify-between">
              
              <div className="space-y-4 flex flex-col flex-1">
                <div className="flex items-center justify-between">
                  <button onClick={() => { setScreen('home'); setScannedItem(null); }} className="p-2 text-gray-500 hover:text-black rounded-lg hover:bg-gray-100 transition-colors">
                    <ArrowLeft size={18} />
                  </button>
                  <h3 className="text-sm font-bold text-gray-800">Câmera e Leitor QR</h3>
                  <div className="w-8"></div>
                </div>

                {!scannedItem ? (
                  <div className="flex flex-col flex-1 space-y-4">
                    {/* Active simulated viewfinder */}
                    <div className="h-48 bg-gray-900 rounded-3xl relative overflow-hidden border border-gray-800 shadow-inner flex items-center justify-center">
                      
                      {/* Laser scanning bar effect */}
                      <motion.div 
                        animate={{ top: ['0%', '98%', '0%'] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                        className="absolute left-0 right-0 h-1 bg-emerald-500 shadow-md shadow-emerald-500/50 z-20"
                      ></motion.div>
                      
                      {/* Viewfinder brackets */}
                      <div className="w-32 h-32 border-2 border-emerald-400/60 rounded-xl relative z-10 flex items-center justify-center">
                        <QrCode size={40} className="text-emerald-400/40 animate-pulse" />
                      </div>

                      <p className="absolute bottom-3 text-[9px] text-emerald-400 font-bold uppercase tracking-widest animate-pulse">
                        Aguardando leitura de código...
                      </p>
                    </div>

                    {/* Pre-configured QRs for testing */}
                    <div className="space-y-2 flex-1 flex flex-col overflow-hidden">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Clique abaixo para simular escaneamento QR
                      </label>
                      
                      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {simulatedQRs.map((item, idx) => (
                          <button 
                            key={idx}
                            onClick={() => triggerSimulation(item as any)}
                            className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-left hover:border-emerald-500 hover:bg-emerald-50/20 active:scale-98 transition-all flex items-center justify-between shadow-xs cursor-pointer"
                          >
                            <div className="min-w-0">
                              <p className="text-[11px] font-extrabold text-gray-900 truncate">{item.name}</p>
                              <p className="text-[9px] text-gray-400 font-semibold truncate leading-none mt-1">{item.detail}</p>
                            </div>
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                              {item.type === 'employee' ? 'Crachá' : item.type === 'machine' ? 'Máquina' : 'Veículo'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Form configuration for Scanned item */
                  <form onSubmit={handleSaveLog} className="space-y-4 flex-1 flex flex-col justify-between">
                    
                    <div className="space-y-3.5 overflow-y-auto max-h-[360px] pr-1">
                      {/* Scanned Badge */}
                      <div className={`p-3 rounded-2xl flex items-center justify-between border ${
                        scannedItem.type === 'employee' && scannedItem.is_authorized === false 
                          ? 'bg-red-50 border-red-200' 
                          : 'bg-emerald-50 border-emerald-100'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            scannedItem.type === 'employee' && scannedItem.is_authorized === false
                              ? 'bg-red-100 text-red-600'
                              : 'bg-emerald-100 text-emerald-600'
                          }`}>
                            {scannedItem.type === 'employee' ? (scannedItem.is_authorized === false ? <Ban size={18} /> : <UserIcon size={18} />) : <Truck size={18} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-bold text-gray-900 leading-none">{scannedItem.name}</h4>
                              {scannedItem.type === 'employee' && scannedItem.is_authorized === false && (
                                <span className="px-1.5 py-0.2 bg-red-100 text-red-700 text-[8px] font-extrabold uppercase rounded border border-red-200">
                                  Bloqueado
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">{scannedItem.detail}</p>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setScannedItem(null)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {scannedItem.type === 'employee' && scannedItem.is_authorized === false && (
                        <div className="p-2.5 bg-red-50 border border-red-300 rounded-xl flex items-start gap-2 text-red-800 shadow-xs animate-pulse">
                          <Ban size={16} className="shrink-0 mt-0.5 text-red-600" />
                          <div className="text-[10px]">
                            <p className="font-extrabold uppercase text-red-900 leading-tight">Atenção: Não Autorizado</p>
                            <p className="text-red-700 font-medium mt-0.5 leading-snug">Funcionário marcado como <strong>NÃO AUTORIZADO</strong> a entrar sem permissão prévia.</p>
                          </div>
                        </div>
                      )}

                      {/* Direction Selection */}
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          type="button"
                          onClick={() => setScanType('IN')}
                          className={`py-2.5 rounded-xl text-xs font-bold uppercase border transition-all ${
                            scanType === 'IN' 
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          Entrada (IN)
                        </button>
                        <button 
                          type="button"
                          onClick={() => setScanType('OUT')}
                          className={`py-2.5 rounded-xl text-xs font-bold uppercase border transition-all ${
                            scanType === 'OUT' 
                              ? 'bg-rose-600 text-white border-rose-600 shadow-sm' 
                              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          Saída (OUT)
                        </button>
                      </div>

                      {/* Dynamic form fields */}
                      {scannedItem.type === 'vehicle' && (
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Quilometragem (KM)</label>
                          <input 
                            type="number"
                            value={km}
                            onChange={e => setKm(e.target.value)}
                            placeholder="0.0"
                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none text-xs"
                            required
                          />
                        </div>
                      )}

                      {scannedItem.type === 'machine' && (
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Horímetro</label>
                          <input 
                            type="number"
                            value={horometer}
                            onChange={e => setHorometer(e.target.value)}
                            placeholder="0.0"
                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none text-xs"
                            required
                          />
                        </div>
                      )}

                      {/* Uniform/Badge checklist for people */}
                      {scannedItem.type === 'employee' && (
                        <div className="bg-gray-100/50 p-3 rounded-2xl space-y-2 border border-gray-200/50">
                          <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">Verificação de Segurança</label>
                          <div className="flex flex-col gap-1 text-[11px] font-bold">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Uniformizado?</span>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => setHasUniform(true)} className={`px-2 py-0.5 rounded ${hasUniform === true ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-600'}`}>Sim</button>
                                <button type="button" onClick={() => setHasUniform(false)} className={`px-2 py-0.5 rounded ${hasUniform === false ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'}`}>Não</button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-gray-600">Com Crachá?</span>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => setHasBadge(true)} className={`px-2 py-0.5 rounded ${hasBadge === true ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-600'}`}>Sim</button>
                                <button type="button" onClick={() => setHasBadge(false)} className={`px-2 py-0.5 rounded ${hasBadge === false ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'}`}>Não</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Destination */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Destino ou Observação</label>
                        <input 
                          type="text"
                          value={destination}
                          onChange={e => setDestination(e.target.value)}
                          placeholder="Frente de trabalho, Portaria, etc."
                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none text-xs"
                        />
                      </div>

                      {/* Photo Capture */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Evidência Fotográfica</label>
                        <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-gray-200 shadow-inner">
                          <div className="w-14 h-14 bg-gray-50 border rounded-xl flex items-center justify-center overflow-hidden">
                            {capturedPhoto ? (
                              <img src={capturedPhoto} alt="Evidência" className="w-full h-full object-cover" />
                            ) : (
                              <Camera size={18} className="text-gray-300" />
                            )}
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-[10px] text-gray-400 leading-tight">Registre uma foto nítida para comprovar a movimentação.</p>
                            <button 
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1.5"
                            >
                              <Camera size={14} />
                              {capturedPhoto ? 'Capturar Nova' : 'Tirar Foto'}
                            </button>
                            <input 
                              type="file"
                              ref={fileInputRef}
                              className="hidden"
                              accept="image/*"
                              capture="environment"
                              onChange={handlePhotoCapture}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={submittingLog}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-md disabled:opacity-50 mt-4 cursor-pointer"
                    >
                      {submittingLog ? 'Salvando...' : 'Confirmar e Sincronizar'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* SCREEN: MANUAL INSERTION */}
          {screen === 'manual' && (
            <div className="flex-1 flex flex-col p-5 space-y-4">
              <div className="flex items-center justify-between">
                <button onClick={() => { setScreen('home'); setManualSearch(''); }} className="p-2 text-gray-500 hover:text-black rounded-lg hover:bg-gray-100 transition-colors">
                  <ArrowLeft size={18} />
                </button>
                <h3 className="text-sm font-bold text-gray-800">Inserção Manual</h3>
                <div className="w-8"></div>
              </div>

              <div className="relative">
                <input 
                  type="text"
                  value={manualSearch}
                  onChange={e => setManualSearch(e.target.value)}
                  placeholder="Nome, CPF, Placa ou Patrimônio..."
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                />
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>

              {/* Search results */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {manualResults.map((item, idx) => (
                  <button 
                    key={idx}
                    onClick={() => {
                      setScannedItem(item);
                      setScreen('scan');
                    }}
                    className={`w-full p-3 rounded-xl text-left active:scale-98 transition-all flex items-center justify-between shadow-xs cursor-pointer border ${
                      item.type === 'employee' && item.is_authorized === false 
                        ? 'bg-red-50/50 hover:bg-red-50 border-red-200' 
                        : 'bg-white hover:border-emerald-500 hover:bg-emerald-50/20 border-gray-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[11px] font-extrabold text-gray-900 truncate">{item.name}</p>
                        {item.type === 'employee' && item.is_authorized === false && (
                          <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.2 bg-red-100 text-red-700 rounded border border-red-200">
                            Não Autorizado
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-gray-400 font-semibold leading-none mt-1">{item.detail}</p>
                    </div>
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      {item.type === 'employee' ? 'Funcionário' : item.type === 'machine' ? 'Máquina' : 'Veículo'}
                    </span>
                  </button>
                ))}
                {manualSearch.trim() !== '' && manualResults.length === 0 && (
                  <p className="text-xs text-gray-400 italic text-center py-6">Nenhum resultado encontrado.</p>
                )}
                {manualSearch.trim() === '' && (
                  <div className="flex flex-col items-center justify-center text-center py-12 text-gray-400">
                    <Search size={32} className="opacity-30 mb-2" />
                    <p className="text-[11px] max-w-xs px-6 italic">Digite o nome, placa ou patrimônio da pessoa/máquina para localizá-la.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar design */}
        <div className="h-6 bg-gray-900 flex items-center justify-center pb-1">
          <div className="w-24 h-1 bg-white/40 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
