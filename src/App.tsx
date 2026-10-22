import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Check,
  X,
  User as UserIcon, 
  Users,
  Truck, 
  Settings, 
  LogIn, 
  LogOut, 
  Search, 
  Plus, 
  Clock, 
  Calendar, 
  ClipboardList,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Ban,
  HardHat,
  Shield,
  ShieldAlert,
  Download,
  Upload,
  Database,
  ArrowRightLeft,
  Trash2,
  Hash,
  Edit2,
  MessageCircle,
  ExternalLink,
  Loader2,
  Delete,
  Camera,
  RefreshCw,
  CheckCheck,
  Sun,
  Lightbulb,
  Smartphone,
  Share,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Employee, 
  Role, 
  Vehicle, 
  Machine, 
  ServiceProvider,
  Log, 
  VEHICLE_BRANDS, 
  MACHINE_TYPES, 
  MACHINE_BRANDS,
  MACHINE_TYPE_SIGLAS
} from './types';
import MobileApp from './components/MobileApp';
import SplashScreen from './components/SplashScreen';

// Firebase Imports
import { 
  db, 
  auth, 
  handleFirestoreError, 
  OperationType,
  collection, 
  query, 
  where, 
  limit, 
  getDocs, 
  getDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  orderBy,
  addDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  increment
} from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Utility Functions
function validateCPF(cpf: string) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  
  // Permite sequências repetidas para fins de teste/desenvolvimento
  // if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i);
  remainder = (sum * 10) % 11;

  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i);
  remainder = (sum * 10) % 11;

  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.substring(10, 11))) return false;

  return true;
}

function formatCPF(value: string) {
  const val = value.replace(/\D/g, '').substring(0, 11);
  let formatted = val;
  if (val.length > 9) formatted = val.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  else if (val.length > 6) formatted = val.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  else if (val.length > 3) formatted = val.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  return formatted;
}

function groupLogsIntoVisits(logs: any[]) {
  const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const visits: any[] = [];
  const processedIds = new Set<string>();

  for (let i = 0; i < sortedLogs.length; i++) {
    const log = sortedLogs[i];
    if (processedIds.has(log.id)) continue;

    if (log.type === 'IN') {
      let matchingOutIndex = -1;
      for (let j = i + 1; j < sortedLogs.length; j++) {
        const nextLog = sortedLogs[j];
        if (nextLog.type === 'OUT' && !processedIds.has(nextLog.id)) {
          // Strict matching logic
          let isMatch = false;

          const logEmpId = (log.employee_id && log.employee_id !== 'N/A') ? log.employee_id : null;
          const nextLogEmpId = (nextLog.employee_id && nextLog.employee_id !== 'N/A') ? nextLog.employee_id : null;
          const logSPId = (log.service_provider_id && log.service_provider_id !== 'N/A') ? log.service_provider_id : null;
          const nextLogSPId = (nextLog.service_provider_id && nextLog.service_provider_id !== 'N/A') ? nextLog.service_provider_id : null;
          const logMacId = (log.machine_id && log.machine_id !== 'N/A') ? log.machine_id : null;
          const nextLogMacId = (nextLog.machine_id && nextLog.machine_id !== 'N/A') ? nextLog.machine_id : null;
          const logVehId = (log.vehicle_id && log.vehicle_id !== 'N/A') ? log.vehicle_id : null;
          const nextLogVehId = (nextLog.vehicle_id && nextLog.vehicle_id !== 'N/A') ? nextLog.vehicle_id : null;
          
          const logCPF = (log.cpf || log.service_provider_cpf || '').toString().trim();
          const nextLogCPF = (nextLog.cpf || nextLog.service_provider_cpf || '').toString().trim();
          const isValidCPF = logCPF && logCPF !== '-' && logCPF !== 'N/A' && logCPF !== '';

          const logName = (log.employeeName || log.employee_name || '').toString().trim();
          const nextLogName = (nextLog.employeeName || nextLog.employee_name || '').toString().trim();
          const isValidName = logName && logName !== 'N/A' && logName !== '-' && logName !== '';

          // 1. Match by Employee ID
          if (logEmpId || nextLogEmpId) {
            isMatch = logEmpId === nextLogEmpId && logEmpId !== null;
          } 
          // 2. Match by Service Provider ID
          else if (logSPId || nextLogSPId) {
            isMatch = logSPId === nextLogSPId && logSPId !== null;
          }
          // 3. Match by Machine ID (Critical for machine logs)
          else if (logMacId || nextLogMacId) {
            isMatch = logMacId === nextLogMacId && logMacId !== null;
          }
          // 4. Match by Vehicle ID
          else if (logVehId || nextLogVehId) {
            isMatch = logVehId === nextLogVehId && logVehId !== null;
          }
          // 5. Match by CPF
          else if (isValidCPF) {
            isMatch = logCPF === nextLogCPF;
          }
          // 6. Match by Name
          else if (isValidName) {
            isMatch = logName === nextLogName;
          }

          if (isMatch) {
            matchingOutIndex = j;
            break;
          }
        }
      }

      if (matchingOutIndex !== -1) {
        const outLog = sortedLogs[matchingOutIndex];
        visits.push({
          id: log.id,
          inLog: log,
          outLog: outLog,
          date: new Date(log.timestamp).toLocaleDateString('pt-BR'),
          entryTime: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          exitTime: new Date(outLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          name: log.employeeName || log.visitorName || log.serviceProviderName || log.employee_name || outLog.employeeName || outLog.visitorName || outLog.serviceProviderName || outLog.employee_name || '-',
          cpf: log.cpf || log.service_provider_cpf || outLog.cpf || outLog.service_provider_cpf || '-',
          role: log.role || outLog.role || '-',
          machine: log.machineInfo !== '-' ? log.machineInfo : (outLog.machineInfo !== '-' ? outLog.machineInfo : '-'),
          vehicle: log.vehicleInfo !== '-' ? log.vehicleInfo : (outLog.vehicleInfo !== '-' ? outLog.vehicleInfo : '-'),
          photo: log.photo || outLog.photo || null,
          km: log.km !== null && log.km !== undefined ? log.km : (outLog.km !== null && outLog.km !== undefined ? outLog.km : '-'),
          horometer: log.horometer !== null && log.horometer !== undefined ? log.horometer : (outLog.horometer !== null && outLog.horometer !== undefined ? outLog.horometer : '-'),
          checklist: log.has_uniform !== null ? `U:${log.has_uniform ? 'SIM' : 'NÃO'} C:${log.has_badge ? 'SIM' : 'NÃO'}` : '-',
          category: log.visitorType || (log.employee_id ? 'Funcionário' : log.visitor_type === 'VISITOR' ? 'Visitante' : log.visitor_type === 'SERVICE_PROVIDER' ? 'Prestador' : '-'),
          destination: log.destination || outLog.destination || '-'
        });
        processedIds.add(log.id);
        processedIds.add(outLog.id);
      } else {
        visits.push({
          id: log.id,
          inLog: log,
          outLog: null,
          date: new Date(log.timestamp).toLocaleDateString('pt-BR'),
          entryTime: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          exitTime: '-',
          name: log.employeeName || log.visitorName || log.serviceProviderName || log.employee_name || '-',
          cpf: log.cpf || log.service_provider_cpf || '-',
          role: log.role || '-',
          machine: log.machineInfo || '-',
          vehicle: log.vehicleInfo || '-',
          photo: log.photo || null,
          km: log.km !== null && log.km !== undefined ? log.km : '-',
          horometer: log.horometer !== null && log.horometer !== undefined ? log.horometer : '-',
          checklist: log.has_uniform !== null ? `U:${log.has_uniform ? 'SIM' : 'NÃO'} C:${log.has_badge ? 'SIM' : 'NÃO'}` : '-',
          category: log.visitorType || (log.employee_id ? 'Funcionário' : log.visitor_type === 'VISITOR' ? 'Visitante' : log.visitor_type === 'SERVICE_PROVIDER' ? 'Prestador' : '-'),
          destination: log.destination || '-'
        });
        processedIds.add(log.id);
      }
    } else {
      visits.push({
        id: log.id,
        inLog: null,
        outLog: log,
        date: new Date(log.timestamp).toLocaleDateString('pt-BR'),
        entryTime: '-',
        exitTime: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        name: log.employeeName || log.visitorName || log.serviceProviderName || log.employee_name || '-',
        cpf: log.service_provider_cpf || '-',
        role: log.role || '-',
        machine: log.machineInfo || '-',
        vehicle: log.vehicleInfo || '-',
        photo: log.photo || null,
        km: log.km !== null && log.km !== undefined ? log.km : '-',
        horometer: log.horometer !== null && log.horometer !== undefined ? log.horometer : '-',
        checklist: log.has_uniform !== null ? `U:${log.has_uniform ? 'SIM' : 'NÃO'} C:${log.has_badge ? 'SIM' : 'NÃO'}` : '-',
        category: log.visitorType || (log.employee_id ? 'Funcionário' : log.visitor_type === 'VISITOR' ? 'Visitante' : log.visitor_type === 'SERVICE_PROVIDER' ? 'Prestador' : '-'),
        destination: log.destination || '-'
      });
      processedIds.add(log.id);
    }
  }
  return visits.sort((a, b) => {
    const timeA = new Date(a.inLog?.timestamp || a.outLog?.timestamp).getTime();
    const timeB = new Date(b.inLog?.timestamp || b.outLog?.timestamp).getTime();
    return timeB - timeA;
  });
}

const DEFAULT_LOGO = '';

// Error Boundary Component
export class ErrorBoundary extends React.Component<any, any> {
  public state: any;
  public props: any;

  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-4">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Algo deu errado</h1>
            <p className="text-gray-500">Ocorreu um erro inesperado. Por favor, recarregue a página.</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all"
            >
              Recarregar Sistema
            </button>
            {process.env.NODE_ENV === 'development' && (
              <pre className="mt-4 p-4 bg-gray-100 rounded-xl text-left text-xs overflow-auto max-h-40">
                {this.state.error?.message || String(this.state.error)}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function ConfirmationModal({ message, onConfirm, onCancel }: { message: string, onConfirm: () => void | Promise<void>, onCancel: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-black/5"
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Confirmação</h3>
          <p className="text-gray-600 leading-relaxed">{message}</p>
          <div className="flex gap-3 w-full mt-4">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-6 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 px-6 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                'Confirmar'
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function checkIsMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isCoarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const isSmallScreen = window.innerWidth <= 768;
  return isMobileUA || (hasTouch && (isCoarse || isSmallScreen));
}

function NumericKeypad({ 
  isOpen, 
  onClose, 
  value: initialValue, 
  onChange, 
  title = "Teclado Numérico" 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  value: string, 
  onChange: (val: string) => void,
  title?: string
}) {
  const [internalValue, setInternalValue] = React.useState(initialValue);

  React.useEffect(() => {
    if (isOpen) {
      setInternalValue(initialValue);
    }
  }, [isOpen, initialValue]);

  const handleNumberClick = React.useCallback((num: string) => {
    const cleanValue = internalValue.replace(/\D/g, '');
    if (cleanValue.length < 11) {
      const newValue = formatCPF(cleanValue + num);
      setInternalValue(newValue);
      onChange(newValue);
    }
  }, [internalValue, onChange]);

  const handleBackspace = React.useCallback(() => {
    const cleanValue = internalValue.replace(/\D/g, '');
    if (cleanValue.length > 0) {
      const newValue = formatCPF(cleanValue.slice(0, -1));
      setInternalValue(newValue);
      onChange(newValue);
    }
  }, [internalValue, onChange]);

  const handleClear = React.useCallback(() => {
    setInternalValue('');
    onChange('');
  }, [onChange]);

  // Physical keyboard listener for when modal is open
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleNumberClick(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNumberClick, handleBackspace, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="bg-white w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-900">{title}</h3>
            <p className="text-[10px] text-gray-400">Digite no painel abaixo ou pelo teclado</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-all">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Display area in the keypad */}
        <div className="p-4 bg-gray-50 border-b border-gray-100">
          <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 text-center text-2xl font-mono tracking-widest text-gray-900 h-14 flex items-center justify-center">
            {internalValue || <span className="text-gray-300">000.000.000-00</span>}
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-3 gap-3 bg-white">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleNumberClick(num.toString())}
              className="h-16 rounded-2xl bg-gray-50 text-2xl font-bold text-gray-900 hover:bg-gray-100 active:scale-95 transition-all flex items-center justify-center border border-gray-100"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-16 rounded-2xl bg-red-50 text-red-600 font-bold hover:bg-red-100 active:scale-95 transition-all flex items-center justify-center border border-red-100 text-xs uppercase tracking-wider"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={() => handleNumberClick('0')}
            className="h-16 rounded-2xl bg-gray-50 text-2xl font-bold text-gray-900 hover:bg-gray-100 active:scale-95 transition-all flex items-center justify-center border border-gray-100"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-16 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center border border-gray-200"
          >
            <Delete size={24} />
          </button>
        </div>
        
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-black/20"
          >
            Confirmar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SmartCPFInput({
  value,
  onChange,
  onOpenKeypad,
  placeholder = "000.000.000-00",
  className = "",
  title = "CPF",
  required = false,
  autoFocus = false,
  maxLength = 14,
  id,
  isMobileApp = false
}: {
  value: string;
  onChange: (val: string) => void;
  onOpenKeypad?: (config: { isOpen: boolean; value: string; onChange: (v: string) => void; title: string }) => void;
  placeholder?: string;
  className?: string;
  title?: string;
  required?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  id?: string;
  isMobileApp?: boolean;
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsMobile(Boolean(isMobileApp || checkIsMobileDevice()));
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [isMobileApp]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    onChange(formatted);
  };

  const handleTriggerMobileKeypad = (e: React.SyntheticEvent) => {
    if (isMobile && onOpenKeypad) {
      e.preventDefault();
      onOpenKeypad({
        isOpen: true,
        value,
        onChange,
        title
      });
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode={isMobile ? "none" : "numeric"}
      value={value}
      onChange={handleChange}
      onClick={handleTriggerMobileKeypad}
      onFocus={(e) => {
        if (isMobile && onOpenKeypad) {
          e.target.blur();
          handleTriggerMobileKeypad(e);
        }
      }}
      readOnly={isMobile}
      placeholder={placeholder}
      className={`${className} ${isMobile ? 'cursor-pointer' : 'cursor-text'}`}
      required={required}
      maxLength={maxLength}
      autoFocus={autoFocus}
    />
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [watchman, setWatchman] = useState<Employee | null>(null);
  const [confirmingWatchman, setConfirmingWatchman] = useState<Employee | null>(null);
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [googleLoggingIn, setGoogleLoggingIn] = useState(false);
  const [googleAuthErrorDetail, setGoogleAuthErrorDetail] = useState<string | null>(null);
  const [showFirebaseConfigImporter, setShowFirebaseConfigImporter] = useState(false);
  const [pastedFirebaseConfig, setPastedFirebaseConfig] = useState('');
  const [configImportSuccess, setConfigImportSuccess] = useState('');
  const [configImportLoading, setConfigImportLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('logs');
  const [activeShifts, setActiveShifts] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [settings, setSettings] = useState({ 
    company_name: 'VigiaControl', 
    company_logo: '',
    client_company_name: '',
    report_whatsapp: ''
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isMobileMode, setIsMobileMode] = useState(false);
  const [overdueShifts, setOverdueShifts] = useState<any[]>([]);
  const [keypadConfig, setKeypadConfig] = useState<{
    isOpen: boolean;
    value: string;
    onChange: (val: string) => void;
    title?: string;
  }>({
    isOpen: false,
    value: '',
    onChange: () => {},
    title: 'Teclado Numérico'
  });

  // Keep screen always on (Screen Wake Lock API)
  const [wakeLock, setWakeLock] = useState<any | null>(null);
  const [isWakeLocked, setIsWakeLocked] = useState(false);

  // PWA elements and prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const requestWakeLock = async () => {
    if (!('wakeLock' in navigator)) {
      return;
    }
    try {
      if (wakeLock) {
        await wakeLock.release().catch(() => {});
      }
      const lock = await (navigator as any).wakeLock.request('screen');
      setWakeLock(lock);
      setIsWakeLocked(true);
      
      lock.addEventListener('release', () => {
        setIsWakeLocked(false);
      });
    } catch {
      setIsWakeLocked(false);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLock) {
      try {
        await wakeLock.release();
      } catch {
        // Ignored
      }
      setWakeLock(null);
      setIsWakeLocked(false);
    }
  };

  const toggleWakeLock = async () => {
    if (isWakeLocked) {
      await releaseWakeLock();
      setNotification({ message: 'Modo manter tela ligada desativado.', type: 'error' });
    } else {
      await requestWakeLock();
      if ('wakeLock' in navigator) {
        setNotification({ message: 'Modo manter tela ligada ATIVADO!', type: 'success' });
      } else {
        setNotification({ message: 'Seu navegador não suporta manter a tela ligada programaticamente.', type: 'error' });
      }
    }
  };

  // Manage Wake Lock automatically when logged in
  useEffect(() => {
    if (watchman) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && watchman) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [watchman]);

  // Server Keep-Alive Ping (prevents Cloud Run from sleeping while app is active)
  useEffect(() => {
    if (!watchman) return;

    fetch('/test').catch(() => {});

    const interval = setInterval(() => {
      fetch('/test').catch(() => {});
    }, 120000); // 120 seconds

    return () => clearInterval(interval);
  }, [watchman]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Manage PWA installable states and events
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = sessionStorage.getItem('vigia_control_install_dismissed');
      if (dismissed !== 'true') {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detect iOS (Share -> Add to Home Screen)
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    const isStandalone = (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;

    if (isIosDevice && !isStandalone) {
      const dismissed = sessionStorage.getItem('vigia_control_install_dismissed');
      if (dismissed !== 'true') {
        setIsIOS(true);
        setShowInstallBanner(true);
      }
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
      setNotification({ message: 'Vigia Control instalado com sucesso!', type: 'success' });
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        setNotification({ 
          message: 'Instruções abertas abaixo!', 
          type: 'success' 
        });
      } else {
        setNotification({
          message: 'Abra as configurações do seu navegador e selecione "Instalar aplicativo" ou "Instalar página".',
          type: 'success'
        });
      }
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    }
  };

  const dismissInstallPrompt = () => {
    sessionStorage.setItem('vigia_control_install_dismissed', 'true');
    setShowInstallBanner(false);
  };

  useEffect(() => {
    if (watchman?.is_admin) {
      const checkOverdueShifts = async () => {
        try {
          const q = query(
            collection(db, 'shifts'),
            where('status', '==', 'ACTIVE')
          );
          const snap = await getDocs(q);
          const now = new Date();
          const overdue = snap.docs
            .map(doc => ({ ...doc.data(), id: doc.id }) as any)
            .filter(shift => {
              const startTime = new Date(shift.start_time);
              const diffHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
              return diffHours > 24;
            });
          
          if (overdue.length > 0) {
            setOverdueShifts(overdue);
          }
        } catch {
          // Ignored
        }
      };
      checkOverdueShifts();
    } else {
      setOverdueShifts([]);
    }
  }, [watchman?.is_admin]);

  // Initial restoration from localStorage
  useEffect(() => {
    const savedWatchman = localStorage.getItem('vigia_control_watchman');
    if (savedWatchman) {
      try {
        const parsed = JSON.parse(savedWatchman);
        setWatchman(parsed);
        
        const savedTab = localStorage.getItem('vigia_control_activeTab');
        if (savedTab) {
          setActiveTab(savedTab);
        }

        const savedShift = localStorage.getItem('vigia_control_shiftId');
        if (savedShift) {
          setShiftId(savedShift);
        }
      } catch {
        // Ignored
      }
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    // Safety timeout for auth readiness
    const authTimeout = setTimeout(() => {
      if (!isAuthReady) {
        setAuthError("O sistema está demorando mais que o esperado para carregar. Verifique sua conexão ou tente recarregar a página.");
      }
    }, 15000); // 15 seconds

    // Listen for auth changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userEmail = (currentUser.email || '').toLowerCase().trim();
        try {
          const empSnap = await getDocs(query(collection(db, 'employees')));
          const allEmps = empSnap.docs.map(d => ({ ...d.data(), id: d.id }) as Employee);
          
          const existingAdmin = allEmps.find(e => 
            e.email && e.email.toLowerCase().trim() === userEmail && e.is_admin
          );

          const isInitialOwner = userEmail === 'nickdesignergrafico@gmail.com';
          const hasAnyAdminRegistered = allEmps.some(e => e.is_admin);

          if (existingAdmin || isInitialOwner || !hasAnyAdminRegistered) {
            setUser(currentUser);
            const adminProfile: Employee = existingAdmin ? {
              ...existingAdmin,
              photo: existingAdmin.photo || currentUser.photoURL || null
            } : {
              id: currentUser.uid || 'admin',
              name: currentUser.displayName || (userEmail ? userEmail.split('@')[0] : 'Administrador'),
              email: userEmail,
              cpf: '',
              role_id: 'admin',
              role_name: 'Administrador Master',
              photo: currentUser.photoURL || null,
              is_watchman: true,
              is_admin: true
            };

            if (!existingAdmin && (isInitialOwner || !hasAnyAdminRegistered)) {
              await addDoc(collection(db, 'employees'), {
                name: adminProfile.name,
                email: userEmail,
                cpf: '',
                role_id: 'admin',
                role_name: 'Administrador Master',
                photo: adminProfile.photo,
                is_watchman: true,
                is_admin: true,
                created_at: new Date().toISOString()
              });
            }

            setWatchman(adminProfile);
            setShiftId('admin_view');
            setActiveTab('admin_dashboard');
            localStorage.setItem('vigia_control_watchman', JSON.stringify(adminProfile));
            localStorage.setItem('vigia_control_activeTab', 'admin_dashboard');
            localStorage.setItem('vigia_control_shiftId', 'admin_view');
          } else {
            // Unregistered user attempting to access admin panel
            await signOut(auth);
            setUser(null);
            setWatchman(null);
            localStorage.removeItem('vigia_control_watchman');
            localStorage.removeItem('vigia_control_activeTab');
            localStorage.removeItem('vigia_control_shiftId');
            setError('Acesso Negado: Usuário Não Cadastrado');
            setGoogleAuthErrorDetail(
              `A conta Google (${currentUser.email}) não possui cadastro de Administrador no sistema.\n\nSomente pessoas cadastradas previamente no menu "Funcionários" com a opção "Administrador" ativada têm autorização para acessar o painel.`
            );
          }
        } catch (err) {
          console.error("Error verifying admin auth state:", err);
          setUser(null);
          setWatchman(null);
        }
      } else {
        setUser(null);
        setWatchman(null);
        localStorage.removeItem('vigia_control_watchman');
      }
      setIsAuthReady(true);
    });

    return () => {
      clearInterval(timer);
      clearTimeout(authTimeout);
      unsubscribeAuth();
    };
  }, []);

  // Listen for Settings and Active Shifts only when authenticated
  useEffect(() => {
    if (!isAuthReady || !user) {
      // If logged out or auth not ready, reset settings and active shifts to default/empty
      setSettings({ 
        company_name: 'VigiaControl', 
        company_logo: '',
        client_company_name: '',
        report_whatsapp: ''
      });
      setActiveShifts([]);
      return;
    }

    // Listen for Settings
    const settingsUnsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as any);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });

    // Initial settings load
    getDoc(doc(db, 'settings', 'global')).then((snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as any);
      }
    }).catch(err => handleFirestoreError(err, OperationType.GET, 'settings/global'));

    // Listen for Active Shifts (Online Watchmen)
    const shiftsQuery = query(collection(db, 'shifts'), where('status', '==', 'ACTIVE'));
    const shiftsUnsubscribe = onSnapshot(shiftsQuery, async (snapshot) => {
      const shifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Fetch watchman names for these shifts
      const shiftsWithNames = await Promise.all(shifts.map(async (s: any) => {
        if (!s.watchman_id || s.watchman_id === 'admin') return null;

        const wDoc = await getDoc(doc(db, 'employees', s.watchman_id));
        if (!wDoc.exists()) {
          return null;
        }
        
        const wData = wDoc.data();
        if (wData.is_admin) return null;

        return {
          ...s,
          watchman_name: wData.name
        };
      }));
      
      setActiveShifts(shiftsWithNames.filter(s => s !== null));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'shifts');
    });

    return () => {
      settingsUnsubscribe();
      shiftsUnsubscribe();
    };
  }, [isAuthReady, user]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Seed initial data if empty
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const seedInitialData = async () => {
      try {
        // Roles Management
        const rolesRef = collection(db, 'roles');
        const rolesSnap = await getDocs(rolesRef);
        const currentRoles = rolesSnap.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
        
        const rolesToAdd = [
          "Vigia", "Motorista", "Operador", "Encarregado", "Engenheiro",
          "Mecânico", "Auxiliar de Mecânico", "Almoxarifado", 
          "Gerente Administrativo", "Gerente de Oficina Mecânica"
        ];
        const rolesToRemove = ["Administrativo", "Gerente"];

        // Add missing roles
        for (const roleName of rolesToAdd) {
          if (!currentRoles?.find(r => r.name === roleName)) {
            await addDoc(rolesRef, { name: roleName });
          }
        }

        // Remove unwanted roles (only if they exist)
        for (const roleName of rolesToRemove) {
          const roleToDelete = currentRoles?.find(r => r.name === roleName);
          if (roleToDelete) {
            await deleteDoc(doc(db, 'roles', roleToDelete.id));
          }
        }

        // Settings
        const settingsRef = doc(db, 'settings', 'global');
        const settingsSnap = await getDoc(settingsRef);
        if (!settingsSnap.exists()) {
          await setDoc(settingsRef, {
            company_name: 'VigiaControl',
            company_logo: DEFAULT_LOGO,
            client_company_name: '',
            report_email: '',
            smtp_host: '',
            smtp_port: '587',
            smtp_user: '',
            smtp_pass: ''
          });
        }
      } catch {
        // Silently catch permission issues on seeding
      }
    };

    seedInitialData();
  }, [isAuthReady, user]);

  // Listen for Active Shift (Real-time)
  useEffect(() => {
    if (!watchman) {
      setShiftId(null);
      return;
    }

    // Real-time listener for active shift
    const q = query(
      collection(db, 'shifts'), 
      where('watchman_id', '==', watchman.id), 
      where('status', '==', 'ACTIVE'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const shiftDoc = snapshot.docs[0];
        const shiftData = shiftDoc.data();
        const startTime = new Date(shiftData.start_time);
        const now = new Date();
        const diffHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        
        if (diffHours > 18) {
          updateDoc(doc(db, 'shifts', shiftDoc.id), { 
            status: 'CLOSED', 
            end_time: now.toISOString(),
            auto_closed: true,
            report_sent: false
          });
          setShiftId(null);
        } else {
          setShiftId(shiftDoc.id);
        }
      } else {
        setShiftId(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'shifts');
    });

    return () => unsubscribe();
  }, [watchman]);

  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('vigia_control_activeTab', activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    if (shiftId) {
      localStorage.setItem('vigia_control_shiftId', shiftId);
    } else {
      localStorage.removeItem('vigia_control_shiftId');
    }
  }, [shiftId]);

  const [copiedDomain, setCopiedDomain] = useState(false);

  const copyHostnameToClipboard = () => {
    if (typeof window !== 'undefined' && window.location.hostname) {
      navigator.clipboard.writeText(window.location.hostname);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 3000);
    }
  };

  const handleLogin = async () => {
    setError('');
    setGoogleAuthErrorDetail(null);
    setGoogleLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;
      
      setUser(googleUser);

      const userEmail = (googleUser.email || '').toLowerCase().trim();

      // Check if user is registered as admin in Firestore
      try {
        const empQuery = query(collection(db, 'employees'));
        const empSnap = await getDocs(empQuery);
        const allEmps = empSnap.docs.map(d => ({ ...d.data(), id: d.id }) as Employee);
        
        const existingAdmin = allEmps.find(e => 
          e.email && e.email.toLowerCase().trim() === userEmail && e.is_admin
        );

        const settingsAdminEmail = (settings.admin_email || '').toLowerCase().trim();
        const isAdminInSettings = settingsAdminEmail && settingsAdminEmail === userEmail;

        const hasAnyAdminRegistered = allEmps.some(e => e.is_admin) || Boolean(settingsAdminEmail);

        if (existingAdmin || isAdminInSettings || !hasAnyAdminRegistered) {
          let adminProfile: Employee;

          if (existingAdmin) {
            adminProfile = {
              ...existingAdmin,
              photo: existingAdmin.photo || googleUser.photoURL || null
            };
          } else {
            // First admin or matching settings
            adminProfile = {
              id: googleUser.uid || 'admin',
              name: googleUser.displayName || (userEmail ? userEmail.split('@')[0] : 'Administrador'),
              email: userEmail,
              cpf: '',
              role_id: 'admin',
              role_name: 'Administrador Master',
              photo: googleUser.photoURL || null,
              is_watchman: true,
              is_admin: true
            };

            // If no admin existed, save as initial admin in Firestore
            if (!hasAnyAdminRegistered) {
              await addDoc(collection(db, 'employees'), {
                name: adminProfile.name,
                email: userEmail,
                cpf: '',
                role_id: 'admin',
                role_name: 'Administrador Master',
                photo: adminProfile.photo,
                is_watchman: true,
                is_admin: true,
                created_at: new Date().toISOString()
              });
            }
          }

          setWatchman(adminProfile);
          setShiftId('admin_view');
          setActiveTab('admin_dashboard');
          localStorage.setItem('vigia_control_watchman', JSON.stringify(adminProfile));
          localStorage.setItem('vigia_control_activeTab', 'admin_dashboard');
          localStorage.setItem('vigia_control_shiftId', 'admin_view');
          setNotification({
            message: `Acesso Administrador autorizado! Bem-vindo(a), ${adminProfile.name}.`,
            type: 'success'
          });
        } else {
          // User authenticated via Google but not authorized as admin in Firestore
          await signOut(auth);
          setUser(null);
          setWatchman(null);
          localStorage.removeItem('vigia_control_watchman');
          localStorage.removeItem('vigia_control_activeTab');
          localStorage.removeItem('vigia_control_shiftId');
          
          setError('Acesso Negado: Usuário Não Cadastrado');
          setGoogleAuthErrorDetail(
            `A conta Google (${googleUser.email}) não possui cadastro de Administrador no sistema.\n\nPara ter acesso:\n1. Solicite a um administrador autorizado que cadastre seu e-mail (${googleUser.email}) no menu "Funcionários" com a opção "Administrador" ativada;\n2. Ou entre com uma conta Google que já esteja devidamente cadastrada como Administrador.`
          );
        }
      } catch (dbErr) {
        console.warn("Could not check Firestore admin permissions:", dbErr);
        await signOut(auth);
        setUser(null);
        setWatchman(null);
        setError('Erro de Verificação');
        setGoogleAuthErrorDetail('Não foi possível verificar as permissões de acesso no banco de dados. Tente novamente em instantes.');
      }
    } catch (err: any) {
      console.error("Firebase Google login error:", err);
      
      const errorCode = err.code || '';
      const errorMessage = err.message || '';
      
      let friendlyError = 'Falha ao autenticar com a Conta Google.';
      let diagnosticHelp = '';

      if (errorCode === 'auth/unauthorized-domain' || errorMessage.includes('unauthorized-domain')) {
        friendlyError = 'Domínio Não Autorizado no Firebase.';
        diagnosticHelp = `O domínio "${window.location.hostname}" precisa ser adicionado aos "Domínios Autorizados" no Console do Firebase do seu projeto.`;
      } else if (errorCode === 'auth/popup-blocked' || errorMessage.includes('popup-blocked')) {
        friendlyError = 'Janela Popup Bloqueada.';
        diagnosticHelp = 'Seu navegador impediu a abertura da janela de login do Google. Por favor, libere popups para este site nas configurações do seu navegador (clique no ícone de bloqueio na barra de endereços) e tente novamente.';
      } else if (errorCode === 'auth/popup-closed-by-user') {
        friendlyError = 'Login cancelado.';
        diagnosticHelp = 'A janela de login do Google foi fechada antes da confirmação.';
      } else if (errorCode === 'auth/operation-not-allowed' || errorMessage.includes('operation-not-allowed')) {
        friendlyError = 'Login Google Desativado.';
        diagnosticHelp = 'O login com o Google não está ativo no Console do Firebase deste projeto. Acesse "Authentication" > "Sign-in method" e ative o provedor Google.';
      } else if (errorCode === 'auth/network-request-failed' || errorMessage.includes('network-request-failed')) {
        friendlyError = 'Erro de Rede no Navegador.';
        diagnosticHelp = 'Houve uma falha de rede ao tentar conectar com os servidores de login. Verifique se o seu navegador está bloqueando cookies de terceiros ou se há extensões de segurança (como adblockers) impedindo a conexão.';
      } else {
        diagnosticHelp = `Detalhe técnico (${errorCode || 'erro'}): ${errorMessage}. Certifique-se de que sua conta está cadastrada como Administrador no sistema.`;
      }

      setError(friendlyError);
      setGoogleAuthErrorDetail(diagnosticHelp);
    } finally {
      setGoogleLoggingIn(false);
    }
  };

  const handleSaveFirebaseConfig = async () => {
    setError('');
    setConfigImportSuccess('');
    setGoogleAuthErrorDetail(null);
    
    if (!pastedFirebaseConfig.trim()) {
      setError('Por favor, cole as configurações do Firebase em formato JSON.');
      return;
    }

    try {
      // Validate JSON
      const parsedConfig = JSON.parse(pastedFirebaseConfig.trim());
      
      if (!parsedConfig.projectId || !parsedConfig.apiKey) {
        setError('Configuração inválida. O JSON deve conter pelo menos "projectId" e "apiKey".');
        return;
      }

      setConfigImportLoading(true);
      
      const res = await fetch('/api/save-firebase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: parsedConfig })
      });

      const data = await res.json();
      if (data.success) {
        setConfigImportSuccess('Conectado com sucesso ao seu projeto Firebase antigo! O sistema será recarregado em 3 segundos para atualizar todos os dados.');
        setPastedFirebaseConfig('');
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        setError('Erro ao salvar configuração: ' + data.error);
      }
    } catch (err: any) {
      setError('O texto colado não é um JSON válido. Certifique-se de copiar todo o conteúdo do arquivo firebase-applet-config.json.');
    } finally {
      setConfigImportLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('vigia_control_bypass_user');
      localStorage.removeItem('vigia_control_watchman');
      localStorage.removeItem('vigia_control_activeTab');
      localStorage.removeItem('vigia_control_shiftId');
      localStorage.removeItem('vigia_control_draft_log');
      localStorage.removeItem('vigia_control_draft_visitor_access');
      setWatchman(null);
      setShiftId(null);
      setUser(null);
    } catch (err: any) {
      console.error("Error logging out:", err);
    }
  };

  const handleStartShift = async () => {
    if (!watchman) return;
    setLoginLoading(true);
    try {
      // Check for existing active shift first to prevent duplicates
      const q = query(
        collection(db, 'shifts'),
        where('watchman_id', '==', watchman.id),
        where('status', '==', 'ACTIVE'),
        limit(1)
      );
      const activeSnap = await getDocs(q);
      
      if (!activeSnap.empty) {
        setShiftId(activeSnap.docs[0].id);
        setActiveTab('logs');
        setNotification({ message: 'Você já possui um turno ativo.', type: 'info' });
        return;
      }

      const shiftRef = await addDoc(collection(db, 'shifts'), {
        watchman_id: watchman.id,
        watchman_name: watchman.name,
        start_time: new Date().toISOString(),
        status: 'ACTIVE'
      });
      
      setShiftId(shiftRef.id);
      setActiveTab('logs');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shifts');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleEndShift = async () => {
    if (!shiftId) return;
    
    setConfirmAction({
      message: 'Deseja realmente encerrar sua jornada e enviar o relatório?',
      onConfirm: async () => {
        try {
          // 1. Fetch logs for the report
          const q = query(collection(db, 'logs'), where('shift_id', '==', shiftId));
          const logsSnap = await getDocs(q);
          const rawLogs = logsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
          
          // 2. Collect unique IDs to fetch in bulk (or at least once per ID)
          const employeeIds = [...new Set(rawLogs.map((l: any) => l.employee_id).filter(Boolean))];
          const vehicleIds = [...new Set(rawLogs.map((l: any) => l.vehicle_id).filter(Boolean))];
          const machineIds = [...new Set(rawLogs.map((l: any) => l.machine_id).filter(Boolean))];

          // Fetch related data in parallel but only once per ID
          const [employees, vehicles, machines] = await Promise.all([
            Promise.all(employeeIds.map(id => getDoc(doc(db, 'employees', id as string)))),
            Promise.all(vehicleIds.map(id => getDoc(doc(db, 'vehicles', id as string)))),
            Promise.all(machineIds.map(id => getDoc(doc(db, 'machines', id as string))))
          ]);

          const employeeMap = Object.fromEntries(employees.map(d => [d.id, d.exists() ? d.data() : null]));
          const vehicleMap = Object.fromEntries(vehicles.map(d => [d.id, d.exists() ? d.data() : null]));
          const machineMap = Object.fromEntries(machines.map(d => [d.id, d.exists() ? d.data() : null]));

          // 3. Resolve names for the report
          const logsData = rawLogs.map((log: any) => {
            let employeeName = log.employee_name || 'Visitante/Outro';
            if (log.employee_id) {
              const emp = employeeMap[log.employee_id];
              if (emp) employeeName = emp.name;
            }

            let assetName = log.vehicle_plate || log.machine_asset || '-';
            if (log.vehicle_id) {
              const v = vehicleMap[log.vehicle_id];
              if (v) assetName = `${v.brand} ${v.model || ''} (${v.plate || ''})`;
            } else if (log.machine_id) {
              const m = machineMap[log.machine_id];
              if (m) assetName = `${m.type} ${m.brand} (${m.asset_number || ''})`;
            }

            return {
              ...log,
              employeeName,
              assetName
            };
          }).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

          // 4. Get Shift Info
          const shiftDoc = await getDoc(doc(db, 'shifts', shiftId));
          if (!shiftDoc.exists()) throw new Error("Jornada não encontrada");
          const shiftData = shiftDoc.data();

          // 5. Update shift status in Firestore
          await updateDoc(doc(db, 'shifts', shiftId), {
            status: 'CLOSED',
            end_time: new Date().toISOString(),
            report_sent: true
          });

          // 6. Call backend to send email
          const response = await fetch('/api/shift/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              shiftId,
              logs: logsData,
              settings: settings,
              watchmanName: watchman?.name || 'Vigia',
              startTime: shiftData?.start_time || new Date().toISOString()
            })
          });

          const result = await response.json();
          
          // 7. Send via WhatsApp if configured
          if (settings.report_whatsapp) {
            const whatsappNumber = settings.report_whatsapp.replace(/\D/g, '');
            const companyName = settings.company_name || 'VigiaControl';
            const clientName = settings.client_company_name ? ` - ${settings.client_company_name}` : '';
            
            let message = `*RELATÓRIO DE TURNO - ${companyName}${clientName}*\n\n`;
            message += `*Vigia:* ${watchman?.name || 'N/A'}\n`;
            message += `*Início:* ${new Date(shiftData?.start_time).toLocaleString('pt-BR')}\n`;
            message += `*Fim:* ${new Date().toLocaleString('pt-BR')}\n\n`;
            message += `*REGISTROS (${logsData.length}):*\n`;
            
            logsData.forEach((log: any, index: number) => {
              const time = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const type = log.type === 'IN' ? 'ENTRADA' : 'SAÍDA';
              message += `\n${index + 1}. [${time}] *${type}*\n`;
              message += `   Pessoa: ${log.employeeName}\n`;
              if (log.assetName !== '-') message += `   Veículo/Máquina: ${log.assetName}\n`;
              if (log.km) message += `   KM: ${log.km}\n`;
              if (log.horometer) message += `   Horímetro: ${log.horometer}\n`;
              if (log.destination) message += `   Destino: ${log.destination}\n`;
              if (log.has_uniform !== null) message += `   Uniforme: ${log.has_uniform ? 'OK' : 'NÃO'}\n`;
              if (log.has_badge !== null) message += `   Crachá: ${log.has_badge ? 'OK' : 'NÃO'}\n`;
            });

            const encodedMessage = encodeURIComponent(message);
            const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
            window.open(whatsappUrl, '_blank');
          }

          if (result.success) {
            setNotification({ message: 'Jornada encerrada com sucesso! Relatório enviado.', type: 'success' });
          } else {
            setNotification({ message: 'Jornada encerrada, mas houve um problema ao enviar o e-mail. Verifique o WhatsApp.', type: 'error' });
          }

          setWatchman(null);
          setShiftId(null);
          setActiveTab('logs');
          localStorage.removeItem('vigia_control_watchman');
          // Removed handleLogout() to keep Admin session active
        } catch (err: any) {
          console.error("Error ending shift:", err);
          const errorMsg = err.message || 'Erro desconhecido';
          setNotification({ 
            message: `Erro ao encerrar jornada: ${errorMsg}. Verifique se todos os dados foram salvos.`, 
            type: 'error' 
          });
        } finally {
          setConfirmAction(null);
        }
      }
    });
  };

  const handleConfirmIdentity = () => {
    if (!confirmingWatchman) return;
    setWatchman(confirmingWatchman);
    localStorage.setItem('vigia_control_watchman', JSON.stringify(confirmingWatchman));
    setNotification({ message: `Bem-vindo, ${confirmingWatchman.name}!`, type: 'success' });
    setConfirmingWatchman(null);
  };

  const handleCancelIdentity = () => {
    setConfirmingWatchman(null);
    setWatchmanCPF('');
  };

  const [watchmanCPF, setWatchmanCPF] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const handleCPFLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCPF = watchmanCPF.replace(/\D/g, '');
    if (!validateCPF(cleanCPF)) {
      setNotification({ message: 'CPF inválido. Verifique os números.', type: 'error' });
      return;
    }
    
    setLoginLoading(true);
    try {
      const q = query(collection(db, 'employees'), where('cpf', '==', cleanCPF), limit(1));
      const empSnap = await getDocs(q);

      if (empSnap.empty) {
        setNotification({ message: 'Funcionário não encontrado com este CPF.', type: 'error' });
      } else {
        const empDoc = empSnap.docs[0];
        const empData = empDoc.data() as Employee;
        
        if (!empData.is_watchman && !empData.is_admin) {
          setNotification({ message: 'Este funcionário não tem permissão de acesso ao sistema.', type: 'error' });
          setLoginLoading(false);
          return;
        }

        const watchmanObj = { ...empData, id: empDoc.id };
        
        setConfirmingWatchman(watchmanObj);
      }
    } catch (err) {
      console.error("Login error:", err);
      setNotification({ message: 'Erro ao realizar login.', type: 'error' });
    } finally {
      setLoginLoading(false);
    }
  };

  if (isMobileMode) {
    return (
      <>
        <AnimatePresence>
          {showSplash && (
            <SplashScreen 
              duration={6000} 
              onComplete={handleSplashComplete} 
            />
          )}
        </AnimatePresence>
        <MobileApp 
          setIsMobileMode={setIsMobileMode}
          settings={settings}
        />
      </>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <SplashScreen 
            duration={6000} 
            onComplete={handleSplashComplete} 
          />
        )}
      </AnimatePresence>
      <div className="min-h-screen bg-[#E4E3E0] font-sans relative overflow-hidden">
      {/* Connection Status Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-600 text-white text-center py-2 text-xs font-bold uppercase tracking-widest z-[10001] relative"
          >
            Modo Offline - Sincronização pausada
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification Toast */}
      <AnimatePresence mode="wait">
        {notification && (
          <motion.div 
            key={`${notification.type}-${notification.message}`}
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-4 left-1/2 z-[9999] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px] backdrop-blur-md border ${
              notification.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400/50' : 'bg-red-500/90 text-white border-red-400/50'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-bold text-sm">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmAction && (
          <ConfirmationModal 
            message={confirmAction.message}
            onConfirm={async () => {
              await confirmAction.onConfirm();
              setConfirmAction(null);
            }}
            onCancel={() => setConfirmAction(null)}
          />
        )}
      </AnimatePresence>

      {/* PWA Install Banner */}
      <AnimatePresence>
        {showInstallBanner && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[9990] bg-white border border-gray-100 p-5 rounded-3xl shadow-2xl flex flex-col gap-4 text-gray-800"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex-shrink-0 overflow-hidden border border-blue-100 shadow-inner flex items-center justify-center">
                <img src="/icon.png" alt="Vigia Control" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-gray-950">Instalar Vigia Control</h3>
                  <button 
                    onClick={dismissInstallPrompt}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 font-medium mt-1 leading-relaxed">
                  Adicione à sua tela inicial para rodar como aplicativo. Ideal para obter tela cheia, melhor desempenho e manter a tela sempre ativa (anti-sono).
                </p>
              </div>
            </div>

            {isIOS ? (
              <div className="bg-amber-50/70 border border-amber-100 p-3 rounded-2xl text-[11px] text-amber-900 space-y-1.5 font-medium">
                <div className="font-bold flex items-center gap-1.5 text-amber-950 mb-1">
                  <Share size={14} className="text-amber-600" /> Como Instalar no iPhone / iPad:
                </div>
                <p className="leading-normal">
                  1. Toque no ícone de <strong className="font-extrabold">Compartilhar</strong> <Share size={12} className="inline mx-0.5 text-amber-700" /> na barra do navegador (geralmente embaixo ou no topo).
                </p>
                <p className="leading-normal">
                  2. Role a lista de opções e clique em <strong className="font-extrabold text-blue-600">"Adicionar à Tela de Início"</strong>.
                </p>
                <p className="leading-normal">
                  3. Confirme clicando em <strong className="font-extrabold text-blue-600">"Adicionar"</strong> no topo direito. Pronto!
                </p>
              </div>
            ) : (
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={dismissInstallPrompt}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                >
                  Agora Não
                </button>
                <button 
                  onClick={handleInstallClick}
                  className="px-5 py-2.5 text-xs font-bold bg-blue-600 text-white rounded-xl shadow-sm hover:bg-blue-700 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Smartphone size={14} />
                  Instalar Aplicativo
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!isAuthReady ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex items-center justify-center p-4"
          >
            <div className="flex flex-col items-center gap-6 max-w-sm text-center">
              <div className="animate-pulse flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center p-2 shadow-sm border border-gray-200 overflow-hidden">
                  <img src="/icon.png" alt="Carregando..." className="w-full h-full object-contain" />
                </div>
                <div className="h-4 w-32 bg-gray-300 rounded"></div>
              </div>
              {authError && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white p-6 rounded-2xl border border-red-100 shadow-xl"
                >
                  <div className="flex items-center gap-2 text-red-600 mb-2 justify-center">
                    <AlertCircle size={20} />
                    <span className="font-bold">Aviso de Carregamento</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-4 leading-relaxed">{authError}</p>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => window.location.reload()}
                      className="w-full py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all text-sm"
                    >
                      Tentar Novamente
                    </button>
                    <button 
                      onClick={() => {
                        localStorage.removeItem('vigia_control_watchman');
                        window.location.reload();
                      }}
                      className="w-full py-2 text-gray-400 hover:text-gray-600 text-xs font-medium transition-colors"
                    >
                      Limpar Dados e Recarregar
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        ) : !user ? (
          <motion.div 
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="min-h-screen bg-gradient-to-b from-blue-800 to-blue-950 flex items-center justify-center p-4"
          >
            <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-black/5">
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-3 overflow-hidden border border-gray-100 shadow-md p-1.5">
                  <img 
                    src={settings.company_logo || "/icon.png"} 
                    alt="Logo VigiaControl" 
                    className="w-full h-full object-contain" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes('icon.png')) {
                        target.src = '/icon.png';
                      }
                    }}
                  />
                </div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">{settings.company_name}</h1>
                {settings.client_company_name && (
                  <p className="text-xs font-semibold text-gray-400 mt-0.5">Prestadora para {settings.client_company_name}</p>
                )}
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">
                  <Shield size={13} />
                  Acesso Administrativo
                </div>
                <p className="text-gray-500 text-xs text-center mt-2">
                  Entre com suas credenciais Google para gerenciar portaria, operadores, máquinas e relatórios.
                </p>
              </div>

              <div className="space-y-4">
                {/* Primary Google Login Button */}
                <button 
                  onClick={handleLogin}
                  disabled={googleLoggingIn}
                  className="w-full bg-white text-gray-800 border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50/50 py-3.5 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg transform active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed group text-base"
                >
                  {googleLoggingIn ? (
                    <>
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-blue-700">Autenticando com Google...</span>
                    </>
                  ) : (
                    <>
                      <img 
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                        alt="Google" 
                        className="w-5 h-5 shrink-0 group-hover:scale-110 transition-transform" 
                      />
                      <span>Entrar com Conta Google</span>
                    </>
                  )}
                </button>

                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100/80 flex items-start gap-2.5 text-xs text-blue-900 leading-relaxed">
                  <CheckCircle2 size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <p>
                    <strong>Acesso Seguro:</strong> Suas permissões e dados salvos no banco de dados serão sincronizados automaticamente com a sua conta Google.
                  </p>
                </div>

                {error && (
                  <div className="flex flex-col gap-3 text-red-600 text-sm bg-red-50 p-4 rounded-2xl border border-red-100 shadow-sm">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
                      <div>
                        <span className="font-bold text-red-900">{error}</span>
                        {error.includes('Domínio Não Autorizado') ? (
                          <div className="mt-2 space-y-2 text-xs text-red-800">
                            <p className="leading-relaxed">
                              O domínio da aplicação precisa ser adicionado na lista de <strong>Domínios Autorizados</strong> no Console do Firebase do seu projeto.
                            </p>
                            
                            <div className="bg-white p-3 rounded-xl border border-red-200 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-mono font-bold text-gray-700 break-all select-all">
                                  {typeof window !== 'undefined' ? window.location.hostname : 'ais-dev-dwq5rc33odxmam2zgwufod-217133597791.us-east1.run.app'}
                                </span>
                                <button
                                  type="button"
                                  onClick={copyHostnameToClipboard}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 shadow-xs ${
                                    copiedDomain 
                                      ? 'bg-emerald-600 text-white' 
                                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                                  }`}
                                >
                                  {copiedDomain ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                                  {copiedDomain ? 'Copiado!' : 'Copiar Domínio'}
                                </button>
                              </div>
                              <ol className="list-decimal pl-4 space-y-1 text-[11px] text-gray-600 font-medium">
                                <li>Acesse o <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">Console do Firebase</a> e abra seu projeto;</li>
                                <li>Vá em <strong>Authentication</strong> &gt; aba <strong>Settings</strong> &gt; seção <strong>Authorized domains</strong>;</li>
                                <li>Clique em <strong>Add domain</strong>, cole o domínio copiado e salve;</li>
                                <li>Em seguida, recarregue a página ou clique em Entrar com Conta Google.</li>
                              </ol>
                            </div>
                          </div>
                        ) : googleAuthErrorDetail ? (
                          <p className="text-[11px] text-red-700 leading-relaxed whitespace-pre-line bg-white/80 p-2.5 rounded-xl border border-red-100 font-medium mt-2">
                            {googleAuthErrorDetail}
                          </p>
                        ) : (
                          <p className="text-[11px] text-red-500 leading-snug mt-1">
                            Apenas usuários previamente cadastrados com perfil de Administrador podem acessar o painel.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Collapsible Connection Importer */}
                <div className="pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setShowFirebaseConfigImporter(!showFirebaseConfigImporter)}
                    className="w-full text-left text-xs font-semibold text-gray-500 hover:text-blue-600 flex items-center justify-between py-1.5 transition-colors"
                  >
                    <span>Seus dados estão em outro projeto Firebase?</span>
                    <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-400 font-mono">
                      {showFirebaseConfigImporter ? 'Fechar' : 'Conectar'}
                    </span>
                  </button>

                  {showFirebaseConfigImporter && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs space-y-3"
                    >
                      <p className="text-gray-500 leading-relaxed">
                        Se você utilizou outra conta/projeto Firebase no passado onde registrou suas máquinas e veículos, cole o conteúdo do seu arquivo <code className="bg-slate-200/60 px-1 py-0.5 rounded font-mono text-[10px]">firebase-applet-config.json</code> abaixo para se reconectar e carregar tudo de volta instantaneamente.
                      </p>
                      
                      <textarea
                        value={pastedFirebaseConfig}
                        onChange={(e) => setPastedFirebaseConfig(e.target.value)}
                        placeholder='{ "projectId": "...", "apiKey": "...", ... }'
                        className="w-full h-24 p-2 font-mono text-[10px] bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-700 shadow-inner"
                      />

                      <button
                        onClick={handleSaveFirebaseConfig}
                        disabled={configImportLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                      >
                        {configImportLoading ? 'Conectando...' : 'Salvar e Conectar Banco Antigo'}
                      </button>

                      {configImportSuccess && (
                        <p className="text-emerald-600 font-medium bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-[11px] leading-relaxed">
                          ✅ {configImportSuccess}
                        </p>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-widest font-mono">
                  {currentTime.toLocaleDateString('pt-BR')} • {currentTime.toLocaleTimeString('pt-BR')}
                </p>
              </div>
            </div>
          </motion.div>
        ) : !watchman ? (
          confirmingWatchman ? (
            <motion.div 
              key="identity-confirmation"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="min-h-screen bg-blue-700 flex items-center justify-center p-4"
            >
              <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm border border-black/5 text-center">
                <div className="flex flex-col items-center">
                  <div className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-extrabold uppercase rounded-full tracking-wider border border-blue-100 mb-2">
                    Verificar Entrada
                  </div>
                  <h1 className="text-xl font-bold text-gray-900 leading-tight animate-pulse">Confirmar Identidade</h1>
                  <p className="text-gray-400 text-xs mt-1">Este é o funcionário correto?</p>
                </div>

                <div className="my-6 relative">
                  <div className="w-44 h-44 rounded-2xl overflow-hidden border-2 border-blue-100 mx-auto shadow-md flex items-center justify-center bg-gray-50 relative">
                    {confirmingWatchman.photo ? (
                      <img 
                        src={confirmingWatchman.photo} 
                        alt={confirmingWatchman.name} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-400">
                        <UserIcon size={44} className="text-gray-300 animate-bounce" />
                        <span className="text-[10px] font-semibold text-gray-400">Sem Foto Cadastrada</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1 mb-6">
                  <h2 className="text-xl font-extrabold text-gray-900 leading-snug">{confirmingWatchman.name}</h2>
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-widest leading-none">
                    {confirmingWatchman.role_name || "Vigilante"}
                  </p>
                  <p className="text-xs font-medium text-gray-400 font-mono mt-2">
                    CPF: {confirmingWatchman.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4")}
                  </p>
                </div>

                <div className="space-y-2.5">
                  <button 
                    onClick={handleConfirmIdentity}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-4 rounded-xl font-bold text-base transition-all shadow-md shadow-emerald-600/15 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 size={18} />
                    Sim, Confirmar Entrada
                  </button>
                  <button 
                    onClick={handleCancelIdentity}
                    className="w-full text-gray-400 hover:text-red-500 font-semibold text-sm transition-colors py-2 active:scale-98 cursor-pointer"
                  >
                    Não sou eu / Corrigir CPF
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="watchman-login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="min-h-screen bg-blue-700 flex items-center justify-center p-4"
            >
              <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-black/5">
                <div className="flex flex-col items-center mb-8">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 overflow-hidden border border-gray-100 shadow-md p-1.5">
                    <img 
                      src={settings.company_logo || "/icon.png"} 
                      alt="Logo VigiaControl" 
                      className="w-full h-full object-contain" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target.src.includes('icon.png')) {
                          target.src = '/icon.png';
                        }
                      }}
                    />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">{settings.company_name}</h1>
                  {settings.client_company_name && (
                    <p className="text-sm font-medium text-gray-400 -mt-1 mb-2">Prestadora de serviço para {settings.client_company_name}</p>
                  )}
                  <p className="text-gray-500 text-sm italic">Identifique-se para iniciar o turno</p>
                </div>

                <form onSubmit={handleCPFLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">CPF do Vigia</label>
                    <SmartCPFInput 
                      value={watchmanCPF}
                      onChange={setWatchmanCPF}
                      onOpenKeypad={setKeypadConfig}
                      title="CPF do Vigia"
                      isMobileApp={isMobileMode}
                      placeholder="000.000.000-00"
                      className="w-full px-4 py-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none text-center text-xl font-mono tracking-widest"
                      required
                      autoFocus
                    />
                  </div>
                  
                  <button 
                    type="submit"
                    disabled={loginLoading}
                    className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition-all shadow-lg shadow-black/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loginLoading ? 'Verificando...' : 'Entrar no Turno'}
                  </button>

                  {user && watchman?.is_admin && (
                    <button 
                      type="button"
                      onClick={() => {
                        setShiftId('admin_view');
                        setActiveTab('admin_dashboard');
                      }}
                      className="w-full bg-blue-50 text-blue-600 py-3 rounded-xl font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2 border border-blue-100"
                    >
                      <Shield size={18} />
                      Acessar Painel Administrativo
                    </button>
                  )}

                  <button 
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-gray-400 text-sm font-medium hover:text-red-500 transition-colors py-2"
                  >
                    Sair do Sistema (Admin)
                  </button>

                  <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
                    <button 
                      type="button"
                      onClick={() => setIsMobileMode(true)}
                      className="w-full bg-emerald-50 text-emerald-700 py-3.5 rounded-xl font-bold text-sm hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 border border-emerald-100"
                    >
                      <Smartphone size={18} />
                      Acessar como Vigia (App Móvel)
                    </button>
                  </div>
                </form>
                
                <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-widest font-mono">
                    {currentTime.toLocaleDateString('pt-BR')} • {currentTime.toLocaleTimeString('pt-BR')}
                  </p>
                </div>
              </div>
            </motion.div>
          )
        ) : !shiftId ? (
          <motion.div 
            key="shift-selection"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4"
          >
            <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center border border-black/5">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-emerald-500/20 mx-auto mb-6 shadow-md flex items-center justify-center bg-gray-50 relative">
                {watchman.photo ? (
                  <img src={watchman.photo} alt={watchman.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <Clock size={40} />
                  </div>
                )}
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 mb-1">Bem-vindo, {watchman.name}</h2>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest leading-none mb-6">
                {watchman.role_name || "Vigilante"}
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={handleStartShift}
                  className="w-full bg-black text-white py-4 rounded-2xl font-bold text-lg hover:bg-gray-800 transition-all shadow-lg shadow-black/20 flex items-center justify-center gap-3 cursor-pointer"
                >
                  <LogIn size={24} />
                  Abrir Turno
                </button>
                <button 
                  onClick={() => {
                    setWatchman(null);
                    setShiftId(null);
                  }}
                  className="w-full text-gray-400 font-medium hover:text-red-500 transition-colors py-2 cursor-pointer"
                >
                  Trocar Vigia
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="main-app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen bg-[#F5F5F5] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-gray-200 p-1 shadow-xs">
                  <img 
                    src={settings.company_logo || "/icon.png"} 
                    alt="Logo VigiaControl" 
                    className="w-full h-full object-contain" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes('icon.png')) {
                        target.src = '/icon.png';
                      }
                    }}
                  />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 leading-tight uppercase tracking-tight">
                    {settings.company_name}
                    {settings.client_company_name && (
                      <span className="text-gray-400 font-normal normal-case ml-2">
                        • {settings.client_company_name}
                      </span>
                    )}
                  </h1>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <p className="text-xs text-gray-500 font-medium">
                      {isOnline ? 'Online' : 'Offline'} • Vigia: {watchman.name}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    setShowInstallBanner(true);
                  }}
                  className="p-2 flex items-center gap-1.5 rounded-xl border bg-gray-50 text-gray-500 border-gray-100 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 text-xs transition-all cursor-pointer"
                  title="Instalar Vigia Control como Aplicativo no Celular"
                >
                  <Smartphone size={18} className="text-blue-600 animate-pulse" />
                  <span className="text-[11px] hidden sm:inline font-bold">Instalar App</span>
                </button>
                <button 
                  onClick={() => setIsMobileMode(true)}
                  className="p-2 flex items-center gap-1.5 rounded-xl border bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 hover:border-emerald-200 text-xs font-bold transition-all cursor-pointer"
                  title="Abrir Simulador de Aplicativo de Bolso do Vigia"
                >
                  <Smartphone size={18} className="text-emerald-600 animate-pulse" />
                  <span className="text-[11px] hidden sm:inline">Modo App Vigia</span>
                </button>
                <button 
                  onClick={toggleWakeLock}
                  className={`p-2 flex items-center gap-1.5 rounded-xl border transition-all ${
                    isWakeLocked 
                      ? 'bg-amber-50 text-amber-600 border-amber-200 font-semibold text-xs shadow-xs' 
                      : 'bg-gray-50 text-gray-400 border-gray-100 hover:text-gray-600 hover:bg-gray-100 text-xs'
                  }`}
                  title={isWakeLocked ? "Modo Tela Sempre Ativa está ATIVADO" : "Ativar modo de Manter Tela Sempre Ativa"}
                >
                  {isWakeLocked ? (
                    <>
                      <Sun size={18} className="text-amber-500 animate-pulse" />
                      <span className="text-[11px] hidden sm:inline">Tela Ativa</span>
                    </>
                  ) : (
                    <>
                      <Lightbulb size={18} className="text-gray-400" />
                      <span className="text-[11px] hidden sm:inline">Manter Tela</span>
                    </>
                  )}
                </button>
                <button 
                  onClick={() => window.location.reload()}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all border border-transparent"
                  title="Recarregar Sistema"
                >
                  <Clock size={18} />
                </button>
                <div className="hidden lg:flex items-center gap-6 text-sm font-medium text-gray-500">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    <span>{currentTime.toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    <span>{currentTime.toLocaleTimeString('pt-BR')}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-3 mr-2 bg-gray-50/80 border border-gray-200/80 py-1 px-3 rounded-2xl">
                  {user?.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={watchman?.name || 'Admin'} 
                      className="w-8 h-8 rounded-full object-cover border border-blue-200 shadow-xs"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                      {(watchman?.name || 'A')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col items-start leading-tight">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-gray-900 max-w-[140px] truncate">{watchman?.name}</p>
                      {user?.email && (
                        <img 
                          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                          alt="Google" 
                          className="w-3 h-3" 
                          title={`Logado via Google (${user.email})`}
                        />
                      )}
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${
                      watchman?.is_admin ? 'text-purple-600' : 'text-blue-600'
                    }`}>
                      {watchman?.is_admin ? 'Administrador' : 'Vigia'}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={handleEndShift}
                  className="bg-red-50 text-red-600 px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5 border border-red-200"
                >
                  <LogOut size={16} />
                  Encerrar Jornada
                </button>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className={`p-2 rounded-xl transition-all flex flex-col items-center ${
                    activeTab === 'settings' ? 'bg-black text-white shadow-xs' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
                  }`}
                  title="Configurações do Sistema"
                >
                  <Settings size={18} />
                  <span className="text-[8px] font-bold uppercase mt-0.5">Config</span>
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex flex-col items-center"
                  title="Sair da Conta Google"
                >
                  <LogOut size={18} />
                  <span className="text-[8px] font-bold uppercase mt-0.5">Sair</span>
                </button>
              </div>
            </header>

            {/* Mobile Nav */}
            <nav className="lg:hidden bg-white border-b border-gray-200 px-2 py-3 flex justify-around sticky top-[73px] z-40 shadow-sm overflow-x-auto gap-1">
              {watchman?.is_admin ? (
                <>
                  <MobileNavButton active={activeTab === 'admin_dashboard'} onClick={() => setActiveTab('admin_dashboard')} icon={<Shield size={20} />} label="Painel" colorClass="blue" />
                  <MobileNavButton active={activeTab === 'register'} onClick={() => setActiveTab('register')} icon={<Plus size={20} />} label="Cadastros" colorClass="purple" />
                  <MobileNavButton active={activeTab === 'global_history'} onClick={() => setActiveTab('global_history')} icon={<Calendar size={20} />} label="Relatórios" colorClass="yellow" />
                  <MobileNavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="Config" colorClass="orange" />
                </>
              ) : (
                <>
                  <MobileNavButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<ClipboardList size={20} />} label="Logs" colorClass="red" />
                  <MobileNavButton active={activeTab === 'register'} onClick={() => setActiveTab('register')} icon={<Truck size={20} />} label="Veíc/Máq" colorClass="blue" />
                  <MobileNavButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<Search size={20} />} label="Turno" colorClass="green" />
                  <MobileNavButton active={activeTab === 'global_history'} onClick={() => setActiveTab('global_history')} icon={<Calendar size={20} />} label="Geral" colorClass="yellow" />
                  <MobileNavButton active={activeTab === 'visitors'} onClick={() => setActiveTab('visitors')} icon={<Users size={20} />} label="Visitantes" colorClass="purple" />
                  <MobileNavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="Config" colorClass="orange" />
                </>
              )}
            </nav>

            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar */}
              <aside className="w-64 bg-white border-r border-gray-200 hidden lg:flex flex-col p-4 gap-2">
                {watchman?.is_admin ? (
                  <>
                    <NavButton 
                      active={activeTab === 'admin_dashboard'} 
                      onClick={() => setActiveTab('admin_dashboard')} 
                      icon={<Shield size={20} />} 
                      label="Painel de Controle" 
                      colorClass="blue"
                    />
                    <NavButton 
                      active={activeTab === 'register'} 
                      onClick={() => setActiveTab('register')} 
                      icon={<Plus size={20} />} 
                      label="Gestão & Cadastros" 
                      colorClass="purple"
                    />
                    <NavButton 
                      active={activeTab === 'global_history'} 
                      onClick={() => setActiveTab('global_history')} 
                      icon={<Calendar size={20} />} 
                      label="Relatórios e Histórico" 
                      colorClass="yellow"
                    />
                    <div className="mt-auto pt-4 border-t border-gray-100">
                      <NavButton 
                        active={activeTab === 'settings'} 
                        onClick={() => setActiveTab('settings')} 
                        icon={<Settings size={20} />} 
                        label="Configurações" 
                        colorClass="orange"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <NavButton 
                      active={activeTab === 'logs'} 
                      onClick={() => setActiveTab('logs')} 
                      icon={<ClipboardList size={20} />} 
                      label="Entrada / Saída" 
                      colorClass="red"
                    />
                    <NavButton 
                      active={activeTab === 'register'} 
                      onClick={() => setActiveTab('register')} 
                      icon={<Truck size={20} />} 
                      label="Veículos & Máquinas" 
                      colorClass="blue"
                    />
                    <NavButton 
                      active={activeTab === 'history'} 
                      onClick={() => setActiveTab('history')} 
                      icon={<Search size={20} />} 
                      label="Histórico do Turno" 
                      colorClass="green"
                    />
                    <NavButton 
                      active={activeTab === 'global_history'} 
                      onClick={() => setActiveTab('global_history')} 
                      icon={<Calendar size={20} />} 
                      label="Histórico Geral" 
                      colorClass="yellow"
                    />
                    <NavButton 
                      active={activeTab === 'visitors'} 
                      onClick={() => setActiveTab('visitors')} 
                      icon={<Users size={20} />} 
                      label="Visitantes / Prestadores" 
                      colorClass="purple"
                    />
                    <div className="mt-auto pt-4 border-t border-gray-100">
                      <NavButton 
                        active={activeTab === 'settings'} 
                        onClick={() => setActiveTab('settings')} 
                        icon={<Settings size={20} />} 
                        label="Configurações" 
                        colorClass="orange"
                      />
                    </div>
                  </>
                )}
              </aside>

              {/* Main Content */}
              <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-5xl mx-auto">
                  <AnimatePresence mode="wait">
                    {activeTab === 'admin_dashboard' && (
                      <motion.div key="admin_dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <AdminDashboard 
                          activeShifts={activeShifts} 
                          setActiveTab={setActiveTab} 
                          currentWatchmanId={watchman?.id}
                        />
                      </motion.div>
                    )}
                    {activeTab === 'logs' && (
                      <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <LogForm 
                          watchman={watchman} 
                          shiftId={shiftId!} 
                          setNotification={setNotification} 
                          setKeypadConfig={setKeypadConfig}
                        />
                      </motion.div>
                    )}
                    {activeTab === 'register' && (
                      <motion.div key="register" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <RegisterForms 
                          setNotification={setNotification} 
                          setConfirmAction={setConfirmAction} 
                          setKeypadConfig={setKeypadConfig}
                          watchman={watchman}
                        />
                      </motion.div>
                    )}
                    {activeTab === 'history' && (
                      <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <CurrentShiftLogs shiftId={shiftId!} setNotification={setNotification} setConfirmAction={setConfirmAction} settings={settings} />
                      </motion.div>
                    )}
                    {activeTab === 'global_history' && (
                      <motion.div key="global_history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <GlobalShiftHistory setNotification={setNotification} settings={settings} setConfirmAction={setConfirmAction} />
                      </motion.div>
                    )}
                    {activeTab === 'visitors' && (
                      <motion.div key="visitors" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <VisitorAccess />
                      </motion.div>
                    )}
                    {activeTab === 'settings' && (
                      <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <CompanySettings settings={settings} onUpdate={setSettings} setNotification={setNotification} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </main>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
      
      <OverdueShiftsAlert 
        shifts={overdueShifts} 
        onClose={() => setOverdueShifts([])} 
        onReview={(shiftId) => {
          if (watchman?.is_admin) {
            setShiftId('admin_view');
            setActiveTab('global_history');
          }
          setOverdueShifts([]);
        }}
      />

      <NumericKeypad 
        isOpen={keypadConfig.isOpen}
        onClose={() => setKeypadConfig({ ...keypadConfig, isOpen: false })}
        value={keypadConfig.value}
        onChange={keypadConfig.onChange}
        title={keypadConfig.title}
      />
    </div>
    </>
  );
}

function NavButton({ active, onClick, icon, label, colorClass = 'gray' }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, colorClass?: 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'gray' }) {
  const colors = {
    red: { active: 'bg-red-600 text-white shadow-red-200', inactive: 'text-red-600 hover:bg-red-50' },
    blue: { active: 'bg-blue-600 text-white shadow-blue-200', inactive: 'text-blue-600 hover:bg-blue-50' },
    green: { active: 'bg-emerald-600 text-white shadow-emerald-200', inactive: 'text-emerald-600 hover:bg-emerald-50' },
    yellow: { active: 'bg-amber-500 text-white shadow-amber-200', inactive: 'text-amber-600 hover:bg-amber-50' },
    purple: { active: 'bg-purple-600 text-white shadow-purple-200', inactive: 'text-purple-600 hover:bg-purple-50' },
    orange: { active: 'bg-orange-500 text-white shadow-orange-200', inactive: 'text-orange-600 hover:bg-orange-50' },
    gray: { active: 'bg-black text-white shadow-gray-200', inactive: 'text-gray-500 hover:bg-gray-100' }
  };

  const current = colors[colorClass];

  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
        active ? `${current.active} shadow-lg` : current.inactive
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MobileNavButton({ active, onClick, icon, label, colorClass = 'gray' }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, colorClass?: 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'gray' }) {
  const colors = {
    red: { active: 'bg-red-600 text-white shadow-red-200', inactive: 'text-red-400 hover:text-red-600' },
    blue: { active: 'bg-blue-600 text-white shadow-blue-200', inactive: 'text-blue-400 hover:text-blue-600' },
    green: { active: 'bg-emerald-600 text-white shadow-emerald-200', inactive: 'text-emerald-400 hover:text-emerald-600' },
    yellow: { active: 'bg-amber-500 text-white shadow-amber-200', inactive: 'text-amber-500 hover:text-amber-700' },
    purple: { active: 'bg-purple-600 text-white shadow-purple-200', inactive: 'text-purple-400 hover:text-purple-600' },
    orange: { active: 'bg-orange-500 text-white shadow-orange-200', inactive: 'text-orange-400 hover:text-orange-600' },
    gray: { active: 'bg-black text-white shadow-gray-200', inactive: 'text-gray-400 hover:text-gray-600' }
  };

  const current = colors[colorClass];

  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all min-w-[60px] ${
        active ? `${current.active} shadow-lg` : current.inactive
      }`}
    >
      {icon}
      <span className="text-[10px] font-bold mt-1 uppercase">{label}</span>
    </button>
  );
}

function LogForm({ 
  watchman, 
  shiftId, 
  setNotification,
  setKeypadConfig
}: { 
  watchman: Employee, 
  shiftId: string, 
  setNotification: (n: any) => void,
  setKeypadConfig: (config: any) => void
}) {
  const [type, setType] = useState<'IN' | 'OUT'>('IN');
  const [searchEmployee, setSearchEmployee] = useState('');
  const [searchAsset, setSearchAsset] = useState('');
  const [personType, setPersonType] = useState<'employee' | 'third_party'>('employee');
  const [employeeResults, setEmployeeResults] = useState<Employee[]>([]);
  const [serviceProviderResults, setServiceProviderResults] = useState<ServiceProvider[]>([]);
  const [assetResults, setAssetResults] = useState<{ vehicles: Vehicle[], machines: Machine[] }>({ vehicles: [], machines: [] });
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedServiceProvider, setSelectedServiceProvider] = useState<ServiceProvider | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [transportMode, setTransportMode] = useState<'RODANDO' | 'PRANCHA' | null>(null);
  const [logTime, setLogTime] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  });
  const [isManualTime, setIsManualTime] = useState(false);
  const [visitorCPF, setVisitorCPF] = useState('');
  const [visitorPlate, setVisitorPlate] = useState('');
  
  const [km, setKm] = useState('');
  const [horometer, setHorometer] = useState('');
  const [destination, setDestination] = useState('');
  const [visitorType, setVisitorType] = useState<'VISITOR' | 'SERVICE_PROVIDER'>('VISITOR');
  const [hasUniform, setHasUniform] = useState<boolean | null>(null);
  const [hasBadge, setHasBadge] = useState<boolean | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence for draft log data
  useEffect(() => {
    const saved = localStorage.getItem('vigia_control_draft_log');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.km) setKm(parsed.km);
        if (parsed.horometer) setHorometer(parsed.horometer);
        if (parsed.destination) setDestination(parsed.destination);
        if (parsed.type) setType(parsed.type);
        if (parsed.personType) setPersonType(parsed.personType);
        if (parsed.visitorCPF) setVisitorCPF(parsed.visitorCPF);
        if (parsed.visitorPlate) setVisitorPlate(parsed.visitorPlate);
        if (parsed.visitorType) setVisitorType(parsed.visitorType);
        if (parsed.hasUniform !== undefined) setHasUniform(parsed.hasUniform);
        if (parsed.hasBadge !== undefined) setHasBadge(parsed.hasBadge);
        if (parsed.photo) setPhoto(parsed.photo);
        if (parsed.transportMode) setTransportMode(parsed.transportMode);
        if (parsed.selectedServiceProvider && !selectedServiceProvider) {
          setSelectedServiceProvider(parsed.selectedServiceProvider);
        }
        
        // We will restore objects in separate effects once collections load
      } catch (e) {
        console.error("Error restoring draft log:", e);
      }
    }
  }, []);

  useEffect(() => {
    const data = { 
      km, horometer, destination, type, personType, visitorCPF, 
      visitorPlate, visitorType, hasUniform, hasBadge, photo, transportMode,
      selectedEmployeeId: selectedEmployee?.id,
      selectedVehicleId: selectedVehicle?.id,
      selectedMachineId: selectedMachine?.id,
      selectedServiceProviderId: selectedServiceProvider?.id,
      selectedServiceProvider: selectedServiceProvider // Store whole object for third parties
    };
    localStorage.setItem('vigia_control_draft_log', JSON.stringify(data));
  }, [
    km, horometer, destination, type, personType, visitorCPF, 
    visitorPlate, visitorType, hasUniform, hasBadge, photo, transportMode,
    selectedEmployee, selectedVehicle, selectedMachine, selectedServiceProvider
  ]);

  // Restore selected objects once collections are available
  useEffect(() => {
    if (employees.length > 0) {
      const saved = localStorage.getItem('vigia_control_draft_log');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedEmployeeId && !selectedEmployee) {
          const emp = employees.find(e => e.id === parsed.selectedEmployeeId);
          if (emp) setSelectedEmployee(emp);
        }
      }
    }
  }, [employees]);

  useEffect(() => {
    if (vehicles.length > 0) {
      const saved = localStorage.getItem('vigia_control_draft_log');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedVehicleId && !selectedVehicle) {
          const veh = vehicles.find(v => v.id === parsed.selectedVehicleId);
          if (veh) setSelectedVehicle(veh);
        }
      }
    }
  }, [vehicles]);

  useEffect(() => {
    if (machines.length > 0) {
      const saved = localStorage.getItem('vigia_control_draft_log');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedMachineId && !selectedMachine) {
          const mac = machines.find(m => m.id === parsed.selectedMachineId);
          if (mac) setSelectedMachine(mac);
        }
      }
    }
  }, [machines]);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic size check to prevent crashes on very low-end devices
    if (file.size > 15 * 1024 * 1024) {
      setNotification({ message: 'Arquivo muito grande. Tente tirar uma foto com menor resolução.', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setNotification({ message: 'Erro ao ler arquivo da câmera.', type: 'error' });
    };
    reader.onload = (event) => {
      try {
        const img = new Image();
        img.onerror = () => {
          setNotification({ message: 'Erro ao processar imagem.', type: 'error' });
        };
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 600;
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
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              
              // Add timestamp overlay
              ctx.font = 'bold 20px Arial';
              ctx.fillStyle = 'white';
              ctx.strokeStyle = 'black';
              ctx.lineWidth = 3;
              const timestamp = new Date().toLocaleString('pt-BR');
              const textWidth = ctx.measureText(timestamp).width;
              ctx.strokeText(timestamp, width - textWidth - 15, height - 15);
              ctx.fillText(timestamp, width - textWidth - 15, height - 15);
            }

            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setPhoto(dataUrl);
            // Clear input so same file can be selected again if needed
            if (e.target) e.target.value = '';
          } catch (canvasErr) {
            console.error("Canvas error:", canvasErr);
            setNotification({ message: 'Erro ao processar dimensões da imagem.', type: 'error' });
          }
        };
        img.src = event.target?.result as string;
      } catch (imgErr) {
        console.error("Image loading error:", imgErr);
        setNotification({ message: 'Erro ao carregar prévia da imagem.', type: 'error' });
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const unsubRoles = onSnapshot(
      query(collection(db, 'roles'), orderBy('name')),
      (snap) => {
        setRoles(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Role));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'roles')
    );

    const unsubEmployees = onSnapshot(
      query(collection(db, 'employees'), orderBy('name')),
      (snap) => {
        setEmployees(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Employee));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'employees')
    );

    const unsubVehicles = onSnapshot(
      collection(db, 'vehicles'),
      (snap) => {
        setVehicles(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Vehicle));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'vehicles')
    );

    const unsubMachines = onSnapshot(
      collection(db, 'machines'),
      (snap) => {
        setMachines(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Machine));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'machines')
    );

    return () => {
      unsubRoles();
      unsubEmployees();
      unsubVehicles();
      unsubMachines();
    };
  }, []);

  useEffect(() => {
    if (selectedVehicle && selectedMachine) {
      setTransportMode('PRANCHA');
    }
  }, [selectedVehicle, selectedMachine]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchEmployee.length > 1) {
        try {
          if (personType === 'employee') {
            const q = query(
              collection(db, 'employees'),
              where('name', '>=', searchEmployee),
              where('name', '<=', searchEmployee + '\uf8ff'),
              limit(10)
            );
            const snap = await getDocs(q);
            setEmployeeResults(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Employee));
            setServiceProviderResults([]);
          } else {
            const q = query(
              collection(db, 'third_parties'),
              where('name', '>=', searchEmployee),
              where('name', '<=', searchEmployee + '\uf8ff'),
              limit(10)
            );
            const snap = await getDocs(q);
            setServiceProviderResults(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as ServiceProvider));
            setEmployeeResults([]);
          }
        } catch (err) {
          console.error("Error searching people:", err);
        }
      } else {
        setEmployeeResults([]);
        setServiceProviderResults([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchEmployee, personType]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchAsset.length > 1) {
        try {
          const searchUpper = searchAsset.toUpperCase();
          
          // Queries for Vehicles
          const qVehPlate = query(
            collection(db, 'vehicles'),
            where('plate', '>=', searchUpper),
            where('plate', '<=', searchUpper + '\uf8ff'),
            limit(5)
          );
          const qVehAsset = query(
            collection(db, 'vehicles'),
            where('asset_number', '>=', searchUpper),
            where('asset_number', '<=', searchUpper + '\uf8ff'),
            limit(5)
          );

          // Queries for Machines
          const qMacType = query(
            collection(db, 'machines'),
            where('type', '>=', searchAsset),
            where('type', '<=', searchAsset + '\uf8ff'),
            limit(5)
          );
          const qMacAsset = query(
            collection(db, 'machines'),
            where('asset_number', '>=', searchUpper),
            where('asset_number', '<=', searchUpper + '\uf8ff'),
            limit(5)
          );
          
          const [vehPlateSnap, vehAssetSnap, macTypeSnap, macAssetSnap] = await Promise.all([
            getDocs(qVehPlate),
            getDocs(qVehAsset),
            getDocs(qMacType),
            getDocs(qMacAsset)
          ]);
          
          const vehiclesMap = new Map<string, Vehicle>();
          // Prioritize plate matches by adding them first
          vehPlateSnap.docs.forEach(doc => vehiclesMap.set(doc.id, { id: doc.id, ...doc.data() } as Vehicle));
          vehAssetSnap.docs.forEach(doc => {
            if (!vehiclesMap.has(doc.id)) {
              vehiclesMap.set(doc.id, { id: doc.id, ...doc.data() } as Vehicle);
            }
          });

          const machinesMap = new Map<string, Machine>();
          macTypeSnap.docs.forEach(doc => machinesMap.set(doc.id, { id: doc.id, ...doc.data() } as Machine));
          macAssetSnap.docs.forEach(doc => {
            if (!machinesMap.has(doc.id)) {
              machinesMap.set(doc.id, { id: doc.id, ...doc.data() } as Machine);
            }
          });
          
          setAssetResults({
            vehicles: Array.from(vehiclesMap.values()),
            machines: Array.from(machinesMap.values())
          });
        } catch (err) {
          console.error("Error searching assets:", err);
        }
      } else {
        setAssetResults({ vehicles: [], machines: [] });
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchAsset]);

  useEffect(() => {
    if (isManualTime) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      setLogTime(new Date(now.getTime() - offset).toISOString().slice(0, 16));
    }, 10000); // Update every 10 seconds
    
    return () => clearInterval(interval);
  }, [isManualTime]);

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setSearchEmployee('');
    
    // Auto-select associated vehicle if any
    const associatedVehicle = vehicles.find(v => v.responsible_employee_id === emp.id);
    if (associatedVehicle && !selectedVehicle) {
      setSelectedVehicle(associatedVehicle);
    }
    
    // Auto-select associated machine if any
    const associatedMachine = machines.find(m => m.responsible_employee_id === emp.id);
    if (associatedMachine && !selectedMachine) {
      setSelectedMachine(associatedMachine);
    }
  };

  const handleSelectServiceProvider = (tp: ServiceProvider) => {
    setSelectedServiceProvider(tp);
    setSearchEmployee('');
    if (tp.vehicle_plate && !selectedVehicle) {
      const associatedVehicle = vehicles.find(v => v.plate === tp.vehicle_plate);
      if (associatedVehicle) {
        setSelectedVehicle(associatedVehicle);
      }
    }
  };

  const handleSelectVehicle = (veh: Vehicle) => {
    setSelectedVehicle(veh);
    setSearchAsset('');
    
    if (veh.responsible_employee_id && !selectedEmployee) {
      const emp = employees.find(e => e.id === veh.responsible_employee_id);
      if (emp) {
        setSelectedEmployee(emp);
      }
    }
  };

  const handleSelectMachine = (mac: Machine) => {
    setSelectedMachine(mac);
    setSearchAsset('');
    
    if (mac.responsible_employee_id && !selectedEmployee) {
      const emp = employees.find(e => e.id === mac.responsible_employee_id);
      if (emp) {
        setSelectedEmployee(emp);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isMachineOnPlank = !!selectedMachine && (transportMode === 'PRANCHA' || !!selectedVehicle?.id);
    const isManualVisitor = personType === 'third_party' && searchEmployee.trim().length > 0;
    
    if (!selectedEmployee && !selectedServiceProvider && !isMachineOnPlank && !isManualVisitor) {
      setNotification({ message: 'Selecione um funcionário, visitante ou operador.', type: 'error' });
      return;
    }
    
    setLoading(true);
    try {
      const timestamp = new Date(logTime).toISOString();
      const logsToCreate = [];
      const visitorName = selectedServiceProvider ? (selectedServiceProvider.name || null) : (personType === 'third_party' ? (searchEmployee || null) : null);
      const visitorCpf = selectedServiceProvider ? (selectedServiceProvider.cpf || null) : (personType === 'third_party' ? (visitorCPF || null) : null);
      const visitorPlateValue = selectedServiceProvider ? (selectedServiceProvider.vehicle_plate || null) : (personType === 'third_party' ? (visitorPlate || null) : null);
      
      // Check for duplicate log within the last 5 seconds to prevent double-submission
      const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
      const q = query(
        collection(db, 'logs'),
        where('shift_id', '==', shiftId),
        where('timestamp', '>=', fiveSecondsAgo)
      );
      const recentLogsSnap = await getDocs(q);
      const isDuplicate = recentLogsSnap.docs.some(doc => {
        const data = doc.data();
        return data.employee_id === (selectedEmployee?.id || null) &&
               data.vehicle_id === (selectedVehicle?.id || null) &&
               data.machine_id === (selectedMachine?.id || null) &&
               data.type === type;
      });

      if (isDuplicate) {
        setNotification({ message: 'Este registro já foi enviado recentemente.', type: 'info' });
        setLoading(false);
        return;
      }

      const isPersonIdentified = !!selectedEmployee || !!selectedServiceProvider || (personType === 'third_party' && searchEmployee.trim().length > 0);

      if (selectedVehicle) {
        const logData = {
          employee_id: selectedEmployee?.id || null,
          employee_name: selectedEmployee?.name || visitorName || (isMachineOnPlank ? `Transporte: ${selectedMachine?.type || 'Máquina'}` : 'N/A'),
          service_provider_id: selectedServiceProvider?.id || null,
          service_provider_name: visitorName || null,
          service_provider_cpf: visitorCpf || null,
          vehicle_id: selectedVehicle.id,
          vehicle_plate: selectedVehicle.plate || null,
          vehicle_asset: selectedVehicle.asset_number || null,
          machine_id: null,
          machine_type: null,
          machine_asset: null,
          type,
          km: km !== '' ? parseFloat(km) : null,
          horometer: null,
          transport_mode: null,
          destination: destination || '',
          has_uniform: hasUniform,
          has_badge: hasBadge,
          visitor_type: personType === 'third_party' ? visitorType : null,
          watchman_id: watchman.id,
          shift_id: shiftId || null,
          timestamp: timestamp,
          photo: photo || null
        };
        logsToCreate.push(logData);
      }

      if (selectedMachine) {
        const logData = {
          employee_id: selectedEmployee?.id || null,
          employee_name: selectedEmployee?.name || visitorName || (isMachineOnPlank ? `Transporte: ${selectedMachine.type}` : 'N/A'),
          service_provider_id: selectedServiceProvider?.id || null,
          service_provider_name: visitorName || null,
          service_provider_cpf: visitorCpf || null,
          vehicle_id: null,
          machine_id: selectedMachine.id,
          machine_type: selectedMachine.type || null,
          machine_asset: selectedMachine.asset_number || null,
          type,
          km: null,
          horometer: horometer !== '' ? parseFloat(horometer) : null,
          transport_mode: selectedVehicle ? 'PRANCHA' : (transportMode || null),
          destination: destination || '',
          has_uniform: hasUniform,
          has_badge: hasBadge,
          visitor_type: personType === 'third_party' ? visitorType : null,
          watchman_id: watchman.id,
          shift_id: shiftId || null,
          timestamp: timestamp,
          photo: photo || null
        };
        logsToCreate.push(logData);
      }

      if (!selectedVehicle && !selectedMachine) {
        const logData = {
          employee_id: selectedEmployee?.id || null,
          employee_name: selectedEmployee?.name || visitorName || 'N/A',
          service_provider_id: selectedServiceProvider?.id || null,
          service_provider_name: visitorName || null,
          service_provider_cpf: visitorCpf || null,
          vehicle_id: null,
          vehicle_plate: visitorPlateValue || null,
          machine_id: null,
          machine_type: null,
          machine_asset: null,
          type,
          km: null,
          horometer: null,
          transport_mode: null,
          destination: destination || '',
          has_uniform: hasUniform,
          has_badge: hasBadge,
          visitor_type: personType === 'third_party' ? visitorType : null,
          watchman_id: watchman.id,
          shift_id: shiftId || null,
          timestamp: timestamp,
          photo: photo || null
        };
        logsToCreate.push(logData);
      }

      for (const logData of logsToCreate) {
        await addDoc(collection(db, 'logs'), logData);
      }

      setNotification({ message: 'Registro(s) salvo(s) com sucesso!', type: 'success' });
      localStorage.removeItem('vigia_control_draft_log');
      setSelectedEmployee(null);
      setSelectedServiceProvider(null);
      setSelectedVehicle(null);
      setSelectedMachine(null);
      setTransportMode(null);
      setKm('');
      setHorometer('');
      setDestination('');
      setVisitorCPF('');
      setVisitorPlate('');
      setHasUniform(null);
      setHasBadge(null);
      setVisitorType('VISITOR');
      setSearchEmployee('');
      setSearchAsset('');
      setPhoto(null);
      setIsManualTime(false);
      setLogTime(() => {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().slice(0, 16);
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'logs');
      setNotification({ message: 'Erro ao salvar registro.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Novo Registro</h2>
        <div className="flex bg-gray-200 p-1 rounded-xl">
          <button 
            onClick={() => setType('IN')}
            className={`px-8 py-3 rounded-lg font-bold text-base transition-all ${type === 'IN' ? 'bg-emerald-500 text-white shadow-md' : 'text-gray-500'}`}
          >
            ENTRADA
          </button>
          <button 
            onClick={() => setType('OUT')}
            className={`px-8 py-3 rounded-lg font-bold text-base transition-all ${type === 'OUT' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500'}`}
          >
            SAÍDA
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Search Section - Employee / Third Party */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">1. Identificar Pessoa</label>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                  type="button"
                  onClick={() => {
                    setPersonType('employee');
                    setSelectedServiceProvider(null);
                    setSearchEmployee('');
                  }}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${personType === 'employee' ? 'bg-white text-black shadow-sm' : 'text-gray-400'}`}
                >
                  FUNCIONÁRIO
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setPersonType('third_party');
                    setSelectedEmployee(null);
                    setSearchEmployee('');
                  }}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${personType === 'third_party' ? 'bg-white text-black shadow-sm' : 'text-gray-400'}`}
                >
                  VISITANTE / PRESTADOR
                </button>
              </div>
            </div>
            <div className="relative space-y-3">
              <input 
                type="text" 
                value={searchEmployee}
                onChange={(e) => setSearchEmployee(e.target.value)}
                placeholder={personType === 'employee' ? "Digite nome ou CPF..." : "Digite nome do visitante..."}
                className="w-full pr-12 pl-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
              />
              {personType === 'third_party' && !selectedServiceProvider && (
                <SmartCPFInput 
                  value={visitorCPF}
                  onChange={setVisitorCPF}
                  onOpenKeypad={setKeypadConfig}
                  title="CPF do Visitante"
                  placeholder="CPF do Visitante (Opcional)"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-mono"
                />
              )}
              {personType === 'third_party' && !selectedServiceProvider && (
                <input 
                  type="text" 
                  value={visitorPlate}
                  onChange={(e) => setVisitorPlate(e.target.value.toUpperCase())}
                  placeholder="Placa do Veículo (Opcional)"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-mono"
                  maxLength={8}
                />
              )}
              {searchEmployee ? (
                <button 
                  onClick={() => setSearchEmployee('')}
                  className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <Plus className="rotate-45" size={16} />
                </button>
              ) : null}
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            </div>

            {searchEmployee.length > 2 && (
              <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-2">
                {personType === 'employee' ? (
                  employeeResults.map(emp => (
                    <button 
                      key={emp.id} 
                      onClick={() => handleSelectEmployee(emp)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors text-left border ${
                        emp.is_authorized === false 
                          ? 'bg-red-50/60 hover:bg-red-50 border-red-200' 
                          : 'hover:bg-gray-50 border-transparent hover:border-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          emp.is_authorized === false ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {emp.is_authorized === false ? <Ban size={16} /> : <UserIcon size={16} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-gray-900">{emp.name}</p>
                            {emp.is_authorized === false ? (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-extrabold uppercase tracking-wide border border-red-200">
                                Não Autorizado
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-bold uppercase tracking-wide border border-emerald-200">
                                Autorizado
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-500">
                            {emp.cpf ? `${formatCPF(emp.cpf)} • ` : ''}
                            {emp.role_name || roles.find(r => r.id === emp.role_id)?.name || 'Sem cargo'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-300" />
                    </button>
                  ))
                ) : (
                  serviceProviderResults.map(tp => (
                    <button 
                      key={tp.id} 
                      onClick={() => handleSelectServiceProvider(tp)}
                      className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors text-left border border-transparent hover:border-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
                          <UserIcon size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{tp.name}</p>
                          <p className="text-[10px] text-gray-500">
                            {tp.cpf ? `CPF: ${formatCPF(tp.cpf)} ` : ''}
                            {tp.company ? `• ${tp.company}` : ''}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-300" />
                    </button>
                  ))
                )}
                {((personType === 'employee' && employeeResults.length === 0) || (personType === 'third_party' && serviceProviderResults.length === 0)) && (
                  <p className="text-center py-2 text-gray-400 text-xs">Nenhum resultado encontrado.</p>
                )}
              </div>
            )}
          </div>

          {/* Search Section - Asset */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">2. Buscar Veículo ou Máquina (Placa ou Patrimônio)</label>
            <div className="relative">
              <input 
                type="text" 
                value={searchAsset}
                onChange={(e) => setSearchAsset(e.target.value)}
                placeholder="Digite placa ou patrimônio..."
                className="w-full pr-12 pl-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
              />
              {searchAsset ? (
                <button 
                  onClick={() => setSearchAsset('')}
                  className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <Plus className="rotate-45" size={16} />
                </button>
              ) : null}
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            </div>

            {searchAsset.length > 2 && (
              <div className="mt-4 space-y-4 max-h-64 overflow-y-auto pr-2">
                {assetResults.vehicles.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Veículos</h4>
                    {assetResults.vehicles.map(veh => (
                      <button 
                        key={veh.id} 
                        onClick={() => handleSelectVehicle(veh)}
                        disabled={!!selectedVehicle}
                        className={`w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors text-left border border-transparent hover:border-gray-100 ${selectedVehicle?.id === veh.id ? 'bg-purple-50 border-purple-100' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedVehicle?.id === veh.id ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600'}`}>
                            <Truck size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{veh.brand} {veh.model}</p>
                            <p className="text-xs text-gray-500 font-mono">
                              {veh.plate} {veh.asset_number ? `• ${veh.asset_number}` : ''}
                              {veh.responsible_employee_id && (
                                <> • Resp: {employees.find(e => e.id === veh.responsible_employee_id)?.name || 'N/A'} ({employees.find(e => e.id === veh.responsible_employee_id)?.role_name || roles.find(r => r.id === employees.find(e => e.id === veh.responsible_employee_id)?.role_id)?.name || 'Sem Cargo'})</>
                              )}
                            </p>
                          </div>
                        </div>
                        {selectedVehicle?.id === veh.id ? <CheckCircle2 size={16} className="text-purple-600" /> : <ChevronRight size={16} className="text-gray-300" />}
                      </button>
                    ))}
                  </div>
                )}
                {assetResults.machines.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Máquinas</h4>
                    {assetResults.machines.map(mac => (
                      <button 
                        key={mac.id} 
                        onClick={() => handleSelectMachine(mac)}
                        disabled={!!selectedMachine}
                        className={`w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors text-left border border-transparent hover:border-gray-100 ${selectedMachine?.id === mac.id ? 'bg-amber-50 border-amber-100' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedMachine?.id === mac.id ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600'}`}>
                            <Settings size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{mac.type}</p>
                            <p className="text-xs text-gray-500">
                              {mac.brand} - {mac.model} {mac.asset_number ? `• ${mac.asset_number}` : ''}
                              {mac.responsible_employee_id && (
                                <> • Resp: {employees.find(e => e.id === mac.responsible_employee_id)?.name || 'N/A'} ({employees.find(e => e.id === mac.responsible_employee_id)?.role_name || roles.find(r => r.id === employees.find(e => e.id === mac.responsible_employee_id)?.role_id)?.name || 'Sem Cargo'})</>
                              )}
                            </p>
                          </div>
                        </div>
                        {selectedMachine?.id === mac.id ? <CheckCircle2 size={16} className="text-amber-600" /> : <ChevronRight size={16} className="text-gray-300" />}
                      </button>
                    ))}
                  </div>
                )}
                {assetResults.vehicles.length === 0 && assetResults.machines.length === 0 && (
                  <p className="text-center py-4 text-gray-400 text-sm">Nenhum veículo ou máquina encontrado.</p>
                )}
              </div>
            )}
          </div>

          {/* Form Details */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            {/* Visitor Type Selection */}
            {personType === 'third_party' && (
              <div className="pb-4 border-b border-gray-100">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Tipo de Acesso</label>
                <div className="flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={() => setVisitorType('VISITOR')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                      visitorType === 'VISITOR' 
                        ? 'bg-blue-50 border-blue-500 text-blue-700' 
                        : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${visitorType === 'VISITOR' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
                      {visitorType === 'VISITOR' && <CheckCircle2 size={16} />}
                    </div>
                    <span className="text-sm font-bold">Visitante</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisitorType('SERVICE_PROVIDER')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                      visitorType === 'SERVICE_PROVIDER' 
                        ? 'bg-orange-50 border-orange-500 text-orange-700' 
                        : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${visitorType === 'SERVICE_PROVIDER' ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}>
                      {visitorType === 'SERVICE_PROVIDER' && <CheckCircle2 size={16} />}
                    </div>
                    <span className="text-sm font-bold">Prestador de Serviço</span>
                  </button>
                </div>
              </div>
            )}

            <div className="pb-4 border-b border-gray-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Data e Hora do Registro</label>
              <input 
                type="datetime-local" 
                value={logTime}
                onChange={(e) => {
                  setLogTime(e.target.value);
                  setIsManualTime(true);
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none transition-all font-mono"
                required
              />
              {isManualTime && (
                <button 
                  type="button" 
                  onClick={() => setIsManualTime(false)}
                  className="mt-1 text-[10px] text-blue-600 font-bold hover:underline"
                >
                  Voltar para horário atual
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">KM (Opcional)</label>
                <input 
                  type="number" 
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Horímetro (Opcional)</label>
                <input 
                  type="number" 
                  value={horometer}
                  onChange={(e) => setHorometer(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none transition-all"
                />
              </div>
            </div>
            {selectedMachine && (
              <div className="pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Modo de Transporte (Máquina)</label>
                <div className="flex gap-3">
                  <button 
                    type="button"
                    disabled={!!selectedVehicle}
                    onClick={() => setTransportMode('RODANDO')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all ${transportMode === 'RODANDO' ? 'border-black bg-black text-white' : 'border-gray-100 text-gray-400 hover:border-gray-200'} ${selectedVehicle ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    RODANDO
                  </button>
                  <button 
                    type="button"
                    onClick={() => setTransportMode('PRANCHA')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all ${transportMode === 'PRANCHA' ? 'border-black bg-black text-white' : 'border-gray-100 text-gray-400 hover:border-gray-200'}`}
                  >
                    NA PRANCHA
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Destinatário / Observação</label>
              <textarea 
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Para onde vai ou observações adicionais..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none transition-all h-24 resize-none"
              />
            </div>

            {/* Photo Section */}
            {(selectedVehicle || selectedMachine || personType === 'third_party') && (
              <div className="pt-4 border-t border-gray-100">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Foto do Veículo / Acesso (Opcional)</label>
                <div className="flex flex-col items-center gap-4">
                  {photo ? (
                    <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-gray-200">
                      <img src={photo} alt="Captura" className="w-full h-full object-cover" />
                      <button 
                        onClick={() => setPhoto(null)}
                        className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-all"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-8 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all"
                    >
                      <Camera size={32} />
                      <span className="text-sm font-bold">Tirar Foto ou Carregar</span>
                    </button>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoCapture}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {/* Checklist Section */}
            <div className="pt-4 border-t border-gray-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Checklist de Segurança (Opcional)</label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Uniforme</p>
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setHasUniform(true)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${hasUniform === true ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasUniform(false)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${hasUniform === false ? 'bg-red-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      NÃO
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasUniform(null)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${hasUniform === null ? 'bg-white text-gray-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      N/A
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Crachá</p>
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setHasBadge(true)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${hasBadge === true ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasBadge(false)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${hasBadge === false ? 'bg-red-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      NÃO
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasBadge(null)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${hasBadge === null ? 'bg-white text-gray-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      N/A
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary & Submit */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Resumo do Registro</h3>
            <div className="space-y-4">
              {personType === 'employee' ? (
                <SummaryItem 
                  label="Funcionário" 
                  value={selectedEmployee ? `${selectedEmployee.name} (${selectedEmployee.role_name || roles.find(r => r.id === selectedEmployee.role_id)?.name || 'Sem Cargo'})` : 'Não selecionado'} 
                  icon={<UserIcon size={14} />} 
                  active={!!selectedEmployee}
                  onClear={() => setSelectedEmployee(null)}
                />
              ) : (
                <SummaryItem 
                  label="Visitante / Prestador" 
                  value={selectedServiceProvider ? `${selectedServiceProvider.name}${selectedServiceProvider.company ? ` (${selectedServiceProvider.company})` : ''}` : (searchEmployee ? `${searchEmployee} (Manual)` : 'Não selecionado')} 
                  icon={<UserIcon size={14} />} 
                  active={!!selectedServiceProvider || searchEmployee.length > 0}
                  onClear={() => {
                    setSelectedServiceProvider(null);
                    setSearchEmployee('');
                    setVisitorCPF('');
                  }}
                />
              )}
              <SummaryItem 
                label="Veículo" 
                value={selectedVehicle ? `${selectedVehicle.plate}${selectedVehicle.asset_number ? ` (${selectedVehicle.asset_number})` : ''}` : 'Nenhum'} 
                icon={<Truck size={14} />} 
                active={!!selectedVehicle}
                onClear={() => setSelectedVehicle(null)}
              />
              <SummaryItem 
                label="Máquina" 
                value={selectedMachine ? `${selectedMachine.type}${selectedMachine.asset_number ? ` (${selectedMachine.asset_number})` : ''}${transportMode ? ` - ${transportMode}` : ''}` : 'Nenhuma'} 
                icon={<Settings size={14} />} 
                active={!!selectedMachine}
                onClear={() => {
                  setSelectedMachine(null);
                  setTransportMode(null);
                }}
              />
            </div>

            {selectedEmployee && selectedEmployee.is_authorized === false && (
              <div className="mt-4 p-3.5 bg-red-50 border-2 border-red-300 rounded-xl flex items-start gap-3 text-red-900 shadow-sm animate-pulse">
                <Ban size={20} className="shrink-0 mt-0.5 text-red-600" />
                <div className="text-xs">
                  <p className="font-extrabold uppercase tracking-wide text-red-800">Atenção: Funcionário Não Autorizado!</p>
                  <p className="mt-0.5 text-red-700 font-medium leading-relaxed">
                    Este colaborador está registrado como <strong>NÃO AUTORIZADO</strong> a entrar na empresa sem permissão prévia da diretoria/gerência.
                  </p>
                </div>
              </div>
            )}

            {selectedMachine && !transportMode && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2 text-amber-700 text-xs font-bold">
                <AlertCircle size={14} />
                <span>Selecione o modo de transporte da máquina</span>
              </div>
            )}

            {!selectedEmployee && !selectedServiceProvider && !(selectedMachine && transportMode === 'PRANCHA') && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-2 text-blue-700 text-xs font-bold">
                <UserIcon size={14} />
                <span>Selecione um funcionário, prestador ou operador</span>
              </div>
            )}

            <button 
              onClick={handleSubmit}
              disabled={(!selectedEmployee && !selectedServiceProvider && !(selectedMachine && transportMode === 'PRANCHA') && !(personType === 'third_party' && searchEmployee.trim().length > 0)) || (!!selectedMachine && !transportMode) || loading}
              className={`w-full mt-6 py-5 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg ${
                (!selectedEmployee && !selectedServiceProvider && !(selectedMachine && transportMode === 'PRANCHA') && !(personType === 'third_party' && searchEmployee.trim().length > 0)) || (!!selectedMachine && !transportMode) || loading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-black text-white hover:bg-gray-800 active:scale-95'
              }`}
            >
              {loading ? 'Salvando...' : (
                <>
                  <CheckCircle2 size={20} />
                  Confirmar {type === 'IN' ? 'Entrada' : 'Saída'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, icon, active, onClear }: { label: string, value: string, icon: React.ReactNode, active: boolean, onClear: () => void }) {
  return (
    <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${active ? 'bg-gray-50 border-gray-200' : 'bg-transparent border-dashed border-gray-200 opacity-50'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${active ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{label}</p>
          <p className="text-sm font-bold text-gray-900 truncate max-w-[120px]">{value}</p>
        </div>
      </div>
      {active && (
        <button onClick={onClear} className="text-gray-400 hover:text-red-500 transition-colors">
          <AlertCircle size={14} />
        </button>
      )}
    </div>
  );
}

function RegisterForms({ 
  setNotification, 
  setConfirmAction,
  setKeypadConfig,
  watchman
}: { 
  setNotification: (n: any) => void, 
  setConfirmAction: (action: { message: string, onConfirm: () => void | Promise<void> }) => void,
  setKeypadConfig: (config: any) => void,
  watchman?: Employee | null
}) {
  const isAdmin = Boolean(watchman?.is_admin);
  const [activeForm, setActiveForm] = useState<'employee' | 'vehicle' | 'machine' | 'third_party'>(
    isAdmin ? 'employee' : 'vehicle'
  );

  useEffect(() => {
    if (!isAdmin && (activeForm === 'employee' || activeForm === 'third_party')) {
      setActiveForm('vehicle');
    }
  }, [isAdmin, activeForm]);

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200/80 p-4 rounded-2xl text-blue-900 text-xs shadow-xs">
          <Shield size={20} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm text-blue-950">Cadastro Operacional de Portaria</p>
            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
              O sistema do vigia permite o registro e gestão operacional de <strong>Veículos</strong> e <strong>Máquinas</strong> do pátio.
              O cadastro e controle de <strong>Funcionários e Vigias</strong> é de responsabilidade exclusiva dos <strong>Administradores</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {isAdmin && (
          <>
            <TabButton active={activeForm === 'employee'} onClick={() => setActiveForm('employee')} icon={<UserIcon size={18} />} label="Funcionário / Vigia" className="flex-1" colorClass="red" />
            <TabButton active={activeForm === 'third_party'} onClick={() => setActiveForm('third_party')} icon={<UserIcon size={18} />} label="Prestador" className="flex-1" colorClass="green" />
          </>
        )}
        <TabButton active={activeForm === 'vehicle'} onClick={() => setActiveForm('vehicle')} icon={<Truck size={18} />} label="Veículo" className="flex-1" colorClass="blue" />
        <TabButton active={activeForm === 'machine'} onClick={() => setActiveForm('machine')} icon={<Settings size={18} />} label="Máquina" className="flex-1" colorClass="yellow" />
      </div>

      <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
        {isAdmin && activeForm === 'employee' && (
          <EmployeeForm 
            setNotification={setNotification} 
            setConfirmAction={setConfirmAction} 
            setKeypadConfig={setKeypadConfig}
          />
        )}
        {isAdmin && activeForm === 'third_party' && (
          <ThirdPartyForm 
            setNotification={setNotification} 
            setConfirmAction={setConfirmAction} 
            setKeypadConfig={setKeypadConfig}
          />
        )}
        {activeForm === 'vehicle' && <VehicleForm setNotification={setNotification} setConfirmAction={setConfirmAction} />}
        {activeForm === 'machine' && <MachineForm setNotification={setNotification} setConfirmAction={setConfirmAction} />}
      </div>
    </div>
  );
}

function ThirdPartyForm({ 
  setNotification, 
  setConfirmAction,
  setKeypadConfig
}: { 
  setNotification: (n: any) => void, 
  setConfirmAction: (action: { message: string, onConfirm: () => void | Promise<void> }) => void,
  setKeypadConfig: (config: any) => void
}) {
  const [formData, setFormData] = useState({ name: '', cpf: '', company: '', vehicle_plate: '' });
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'third_parties'), orderBy('name')),
      (snap) => {
        setServiceProviders(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as ServiceProvider));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'third_parties')
    );

    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCPF = formData.cpf.replace(/\D/g, '');
    
    if (cleanCPF.length > 0 && !validateCPF(cleanCPF)) {
      setNotification({ message: 'CPF inválido.', type: 'error' });
      return;
    }

    // Check for duplicate CPF
    const duplicate = serviceProviders.find(tp => tp.cpf === cleanCPF && tp.id !== editingId);
    if (cleanCPF.length > 0 && duplicate) {
      setNotification({ message: `Este CPF já está cadastrado para o prestador: ${duplicate.name}`, type: 'error' });
      return;
    }

    try {
      const data = {
        ...formData,
        cpf: cleanCPF,
        vehicle_plate: formData.vehicle_plate.toUpperCase()
      };

      if (editingId) {
        await updateDoc(doc(db, 'third_parties', editingId), data);
        setNotification({ message: 'Prestador de serviços atualizado!', type: 'success' });
      } else {
        await addDoc(collection(db, 'third_parties'), data);
        setNotification({ message: 'Prestador de serviços cadastrado!', type: 'success' });
      }
      
      setFormData({ name: '', cpf: '', company: '', vehicle_plate: '' });
      setEditingId(null);
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, editingId ? `third_parties/${editingId}` : 'third_parties');
      setNotification({ message: `Erro ao ${editingId ? 'atualizar' : 'cadastrar'} prestador.`, type: 'error' });
    }
  };

  const handleEdit = (tp: ServiceProvider) => {
    setFormData({
      name: tp.name,
      cpf: formatCPF(tp.cpf || ''),
      company: tp.company || '',
      vehicle_plate: tp.vehicle_plate || ''
    });
    setEditingId(tp.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    setConfirmAction({
      message: 'Excluir este prestador?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'third_parties', id));
          setNotification({ message: 'Prestador excluído com sucesso!', type: 'success' });
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `third_parties/${id}`);
          setNotification({ message: 'Erro ao excluir prestador.', type: 'error' });
        } finally {
          setConfirmAction(null);
        }
      }
    });
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Nome Completo</label>
          <input 
            type="text" 
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">CPF (Opcional)</label>
          <SmartCPFInput 
            value={formData.cpf}
            onChange={(val: string) => setFormData({...formData, cpf: val})}
            onOpenKeypad={setKeypadConfig}
            title="CPF do Prestador"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none font-mono"
            placeholder="000.000.000-00"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Empresa (Opcional)</label>
          <input 
            type="text" 
            value={formData.company}
            onChange={e => setFormData({...formData, company: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Placa do Veículo (Opcional)</label>
          <input 
            type="text" 
            value={formData.vehicle_plate}
            onChange={e => setFormData({...formData, vehicle_plate: e.target.value.toUpperCase()})}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none font-mono"
            placeholder="ABC-1234"
          />
        </div>
        <div className="md:col-span-2 flex gap-3">
          <button 
            type="submit" 
            className="flex-1 bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all"
          >
            {editingId ? 'Salvar Alterações' : 'Cadastrar Prestador'}
          </button>
          {editingId && (
            <button 
              type="button"
              onClick={() => {
                setEditingId(null);
                setFormData({ name: '', cpf: '', company: '', vehicle_plate: '' });
              }}
              className="px-6 bg-gray-100 text-gray-600 py-4 rounded-xl font-bold hover:bg-gray-200 transition-all"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="pt-8 border-t border-gray-100">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Prestadores Cadastrados</h3>
        <div className="grid grid-cols-1 gap-3">
          {serviceProviders.map(tp => (
            <div key={tp.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-gray-200 text-gray-400">
                  <UserIcon size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{tp.name}</p>
                  <p className="text-xs text-gray-500">
                    {tp.cpf ? `CPF: ${formatCPF(tp.cpf)} ` : ''}
                    {tp.company ? `• ${tp.company}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleEdit(tp)}
                  className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                  title="Editar prestador"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(tp.id)} 
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  title="Excluir prestador"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {serviceProviders.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm italic">Nenhum prestador cadastrado.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ activeShifts, setActiveTab, currentWatchmanId }: { activeShifts: any[], setActiveTab: (t: string) => void, currentWatchmanId?: string }) {
  const filteredShifts = activeShifts.filter(s => s.watchman_id !== currentWatchmanId);

  // States
  const [logsToday, setLogsToday] = useState<any[]>([]);
  const [logsRecent, setLogsRecent] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // Chart Interactive States
  const [chartFilter, setChartFilter] = useState<'ALL' | 'EMPLOYEE' | 'ASSET'>('ALL');
  const [hoveredHour, setHoveredHour] = useState<any | null>(null);

  useEffect(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayISO = startOfToday.toISOString();

    // 1. Listen for today's logs
    const qToday = query(
      collection(db, 'logs'),
      where('timestamp', '>=', startOfTodayISO)
    );
    const unsubscribeToday = onSnapshot(qToday, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      // Sort ascending by timestamp for accurate charting
      list.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setLogsToday(list);
      setLoading(false);
    }, (err) => {
      console.error("Error listening to today's logs:", err);
    });

    // 2. Listen for recent logs (all-time, last 500) to compute current Presence
    const qRecent = query(
      collection(db, 'logs'),
      orderBy('timestamp', 'desc'),
      limit(500)
    );
    const unsubscribeRecent = onSnapshot(qRecent, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setLogsRecent(list);
    }, (err) => {
      console.error("Error listening to recent logs:", err);
    });

    // 3. Listen to other collections for metadata
    const unsubEmp = onSnapshot(collection(db, 'employees'), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Employee));
    });
    const unsubMach = onSnapshot(collection(db, 'machines'), (snapshot) => {
      setMachines(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Machine));
    });
    const unsubVeh = onSnapshot(collection(db, 'vehicles'), (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Vehicle));
    });

    return () => {
      unsubscribeToday();
      unsubscribeRecent();
      unsubEmp();
      unsubMach();
      unsubVeh();
    };
  }, []);

  // Compute Current Presence in real-time
  const computeCurrentPresence = () => {
    const presentEmployeesMap = new Map<string, any>();
    const presentMachinesMap = new Map<string, any>();
    const presentVehiclesMap = new Map<string, any>();

    const processedEmployees = new Set<string>();
    const processedMachines = new Set<string>();
    const processedVehicles = new Set<string>();

    logsRecent.forEach(log => {
      // Employees
      if (log.employee_id && !processedEmployees.has(log.employee_id)) {
        processedEmployees.add(log.employee_id);
        if (log.type === 'IN') {
          presentEmployeesMap.set(log.employee_id, {
            id: log.employee_id,
            name: log.employee_name || 'Funcionário',
            time: log.timestamp,
            vehicle: log.vehicle_plate || null
          });
        }
      }

      // Machines
      if (log.machine_id && !processedMachines.has(log.machine_id)) {
        processedMachines.add(log.machine_id);
        if (log.type === 'IN') {
          presentMachinesMap.set(log.machine_id, {
            id: log.machine_id,
            type: log.machine_type || 'Máquina',
            asset: log.machine_asset || 'N/A',
            time: log.timestamp
          });
        }
      }

      // Vehicles
      const plateKey = log.vehicle_id || log.vehicle_plate;
      if (plateKey && !processedVehicles.has(plateKey)) {
        processedVehicles.add(plateKey);
        if (log.type === 'IN') {
          presentVehiclesMap.set(plateKey, {
            plate: log.vehicle_plate || 'N/A',
            asset: log.vehicle_asset || null,
            time: log.timestamp,
            employeeName: log.employee_name || 'Desconhecido'
          });
        }
      }
    });

    return {
      employees: Array.from(presentEmployeesMap.values()),
      machines: Array.from(presentMachinesMap.values()),
      vehicles: Array.from(presentVehiclesMap.values())
    };
  };

  const presence = computeCurrentPresence();

  // Hourly Chart Calculation
  const hourlyData = Array.from({ length: 24 }, (_, i) => {
    const hourStr = `${i.toString().padStart(2, '0')}:00`;
    return {
      hour: i,
      label: hourStr,
      entries: 0,
      exits: 0
    };
  });

  const filteredLogsForChart = logsToday.filter(log => {
    if (chartFilter === 'EMPLOYEE') return log.employee_id !== null && log.machine_id === null;
    if (chartFilter === 'ASSET') return log.machine_id !== null || log.vehicle_id !== null;
    return true; // ALL
  });

  filteredLogsForChart.forEach(log => {
    const date = new Date(log.timestamp);
    const hour = date.getHours();
    if (hour >= 0 && hour < 24) {
      if (log.type === 'IN') {
        hourlyData[hour].entries += 1;
      } else if (log.type === 'OUT') {
        hourlyData[hour].exits += 1;
      }
    }
  });

  // Keep hours from 06:00 to 22:00 for optimal screen estate
  const activeHours = hourlyData.filter(h => h.hour >= 6 && h.hour <= 22);

  // SVG Chart Dimensions & Computations
  const maxMovements = Math.max(
    ...activeHours.map(h => Math.max(h.entries, h.exits)),
    5 // minimum scale ceiling
  );

  const chartHeight = 160;
  const chartWidth = 600;
  const paddingLeft = 30;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 25;

  const graphHeight = chartHeight - paddingTop - paddingBottom;
  const graphWidth = chartWidth - paddingLeft - paddingRight;

  // Summaries by Type (grouping present machines & vehicles)
  const groupMachinesByType = () => {
    const counts: Record<string, number> = {};
    presence.machines.forEach(m => {
      counts[m.type] = (counts[m.type] || 0) + 1;
    });
    return Object.entries(counts).map(([type, count]) => ({ type, count }));
  };

  const groupVehiclesByBrand = () => {
    const counts: Record<string, number> = {};
    presence.vehicles.forEach(v => {
      const brand = v.plate.startsWith('PRANCHA') ? 'Prancha' : 'Veículo Geral';
      counts[brand] = (counts[brand] || 0) + 1;
    });
    return Object.entries(counts).map(([brand, count]) => ({ brand, count }));
  };

  const machinesSummary = groupMachinesByType();
  const vehiclesSummary = groupVehiclesByBrand();

  return (
    <div className="space-y-8">
      {/* Real-time Header Notice */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Dashboard Interativo de Portaria</h2>
          <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 mt-1 uppercase tracking-widest animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-ping"></span>
            Sincronizado e Atualizado em Tempo Real
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('global_history')}
            className="px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border border-gray-200/50"
          >
            Ver Relatórios
          </button>
          <button 
            onClick={() => setActiveTab('register')}
            className="px-5 py-2.5 bg-black hover:bg-gray-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm"
          >
            Cadastrar Novo
          </button>
        </div>
      </div>

      {/* Grid: 4 Realtime Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Pessoas Ativas */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs relative overflow-hidden flex flex-col justify-between h-36">
          <div className="absolute right-[-10px] bottom-[-10px] text-gray-100 opacity-20 pointer-events-none">
            <Users size={110} />
          </div>
          <div>
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Pessoas Presentes</h4>
            <p className="text-3xl font-black text-gray-900 mt-2">{presence.employees.length}</p>
          </div>
          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Dentro do Estabelecimento</p>
        </div>

        {/* Card 2: Máquinas Ativas */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs relative overflow-hidden flex flex-col justify-between h-36">
          <div className="absolute right-[-10px] bottom-[-10px] text-gray-100 opacity-20 pointer-events-none">
            <Truck size={110} />
          </div>
          <div>
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Máquinas Presentes</h4>
            <p className="text-3xl font-black text-gray-900 mt-2">{presence.machines.length}</p>
          </div>
          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Operando no Pátio</p>
        </div>

        {/* Card 3: Total Registrado Hoje */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs relative overflow-hidden flex flex-col justify-between h-36">
          <div className="absolute right-[-10px] bottom-[-10px] text-gray-100 opacity-20 pointer-events-none">
            <ClipboardList size={110} />
          </div>
          <div>
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Total de Registros Hoje</h4>
            <p className="text-3xl font-black text-gray-900 mt-2">{logsToday.length}</p>
          </div>
          <div className="flex gap-2 text-[9px] font-extrabold">
            <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{logsToday.filter(l => l.type === 'IN').length} IN</span>
            <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">{logsToday.filter(l => l.type === 'OUT').length} OUT</span>
          </div>
        </div>

        {/* Card 4: Vigias de Turno */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs relative overflow-hidden flex flex-col justify-between h-36">
          <div className="absolute right-[-10px] bottom-[-10px] text-gray-100 opacity-20 pointer-events-none">
            <Shield size={110} />
          </div>
          <div>
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Vigias Ativos</h4>
            <p className="text-3xl font-black text-gray-900 mt-2">{filteredShifts.length}</p>
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {filteredShifts.map((s, idx) => (
              <span key={s.id || idx} className="text-[8px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-full truncate max-w-[80px]" title={s.watchman_name}>
                {s.watchman_name.split(' ')[0]}
              </span>
            ))}
            {filteredShifts.length === 0 && (
              <span className="text-[9px] text-gray-400 font-medium italic">Nenhum vigilante online</span>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Chart & Present Vehicle/Machine Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Interactive SVG Chart Card */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <div>
              <h3 className="text-base font-bold text-gray-900">Fluxo de Trânsito Hoje</h3>
              <p className="text-xs text-gray-400 font-medium">Movimentações consolidadas por hora do dia</p>
            </div>
            
            {/* Interactive Filters */}
            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
              <button 
                onClick={() => setChartFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${chartFilter === 'ALL' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setChartFilter('EMPLOYEE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${chartFilter === 'EMPLOYEE' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Pessoas
              </button>
              <button 
                onClick={() => setChartFilter('ASSET')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${chartFilter === 'ASSET' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Ativos
              </button>
            </div>
          </div>

          {/* SVG Custom Responsive Bar Chart */}
          <div className="relative flex-1 flex items-center justify-center min-h-[180px]">
            <svg 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-full select-none"
            >
              {/* Horizontal grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
                const y = paddingTop + graphHeight * p;
                const value = Math.round(maxMovements * (1 - p));
                return (
                  <g key={idx}>
                    <line 
                      x1={paddingLeft} 
                      y1={y} 
                      x2={chartWidth - paddingRight} 
                      y2={y} 
                      stroke="#F3F4F6" 
                      strokeWidth="1" 
                    />
                    <text 
                      x={paddingLeft - 8} 
                      y={y + 3} 
                      className="text-[9px] font-bold text-gray-400 font-mono" 
                      textAnchor="end"
                    >
                      {value}
                    </text>
                  </g>
                );
              })}

              {/* Draw bars for active hours */}
              {activeHours.map((h, idx) => {
                const N = activeHours.length;
                const slotWidth = graphWidth / N;
                const xCenter = paddingLeft + idx * slotWidth + slotWidth / 2;
                
                // Bar coordinates
                const barWidth = 6;
                const xEntries = xCenter - barWidth - 1;
                const xExits = xCenter + 1;
                
                const entriesHeight = (h.entries / maxMovements) * graphHeight;
                const exitsHeight = (h.exits / maxMovements) * graphHeight;
                
                const yEntries = chartHeight - paddingBottom - entriesHeight;
                const yExits = chartHeight - paddingBottom - exitsHeight;

                const isHovered = hoveredHour?.hour === h.hour;

                return (
                  <g key={h.hour}>
                    {/* Invisible overlay for easy hover selection */}
                    <rect 
                      x={paddingLeft + idx * slotWidth} 
                      y={paddingTop} 
                      width={slotWidth} 
                      height={graphHeight} 
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredHour(h)}
                      onMouseLeave={() => setHoveredHour(null)}
                    />

                    {/* Entries Bar (Green) */}
                    <rect 
                      x={xEntries} 
                      y={yEntries} 
                      width={barWidth} 
                      height={Math.max(entriesHeight, 0)} 
                      rx={1.5} 
                      fill={isHovered ? "#059669" : "#10B981"} 
                      className="transition-all duration-200"
                    />

                    {/* Exits Bar (Rose Red) */}
                    <rect 
                      x={xExits} 
                      y={yExits} 
                      width={barWidth} 
                      height={Math.max(exitsHeight, 0)} 
                      rx={1.5} 
                      fill={isHovered ? "#E11D48" : "#F43F5E"} 
                      className="transition-all duration-200"
                    />

                    {/* Hour labels */}
                    {idx % 2 === 0 && (
                      <text 
                        x={xCenter} 
                        y={chartHeight - 8} 
                        className="text-[9px] font-bold text-gray-400 font-mono" 
                        textAnchor="middle"
                      >
                        {h.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Overlay */}
            <AnimatePresence>
              {hoveredHour && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-950 text-white p-3 rounded-2xl shadow-xl z-30 space-y-1 text-center text-xs border border-white/10"
                >
                  <p className="font-bold text-[10px] text-gray-400 uppercase tracking-widest">{hoveredHour.label} às {(hoveredHour.hour + 1).toString().padStart(2, '0')}:00</p>
                  <div className="flex gap-4 font-extrabold text-sm pt-1">
                    <span className="text-emerald-400">{hoveredHour.entries} Entradas</span>
                    <span className="text-rose-400">{hoveredHour.exits} Saídas</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="flex justify-center gap-6 text-[10px] font-extrabold uppercase tracking-wider text-gray-500 border-t border-gray-50 pt-4 mt-2">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              Entradas (IN)
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              Saídas (OUT)
            </span>
          </div>
        </div>

        {/* Summaries by Type Card */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Resumo de Ativos Presentes</h3>
            <p className="text-xs text-gray-400 font-medium mb-4">Classificação por tipo de ativo presente</p>
            
            <div className="space-y-4 max-h-[190px] overflow-y-auto pr-1">
              {/* Machines breakdown */}
              {machinesSummary.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-2xl border border-gray-100/50">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-xs uppercase">
                      {MACHINE_TYPE_SIGLAS[item.type] || 'MAQ'}
                    </div>
                    <span className="text-xs font-bold text-gray-900 truncate">{item.type}</span>
                  </div>
                  <span className="text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                    {item.count} presente{item.count > 1 ? 's' : ''}
                  </span>
                </div>
              ))}

              {/* Vehicles breakdown */}
              {vehiclesSummary.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-2xl border border-gray-100/50">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                      <Truck size={14} />
                    </div>
                    <span className="text-xs font-bold text-gray-900 truncate">{item.brand}</span>
                  </div>
                  <span className="text-xs font-black text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full">
                    {item.count} presente{item.count > 1 ? 's' : ''}
                  </span>
                </div>
              ))}

              {presence.machines.length === 0 && presence.vehicles.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-xs italic">
                  Nenhuma máquina ou veículo no pátio.
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-50 pt-3 mt-4 text-center">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-none">
              Capacidade do Estabelecimento • Livre
            </p>
          </div>
        </div>
      </div>

      {/* Online Shifts Table (Preserved from original dashboard) */}
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
        <h3 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Clock size={18} className="text-blue-600 animate-pulse" />
          Acompanhamento de Turnos Ativos
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-gray-100">
                <th className="pb-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Vigia</th>
                <th className="pb-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Início do Turno</th>
                <th className="pb-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="pb-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredShifts.map(shift => (
                <tr key={shift.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 font-bold text-gray-900">{shift.watchman_name}</td>
                  <td className="py-4 text-sm text-gray-500">
                    {new Date(shift.start_time).toLocaleString('pt-BR')}
                  </td>
                  <td className="py-4">
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase">Online</span>
                  </td>
                  <td className="py-4 text-right">
                    <button 
                      onClick={() => setActiveTab('global_history')}
                      className="text-blue-600 hover:text-blue-800 text-sm font-bold"
                    >
                      Ver Detalhes
                    </button>
                  </td>
                </tr>
              ))}
              {filteredShifts.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400 italic text-sm">
                    Nenhum turno ativo no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CompanySettings({ settings, onUpdate, setNotification }: { settings: any, onUpdate: (s: any) => void, setNotification: (n: any) => void }) {
  const [formData, setFormData] = useState(settings);
  const [testLoading, setTestLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [oldConfigJson, setOldConfigJson] = useState(`{
  "projectId": "gen-lang-client-0050213982",
  "appId": "1:882760679210:web:4c49f9b07089d266e0a853",
  "apiKey": "AIzaSyAuwTAO5pEa_yTOlLMzwx2rav_eGCzu4B8",
  "authDomain": "gen-lang-client-0050213982.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-9872f337-9d29-4da7-9061-a142dbf802be",
  "storageBucket": "gen-lang-client-0050213982.firebasestorage.app",
  "messagingSenderId": "882760679210"
}`);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'settings', 'global'), formData);
      
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setNotification({ message: 'Configurações salvas!', type: 'success' });
      onUpdate(formData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/global');
      setNotification({ message: 'Erro ao salvar configurações.', type: 'error' });
    }
  };

  const handleTestEmail = async () => {
    setTestLoading(true);
    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: formData })
      });
      const result = await response.json();
      if (result.success) {
        setNotification({ message: 'Sucesso! E-mail de teste enviado para ' + formData.report_email, type: 'success' });
      } else {
        setNotification({ message: 'Erro no teste: ' + result.message, type: 'error' });
      }
    } catch (err: any) {
      setNotification({ message: 'Erro ao conectar com o servidor: ' + err.message, type: 'error' });
    } finally {
      setTestLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, company_logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const rawContent = ev.target?.result as string;
        const parsedData = JSON.parse(rawContent);

        const response = await fetch('/api/import-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: parsedData })
        });
        const resJson = await response.json();

        if (resJson.success) {
          setNotification({ 
            message: `Importação concluída! ${resJson.count || 0} registros inseridos com sucesso no novo banco.`, 
            type: 'success' 
          });
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          setNotification({ message: `Falha na importação: ${resJson.message}`, type: 'error' });
        }
      } catch (err: any) {
        setNotification({ message: 'Arquivo JSON inválido: ' + err.message, type: 'error' });
      } finally {
        setImportLoading(false);
        if (jsonFileInputRef.current) jsonFileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleMigrateFromOldFirebase = async () => {
    setMigrationLoading(true);
    try {
      let parsedConfig;
      try {
        parsedConfig = JSON.parse(oldConfigJson);
      } catch {
        setNotification({ message: 'JSON de configuração inválido. Verifique a sintaxe.', type: 'error' });
        setMigrationLoading(false);
        return;
      }

      const response = await fetch('/api/migrate-from-firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldConfig: parsedConfig })
      });
      const result = await response.json();

      if (result.success) {
        setNotification({ 
          message: result.message || 'Migração concluída com sucesso!', 
          type: 'success' 
        });
        setShowMigrateModal(false);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setNotification({ message: result.message || 'Erro ao migrar dados.', type: 'error' });
      }
    } catch (err: any) {
      setNotification({ message: 'Erro na conexão de migração: ' + err.message, type: 'error' });
    } finally {
      setMigrationLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Configurações da Empresa</h2>
      <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Nome da Empresa (Prestadora)</label>
              <input 
                type="text" 
                value={formData.company_name}
                onChange={e => setFormData({...formData, company_name: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none"
                placeholder="Ex: Sentinela Serviços"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Nome da Empresa Cliente (Opcional)</label>
              <input 
                type="text" 
                value={formData.client_company_name || ''}
                onChange={e => setFormData({...formData, client_company_name: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none"
                placeholder="Ex: RSN Logística"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Logo da Empresa</label>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center overflow-hidden border border-gray-200">
                {formData.company_logo ? (
                  <img src={formData.company_logo} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <HardHat className="text-gray-300 w-10 h-10" />
                )}
              </div>
              <div className="flex-1">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800 cursor-pointer"
                />
                <p className="mt-2 text-xs text-gray-400">Recomendado: Imagem quadrada (PNG ou JPG)</p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Shield size={18} className="text-blue-600" />
              Dados do Administrador
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">E-mail do Administrador</label>
                <input 
                  type="email" 
                  value={formData.admin_email || ''}
                  onChange={e => setFormData({...formData, admin_email: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none"
                  placeholder="admin@empresa.com"
                />
                <p className="mt-1 text-[10px] text-gray-400">E-mail para contato e notificações administrativas.</p>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Telefone do Administrador</label>
                <input 
                  type="text" 
                  value={formData.admin_phone || ''}
                  onChange={e => setFormData({...formData, admin_phone: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none"
                  placeholder="5511999999999"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Configurações de Relatório por E-mail</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">E-mail para Recebimento</label>
                <input 
                  type="email" 
                  value={formData.report_email || ''}
                  onChange={e => setFormData({...formData, report_email: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none"
                  placeholder="exemplo@empresa.com"
                />
                <p className="mt-1 text-[10px] text-gray-400">Este e-mail receberá o relatório automático ao encerrar o turno.</p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">WhatsApp para Recebimento</label>
                <input 
                  type="text" 
                  value={formData.report_whatsapp || ''}
                  onChange={e => setFormData({...formData, report_whatsapp: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none"
                  placeholder="Ex: 5511999999999"
                />
                <p className="mt-1 text-[10px] text-gray-400">Número com DDI (55) e DDD. O relatório será enviado ao encerrar o turno.</p>
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Servidor SMTP (Host)</label>
                <input 
                  type="text" 
                  value={formData.smtp_host || ''}
                  onChange={e => setFormData({...formData, smtp_host: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none"
                  placeholder="smtp.gmail.com"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Porta SMTP</label>
                <input 
                  type="text" 
                  value={formData.smtp_port || ''}
                  onChange={e => setFormData({...formData, smtp_port: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none"
                  placeholder="587"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Usuário SMTP (E-mail de envio)</label>
                <input 
                  type="text" 
                  value={formData.smtp_user || ''}
                  onChange={e => setFormData({...formData, smtp_user: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none"
                  placeholder="envio@empresa.com"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Senha do E-mail (App Password)</label>
                <input 
                  type="password" 
                  value={formData.smtp_pass || ''}
                  onChange={e => setFormData({...formData, smtp_pass: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none"
                  placeholder="••••••••"
                />
                <p className="mt-1 text-[10px] text-gray-400">Para Gmail, use uma "Senha de App". Não use sua senha normal.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button 
                type="submit" 
                className="flex-1 bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all"
              >
                Salvar Configurações
              </button>
              <button 
                type="button"
                onClick={handleTestEmail}
                disabled={testLoading}
                className="px-6 bg-gray-100 text-gray-700 py-4 rounded-xl font-bold hover:bg-gray-200 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {testLoading ? 'Testando...' : (
                  <>
                    <LogIn size={18} />
                    Testar E-mail
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-12 pt-8 border-t border-gray-100 space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Gerenciamento e Migração de Dados</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Backup Download */}
            <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex flex-col justify-between">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <Download size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-900">Backup Completo</p>
                  <p className="text-xs text-blue-700 mt-1">Baixe todos os dados em formato JSON para salvar no computador.</p>
                </div>
              </div>
              <a 
                href="/api/download-db" 
                download 
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all text-center shadow-sm flex items-center justify-center gap-2"
              >
                <Download size={16} />
                Baixar Backup (.json)
              </a>
            </div>

            {/* JSON File Import */}
            <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 flex flex-col justify-between">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                  <Upload size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-900">Importar / Restaurar</p>
                  <p className="text-xs text-emerald-700 mt-1">Carregue um arquivo .json para injetar no novo banco de dados.</p>
                </div>
              </div>
              <div>
                <input 
                  type="file" 
                  ref={jsonFileInputRef}
                  accept=".json" 
                  onChange={handleImportJsonFile} 
                  className="hidden" 
                />
                <button
                  type="button"
                  onClick={() => jsonFileInputRef.current?.click()}
                  disabled={importLoading}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all text-center shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {importLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {importLoading ? 'Importando...' : 'Selecionar Arquivo JSON'}
                </button>
              </div>
            </div>

            {/* Migrate from Old Firebase */}
            <div className="bg-purple-50 p-5 rounded-2xl border border-purple-100 flex flex-col justify-between">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-purple-900">Migrar Firebase Antigo</p>
                  <p className="text-xs text-purple-700 mt-1">Copie automaticamente todos os dados de outro projeto Firebase.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMigrateModal(true)}
                className="w-full py-2.5 bg-purple-600 text-white rounded-xl font-bold text-xs hover:bg-purple-700 transition-all text-center shadow-sm flex items-center justify-center gap-2"
              >
                <ArrowRightLeft size={16} />
                Abrir Migrador Firebase
              </button>
            </div>
          </div>

          {/* Modal Migração Firebase */}
          <AnimatePresence>
            {showMigrateModal && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-6"
                >
                  <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                        <ArrowRightLeft size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Migrar do Banco Antigo</h3>
                        <p className="text-xs text-gray-500">Copia funcionários, veículos, máquinas e logs para o novo banco.</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowMigrateModal(false)}
                      className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Configuração Firebase de Origem (JSON)
                    </label>
                    <textarea 
                      value={oldConfigJson}
                      onChange={(e) => setOldConfigJson(e.target.value)}
                      rows={8}
                      className="w-full font-mono text-xs p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-600 outline-none bg-gray-50 text-gray-800"
                      placeholder="Cole aqui o objeto firebaseConfig de origem..."
                    />
                    <p className="text-[11px] text-gray-500">
                      O sistema lerá as coleções do banco de origem e gravará cada registro diretamente na nova instância ativa.
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => setShowMigrateModal(false)}
                      className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="button"
                      onClick={handleMigrateFromOldFirebase}
                      disabled={migrationLoading}
                      className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                    >
                      {migrationLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRightLeft size={18} />}
                      {migrationLoading ? 'Migrando Dados...' : 'Iniciar Migração Agora'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, className = '', colorClass = 'gray' }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, className?: string, colorClass?: 'red' | 'green' | 'blue' | 'yellow' | 'gray' }) {
  const colors = {
    red: { active: 'bg-red-600 text-white shadow-red-200', inactive: 'bg-white text-red-600 border-red-100 hover:bg-red-50' },
    green: { active: 'bg-emerald-600 text-white shadow-emerald-200', inactive: 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50' },
    blue: { active: 'bg-blue-600 text-white shadow-blue-200', inactive: 'bg-white text-blue-600 border-blue-100 hover:bg-blue-50' },
    yellow: { active: 'bg-amber-500 text-white shadow-amber-200', inactive: 'bg-white text-amber-600 border-amber-100 hover:bg-amber-50' },
    gray: { active: 'bg-black text-white shadow-gray-200', inactive: 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50' }
  };

  const current = colors[colorClass];

  return (
    <button 
      onClick={onClick}
      className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap border shadow-sm ${
        active ? `${current.active} border-transparent` : current.inactive
      } ${className}`}
    >
      {icon}
      {label}
    </button>
  );
}

function EmployeeForm({ 
  setNotification, 
  setConfirmAction,
  setKeypadConfig
}: { 
  setNotification: (n: any) => void, 
  setConfirmAction: (action: { message: string, onConfirm: () => void | Promise<void> }) => void,
  setKeypadConfig: (config: any) => void
}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [formData, setFormData] = useState({ 
    name: '', 
    cpf: '', 
    email: '', 
    role_id: '', 
    is_watchman: false, 
    is_admin: false, 
    is_authorized: true, 
    photo: null as string | null, 
    password: '' 
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence for draft employee data
  useEffect(() => {
    const saved = localStorage.getItem('vigia_control_draft_employee');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData(prev => ({ ...prev, ...parsed }));
        if (parsed.editingId) setEditingId(parsed.editingId);
      } catch (e) {
        console.error("Error restoring draft employee:", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('vigia_control_draft_employee', JSON.stringify({ ...formData, editingId }));
  }, [formData, editingId]);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setNotification({ message: 'Arquivo muito grande. Tente tirar uma foto com menor resolução.', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setNotification({ message: 'Erro ao ler arquivo da câmera.', type: 'error' });
    };
    reader.onload = (event) => {
      try {
        const img = new Image();
        img.onerror = () => {
          setNotification({ message: 'Erro ao processar imagem.', type: 'error' });
        };
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400; // Smaller for profile photos
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
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
            }

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setFormData(prev => ({ ...prev, photo: dataUrl }));
            if (e.target) e.target.value = '';
          } catch (canvasErr) {
            console.error("Canvas error:", canvasErr);
            setNotification({ message: 'Erro ao processar dimensões da imagem.', type: 'error' });
          }
        };
        img.src = event.target?.result as string;
      } catch (imgErr) {
        console.error("Image loading error:", imgErr);
        setNotification({ message: 'Erro ao carregar prévia da imagem.', type: 'error' });
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    // Listen for Roles
    const rolesUnsubscribe = onSnapshot(
      query(collection(db, 'roles'), orderBy('name')),
      (snap) => {
        setRoles(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Role));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'roles')
    );

    // Listen for Employees
    const employeesUnsubscribe = onSnapshot(
      query(collection(db, 'employees'), orderBy('name')),
      (snap) => {
        setEmployees(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Employee));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'employees')
    );

    return () => {
      rolesUnsubscribe();
      employeesUnsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCPF = formData.cpf.replace(/\D/g, '');
    
    if (cleanCPF.length > 0 && !validateCPF(cleanCPF)) {
      setNotification({ message: 'CPF inválido. Por favor, verifique os números.', type: 'error' });
      return;
    }

    if (formData.is_watchman && cleanCPF.length === 0) {
      setNotification({ message: 'CPF é obrigatório para vigias.', type: 'error' });
      return;
    }

    // Check for duplicate CPF
    const duplicate = employees.find(emp => emp.cpf === cleanCPF && emp.id !== editingId);
    if (cleanCPF.length > 0 && duplicate) {
      setNotification({ message: `Este CPF já está cadastrado para o funcionário: ${duplicate.name}`, type: 'error' });
      return;
    }

    try {
      const selectedRole = roles.find(r => r.id === formData.role_id);
      const data = {
        ...formData,
        is_authorized: formData.is_authorized !== false,
        email: (formData.email || '').trim().toLowerCase(),
        role_name: selectedRole ? selectedRole.name : '',
        cpf: cleanCPF
      };

      if (editingId) {
        await updateDoc(doc(db, 'employees', editingId), data);
        setNotification({ message: 'Funcionário atualizado!', type: 'success' });
      } else {
        await addDoc(collection(db, 'employees'), data);
        setNotification({ message: 'Funcionário cadastrado!', type: 'success' });
      }
      
      setFormData({ name: '', cpf: '', email: '', role_id: '', is_watchman: false, is_admin: false, is_authorized: true, photo: null, password: '' });
      setEditingId(null);
      localStorage.removeItem('vigia_control_draft_employee');
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, editingId ? `employees/${editingId}` : 'employees');
      setNotification({ message: `Erro ao ${editingId ? 'atualizar' : 'cadastrar'} funcionário.`, type: 'error' });
    }
  };

  const handleEdit = (emp: any) => {
    setFormData({
      name: emp.name,
      cpf: formatCPF(emp.cpf || ''),
      email: emp.email || '',
      role_id: emp.role_id,
      is_watchman: emp.is_watchman || false,
      is_admin: emp.is_admin || false,
      is_authorized: emp.is_authorized !== false,
      photo: emp.photo || null,
      password: emp.password || ''
    });
    setEditingId(emp.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    setConfirmAction({
      message: 'Tem certeza que deseja excluir este funcionário?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'employees', id));
          setNotification({ message: 'Funcionário excluído com sucesso!', type: 'success' });
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `employees/${id}`);
          setNotification({ message: 'Erro ao excluir funcionário. Verifique suas permissões.', type: 'error' });
        } finally {
          setConfirmAction(null);
        }
      }
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Gestão de Funcionários</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Nome Completo</label>
          <div className="relative">
            <input 
              type="text" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full pr-12 pl-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none"
              required
            />
            <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            E-mail (Conta Google / Administrador)
          </label>
          <input 
            type="email" 
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none"
            placeholder="usuario@gmail.com"
          />
          <p className="mt-1 text-[10px] text-gray-400">
            {formData.is_admin ? '⭐ Este e-mail terá permissão para logar como Administrador via Google.' : 'E-mail do funcionário para identificação.'}
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Cargo</label>
          <select 
            value={formData.role_id}
            onChange={e => setFormData({...formData, role_id: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none bg-white"
            required
          >
            <option value="">Selecione um cargo</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        {/* Selection Box: Autorizado / Não Autorizado */}
        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            Permissão de Acesso à Empresa
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_authorized: true })}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                formData.is_authorized !== false
                  ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  formData.is_authorized !== false ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold leading-tight">Autorizado</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Livre acesso / Entrada regular permitida</p>
                </div>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                formData.is_authorized !== false ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'
              }`}>
                {formData.is_authorized !== false && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_authorized: false })}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                formData.is_authorized === false
                  ? 'bg-red-50 border-red-500 ring-2 ring-red-500/20 text-red-950'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  formData.is_authorized === false ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  <Ban size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold leading-tight">Não Autorizado</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Entrada proibida sem permissão prévia</p>
                </div>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                formData.is_authorized === false ? 'border-red-600 bg-red-600' : 'border-gray-300'
              }`}>
                {formData.is_authorized === false && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500">
            {formData.is_authorized !== false 
              ? '🟢 O funcionário poderá entrar na portaria com liberação normal.' 
              : '🔴 O vigia na portaria receberá um alerta vermelho bloqueando a entrada deste funcionário sem permissão expressa.'}
          </p>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            CPF {formData.is_watchman && <span className="text-red-500">*</span>}
          </label>
          <div className="relative">
            <SmartCPFInput 
              value={formData.cpf}
              onChange={(val: string) => setFormData({...formData, cpf: val})}
              onOpenKeypad={setKeypadConfig}
              title="CPF do Funcionário"
              className="w-full pr-12 pl-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none font-mono"
              placeholder="000.000.000-00"
              required={formData.is_watchman}
            />
            <Hash className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          </div>
          {!formData.is_watchman && <p className="mt-1 text-[10px] text-gray-400">Opcional para funcionários comuns</p>}
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Foto do Funcionário</label>
          <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
            <div className="relative group">
              <div className="w-32 h-32 bg-white rounded-2xl border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                {formData.photo ? (
                  <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={40} className="text-gray-300" />
                )}
              </div>
              {formData.photo && (
                <button 
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, photo: null }))}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            
            <div className="flex-1 space-y-3">
              <p className="text-xs text-gray-500 font-medium">Use a câmera para capturar uma foto nítida do rosto do funcionário para identificação.</p>
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all shadow-sm flex items-center gap-2"
                >
                  <Camera size={18} />
                  {formData.photo ? 'Mudar Foto' : 'Tirar Foto'}
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

        <div className="md:col-span-2 flex flex-col gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              id="is_watchman"
              checked={formData.is_watchman}
              onChange={e => setFormData({...formData, is_watchman: e.target.checked})}
              className="w-5 h-5 accent-black"
            />
            <label htmlFor="is_watchman" className="text-sm font-bold text-gray-700">Este funcionário é um Vigia (pode acessar o sistema)</label>
          </div>

          {formData.is_watchman && (
            <div className="pl-8 pt-2 border-l-2 border-black/20 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Senha de Acesso (para o App Móvel)</label>
              <input 
                type="password" 
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                placeholder="Defina uma senha numérica ou alfanumérica"
                className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-black outline-none bg-white text-sm"
                required={formData.is_watchman}
              />
            </div>
          )}
          
          {/* Only show Admin checkbox if current user is admin */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-200 mt-2">
            <input 
              type="checkbox" 
              id="is_admin"
              checked={formData.is_admin}
              onChange={e => setFormData({...formData, is_admin: e.target.checked})}
              className="w-5 h-5 accent-blue-600"
            />
            <label htmlFor="is_admin" className="text-sm font-bold text-blue-700">Este funcionário é um Administrador (pode gerenciar cadastros e configurações)</label>
          </div>
        </div>
        <div className="md:col-span-2 flex gap-3">
          <button 
            type="submit" 
            className="flex-1 bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all"
          >
            {editingId ? 'Salvar Alterações' : 'Cadastrar Funcionário'}
          </button>
          {editingId && (
            <button 
              type="button"
              onClick={() => {
                setEditingId(null);
                setFormData({ name: '', cpf: '', email: '', role_id: '', is_watchman: false, is_admin: false, is_authorized: true, photo: null, password: '' });
                localStorage.removeItem('vigia_control_draft_employee');
              }}
              className="px-6 bg-gray-100 text-gray-600 py-4 rounded-xl font-bold hover:bg-gray-200 transition-all"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="pt-8 border-t border-gray-100">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Funcionários Cadastrados</h3>
        <div className="grid grid-cols-1 gap-3">
          {employees.map(emp => (
            <div key={emp.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-gray-200 text-gray-400 overflow-hidden">
                  {emp.photo ? (
                    <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={24} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900">{emp.name}</p>
                    {emp.is_authorized === false ? (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 border border-red-200">
                        <Ban size={11} />
                        Não Autorizado
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-emerald-200">
                        <CheckCircle2 size={11} />
                        Autorizado
                      </span>
                    )}
                    {emp.is_admin && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 border border-purple-200">
                        <Shield size={11} />
                        Admin Firebase
                      </span>
                    )}
                    {emp.is_watchman && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold uppercase tracking-wider border border-blue-200">
                        Vigia
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {emp.cpf ? <span>{formatCPF(emp.cpf)} •</span> : null}
                    <span>{emp.role_name || roles.find(r => r.id === emp.role_id)?.name || 'Sem cargo'}</span>
                    {emp.email && (
                      <>
                        <span>•</span>
                        <span className="text-blue-600 font-mono text-[11px] font-medium">{emp.email}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleEdit(emp)}
                  className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                  title="Editar funcionário"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(emp.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  title="Excluir funcionário"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {employees.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm italic">Nenhum funcionário cadastrado.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function VehicleForm({ setNotification, setConfirmAction }: { setNotification: (n: any) => void, setConfirmAction: (action: { message: string, onConfirm: () => void | Promise<void> }) => void }) {
  const [formData, setFormData] = useState({ brand: '', model: '', plate: '', color: '', asset_number: '', responsible_employee_id: '' });
  const [employees, setEmployees] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const employeesUnsubscribe = onSnapshot(
      query(collection(db, 'employees'), orderBy('name')),
      (snap) => {
        setEmployees(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Employee));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'employees')
    );

    const rolesUnsubscribe = onSnapshot(
      query(collection(db, 'roles'), orderBy('name')),
      (snap) => {
        setRoles(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Role));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'roles')
    );

    const vehiclesUnsubscribe = onSnapshot(
      query(collection(db, 'vehicles'), orderBy('brand')),
      (snap) => {
        setVehicles(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Vehicle));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'vehicles')
    );

    return () => {
      employeesUnsubscribe();
      rolesUnsubscribe();
      vehiclesUnsubscribe();
    };
  }, []);

  // Filter eligible responsibles: only Motoristas and Operadores (strictly excluding Vigias and Admins)
  const eligibleEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (formData.responsible_employee_id && emp.id === formData.responsible_employee_id) {
        return true;
      }
      if (emp.is_watchman || emp.is_admin || emp.role_id === 'admin') {
        return false;
      }
      const roleName = (emp.role_name || roles.find(r => r.id === emp.role_id)?.name || '').toLowerCase();
      if (roleName.includes('vigia') || roleName.includes('admin')) {
        return false;
      }
      return roleName.includes('motorista') || roleName.includes('operador') || roleName.includes('condutor') || roleName.includes('máquina') || roleName.includes('maquina');
    });
  }, [employees, roles, formData.responsible_employee_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const upperPlate = formData.plate.toUpperCase();

    // Check for duplicate Plate
    const duplicate = vehicles.find(veh => veh.plate.toUpperCase() === upperPlate && veh.id !== editingId);
    if (duplicate) {
      setNotification({ message: `Esta placa já está cadastrada para o veículo: ${duplicate.brand} ${duplicate.model}`, type: 'error' });
      return;
    }

    try {
      const data = { ...formData, plate: upperPlate };
      if (editingId) {
        await updateDoc(doc(db, 'vehicles', editingId), data);
        setNotification({ message: 'Veículo atualizado!', type: 'success' });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'vehicles'), data);
        setNotification({ message: 'Veículo cadastrado!', type: 'success' });
      }
      setFormData({ brand: '', model: '', plate: '', color: '', asset_number: '', responsible_employee_id: '' });
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, editingId ? `vehicles/${editingId}` : 'vehicles');
      setNotification({ message: `Erro ao ${editingId ? 'atualizar' : 'cadastrar'} veículo.`, type: 'error' });
    }
  };

  const handleEdit = (veh: any) => {
    setFormData({
      brand: veh.brand || '',
      model: veh.model || '',
      plate: veh.plate || '',
      color: veh.color || '',
      asset_number: veh.asset_number || '',
      responsible_employee_id: veh.responsible_employee_id || ''
    });
    setEditingId(veh.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    setConfirmAction({
      message: 'Tem certeza que deseja excluir este veículo?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'vehicles', id));
          setNotification({ message: 'Veículo excluído com sucesso!', type: 'success' });
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `vehicles/${id}`);
          setNotification({ message: 'Erro ao excluir veículo.', type: 'error' });
        } finally {
          setConfirmAction(null);
        }
      }
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Gestão de Veículos</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Marca</label>
          <select 
            value={formData.brand}
            onChange={e => setFormData({...formData, brand: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none bg-white"
            required
          >
            <option value="">Selecione a marca</option>
            {VEHICLE_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Modelo</label>
          <div className="relative">
            <input 
              type="text" 
              value={formData.model}
              onChange={e => setFormData({...formData, model: e.target.value})}
              className="w-full pr-12 pl-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none"
              required
            />
            <Truck className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Placa</label>
          <div className="relative">
            <input 
              type="text" 
              value={formData.plate}
              onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})}
              className="w-full pr-12 pl-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none font-mono"
              placeholder="ABC-1234"
              required
            />
            <Hash className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Patrimônio (Ex: P.001)</label>
          <div className="relative">
            <input 
              type="text" 
              value={formData.asset_number}
              onChange={e => setFormData({...formData, asset_number: e.target.value.toUpperCase()})}
              className="w-full pr-12 pl-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none font-mono"
              placeholder="P.000"
            />
            <Hash className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Cor</label>
          <div className="relative">
            <input 
              type="text" 
              value={formData.color}
              onChange={e => setFormData({...formData, color: e.target.value})}
              className="w-full pr-12 pl-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none"
              placeholder="Ex: Branco, Azul, Vermelho"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: formData.color || 'transparent' }} />
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Responsável (Motorista)</label>
          <select 
            value={formData.responsible_employee_id}
            onChange={e => setFormData({...formData, responsible_employee_id: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none bg-white"
          >
            <option value="">Selecione um motorista/operador (Opcional)</option>
            {eligibleEmployees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.role_name || roles.find(r => r.id === emp.role_id)?.name || 'Sem cargo'})
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-gray-400">
            * Somente funcionários com cargo de <strong>Motorista</strong> ou <strong>Operador</strong> são listados (vigias e administradores não aparecem).
          </p>
        </div>
        <div className="md:col-span-2 flex gap-3">
          {editingId && (
            <button 
              type="button" 
              onClick={() => {
                setEditingId(null);
                setFormData({ brand: '', model: '', plate: '', color: '', asset_number: '', responsible_employee_id: '' });
              }}
              className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-xl font-bold hover:bg-gray-200 transition-all"
            >
              Cancelar
            </button>
          )}
          <button type="submit" className="flex-[2] bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all">
            {editingId ? 'Salvar Alterações' : 'Cadastrar Veículo'}
          </button>
        </div>
      </form>

      <div className="pt-8 border-t border-gray-100">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Veículos Cadastrados</h3>
        <div className="grid grid-cols-1 gap-3">
          {vehicles.map(veh => {
            const responsible = employees.find(e => e.id === veh.responsible_employee_id);
            return (
              <div key={veh.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-gray-200 text-purple-600">
                    <Truck size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {veh.brand} {veh.model} - {veh.plate}
                      {veh.color && <span className="ml-2 text-[10px] font-normal px-2 py-0.5 bg-gray-100 rounded-full text-gray-500">{veh.color}</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {veh.asset_number ? `Patrimônio: ${veh.asset_number} • ` : ''}
                      Responsável: {responsible ? `${responsible.name} (${responsible.role_name || roles.find(r => r.id === responsible.role_id)?.name || 'Sem cargo'})` : 'Não definido'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleEdit(veh)}
                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                    title="Editar veículo"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(veh.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Excluir veículo"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
          {vehicles.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm italic">Nenhum veículo cadastrado.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MachineForm({ setNotification, setConfirmAction }: { setNotification: (n: any) => void, setConfirmAction: (action: { message: string, onConfirm: () => void | Promise<void> }) => void }) {
  const [formData, setFormData] = useState({ type: '', brand: '', model: '', asset_number: '', responsible_employee_id: '' });
  const [employees, setEmployees] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const employeesUnsubscribe = onSnapshot(
      query(collection(db, 'employees'), orderBy('name')),
      (snap) => {
        setEmployees(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Employee));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'employees')
    );

    const rolesUnsubscribe = onSnapshot(
      query(collection(db, 'roles'), orderBy('name')),
      (snap) => {
        setRoles(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Role));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'roles')
    );

    const machinesUnsubscribe = onSnapshot(
      query(collection(db, 'machines'), orderBy('type')),
      (snap) => {
        setMachines(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Machine));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'machines')
    );

    return () => {
      employeesUnsubscribe();
      rolesUnsubscribe();
      machinesUnsubscribe();
    };
  }, []);

  // Filter eligible responsibles: only Operadores and Motoristas (strictly excluding Vigias and Admins)
  const eligibleEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (formData.responsible_employee_id && emp.id === formData.responsible_employee_id) {
        return true;
      }
      if (emp.is_watchman || emp.is_admin || emp.role_id === 'admin') {
        return false;
      }
      const roleName = (emp.role_name || roles.find(r => r.id === emp.role_id)?.name || '').toLowerCase();
      if (roleName.includes('vigia') || roleName.includes('admin')) {
        return false;
      }
      return roleName.includes('operador') || roleName.includes('motorista') || roleName.includes('condutor') || roleName.includes('máquina') || roleName.includes('maquina');
    });
  }, [employees, roles, formData.responsible_employee_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const upperAsset = formData.asset_number.toUpperCase();

    // Check for duplicate Asset Number within the same type
    const duplicate = machines.find(mac => 
      mac.type === formData.type && 
      mac.asset_number?.toUpperCase() === upperAsset && 
      mac.id !== editingId
    );
    
    if (upperAsset && duplicate) {
      setNotification({ message: `Este patrimônio já está cadastrado para outra máquina do tipo ${formData.type}.`, type: 'error' });
      return;
    }

    try {
      const data = { ...formData, asset_number: upperAsset };
      if (editingId) {
        await updateDoc(doc(db, 'machines', editingId), data);
        setNotification({ message: 'Máquina atualizada!', type: 'success' });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'machines'), data);
        setNotification({ message: 'Máquina cadastrada!', type: 'success' });
      }
      setFormData({ type: '', brand: '', model: '', asset_number: '', responsible_employee_id: '' });
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, editingId ? `machines/${editingId}` : 'machines');
      setNotification({ message: `Erro ao ${editingId ? 'atualizar' : 'cadastrar'} máquina.`, type: 'error' });
    }
  };

  const handleEdit = (mac: any) => {
    setFormData({
      type: mac.type || '',
      brand: mac.brand || '',
      model: mac.model || '',
      asset_number: mac.asset_number || '',
      responsible_employee_id: mac.responsible_employee_id || ''
    });
    setEditingId(mac.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    setConfirmAction({
      message: 'Tem certeza que deseja excluir esta máquina?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'machines', id));
          setNotification({ message: 'Máquina excluída com sucesso!', type: 'success' });
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `machines/${id}`);
          setNotification({ message: 'Erro ao excluir máquina.', type: 'error' });
        } finally {
          setConfirmAction(null);
        }
      }
    });
  };

  const migrateMachineAssets = async () => {
    let count = 0;
    try {
      const pendingUpdates = machines.filter(mac => {
        const sigla = MACHINE_TYPE_SIGLAS[mac.type];
        if (!sigla) return false;
        const prefix = `${sigla}.`;
        return !mac.asset_number?.toUpperCase().startsWith(prefix);
      });

      if (pendingUpdates.length === 0) {
        setNotification({ message: 'Todas as máquinas já possuem siglas corretas.', type: 'info' });
        return;
      }

      setConfirmAction({
        message: `Deseja atualizar ${pendingUpdates.length} máquinas para incluírem suas siglas (ex: RE.123)?`,
        onConfirm: async () => {
          for (const mac of pendingUpdates) {
            const sigla = MACHINE_TYPE_SIGLAS[mac.type];
            const currentAsset = mac.asset_number || '';
            const newAsset = `${sigla}.${currentAsset}`.toUpperCase();
            await updateDoc(doc(db, 'machines', mac.id), { asset_number: newAsset });
            count++;
          }
          setNotification({ message: `${count} máquinas atualizadas com siglas!`, type: 'success' });
          setConfirmAction(null);
        }
      });
    } catch (err) {
      console.error(err);
      setNotification({ message: 'Erro ao migrar siglas.', type: 'error' });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Gestão de Máquinas</h2>
          <p className="text-xs text-gray-400">Cadastre e gerencie o maquinário da empresa.</p>
        </div>
        <button 
          onClick={migrateMachineAssets}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all border border-blue-100"
        >
          <RefreshCw size={14} />
          Sincronizar Siglas
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Tipo de Máquina</label>
          <select 
            value={formData.type}
            onChange={e => {
              const newType = e.target.value;
              const sigla = MACHINE_TYPE_SIGLAS[newType] || '';
              if (!editingId) {
                setFormData({ ...formData, type: newType, asset_number: sigla ? `${sigla}.` : '' });
              } else {
                setFormData({ ...formData, type: newType });
              }
            }}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none bg-white"
            required
          >
            <option value="">Selecione o tipo</option>
            {MACHINE_TYPES.map(t => (
              <option key={t} value={t}>
                {t} {MACHINE_TYPE_SIGLAS[t] ? `(${MACHINE_TYPE_SIGLAS[t]})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Marca</label>
          <select 
            value={formData.brand}
            onChange={e => setFormData({...formData, brand: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none bg-white"
            required
          >
            <option value="">Selecione a marca</option>
            {MACHINE_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Modelo / Especificação</label>
          <div className="relative">
            <input 
              type="text" 
              value={formData.model}
              onChange={e => setFormData({...formData, model: e.target.value})}
              className="w-full pr-12 pl-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none"
              required
            />
            <Settings className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Patrimônio (Ex: RE.001)</label>
          <div className="relative">
            <input 
              type="text" 
              value={formData.asset_number}
              onChange={e => setFormData({...formData, asset_number: e.target.value.toUpperCase()})}
              className="w-full pr-12 pl-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none font-mono"
              placeholder="SIGLA.000"
            />
            <Hash className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Responsável (Operador)</label>
          <select 
            value={formData.responsible_employee_id}
            onChange={e => setFormData({...formData, responsible_employee_id: e.target.value})}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none bg-white"
          >
            <option value="">Selecione um operador/motorista (Opcional)</option>
            {eligibleEmployees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.role_name || roles.find(r => r.id === emp.role_id)?.name || 'Sem cargo'})
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-gray-400">
            * Somente funcionários com cargo de <strong>Operador</strong> ou <strong>Motorista</strong> são listados (vigias e administradores não aparecem).
          </p>
        </div>
        <div className="md:col-span-2 flex gap-3">
          {editingId && (
            <button 
              type="button" 
              onClick={() => {
                setEditingId(null);
                setFormData({ type: '', brand: '', model: '', asset_number: '', responsible_employee_id: '' });
              }}
              className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-xl font-bold hover:bg-gray-200 transition-all"
            >
              Cancelar
            </button>
          )}
          <button type="submit" className="flex-[2] bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all">
            {editingId ? 'Salvar Alterações' : 'Cadastrar Máquina'}
          </button>
        </div>
      </form>

      <div className="pt-8 border-t border-gray-100">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Máquinas Cadastradas</h3>
        <div className="grid grid-cols-1 gap-3">
          {machines.map(mac => {
            const responsible = employees.find(e => e.id === mac.responsible_employee_id);
            return (
              <div key={mac.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-gray-200 text-orange-600">
                    <Settings size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{mac.type} {mac.brand} {mac.model}</p>
                    <p className="text-xs text-gray-500">
                      {mac.asset_number ? `Patrimônio: ${mac.asset_number} • ` : ''}
                      Responsável: {responsible ? `${responsible.name} (${responsible.role_name || roles.find(r => r.id === responsible.role_id)?.name || 'Sem cargo'})` : 'Não definido'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleEdit(mac)}
                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                    title="Editar máquina"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(mac.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Excluir máquina"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
          {machines.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm italic">Nenhuma máquina cadastrada.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function VisitorAccess() {
  const [visitors, setVisitors] = useState<ServiceProvider[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsubVisitors = onSnapshot(
      query(collection(db, 'third_parties'), orderBy('name')),
      (snap) => {
        setVisitors(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as ServiceProvider));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'third_parties')
    );

    const unsubLogs = onSnapshot(
      query(
        collection(db, 'logs'),
        where('visitor_type', 'in', ['VISITOR', 'SERVICE_PROVIDER']),
        orderBy('timestamp', 'desc'),
        limit(100)
      ),
      (snap) => {
        setLogs(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Log));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'logs')
    );

    return () => {
      unsubVisitors();
      unsubLogs();
    };
  }, []);

  const filteredVisitors = visitors.filter(v => 
    v.name.toLowerCase().includes(search.toLowerCase()) || 
    v.cpf.includes(search) ||
    (v.company && v.company.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Controle de Visitantes</h2>
        <div className="relative w-full md:w-72">
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar visitante..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-black"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Prestadores Cadastrados</h3>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {filteredVisitors.length === 0 ? (
              <p className="p-6 text-center text-gray-400 text-sm italic">Nenhum prestador encontrado.</p>
            ) : (
              filteredVisitors.map(v => (
                <div key={v.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <p className="font-bold text-gray-900">{v.name}</p>
                  <p className="text-xs text-gray-500">CPF: {formatCPF(v.cpf)}</p>
                  {v.company && <p className="text-xs text-gray-500">Empresa: {v.company}</p>}
                  {v.vehicle_plate && <p className="text-xs font-mono text-blue-600 mt-1">{v.vehicle_plate}</p>}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Últimos Acessos de Prestadores</h3>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Data/Hora</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Prestador/Visitante</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Categoria</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Checklist</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Destino</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm italic">Nenhum histórico de prestador.</td>
                    </tr>
                  ) : (
                    logs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold text-gray-900">{log.service_provider_name || log.employee_name}</p>
                          {log.vehicle_plate && <p className="text-[10px] text-blue-600 font-mono">{log.vehicle_plate}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            log.visitor_type === 'VISITOR' 
                              ? 'bg-purple-50 text-purple-700' 
                              : 'bg-orange-50 text-orange-700'
                          }`}>
                            {log.visitor_type === 'VISITOR' ? 'Visitante' : 'Prestador'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            log.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {log.type === 'IN' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {log.has_uniform !== null && (
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${log.has_uniform ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                U: {log.has_uniform ? 'OK' : 'X'}
                              </span>
                            )}
                            {log.has_badge !== null && (
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${log.has_badge ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                C: {log.has_badge ? 'OK' : 'X'}
                              </span>
                            )}
                            {log.has_uniform === null && log.has_badge === null && <span className="text-gray-300">-</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[150px] truncate">
                          {log.destination || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CurrentShiftLogs({ shiftId, title = "Histórico do Turno", setNotification, setConfirmAction, settings }: { shiftId: string, title?: string, setNotification?: (n: any) => void, setConfirmAction?: (action: { message: string, onConfirm: () => void | Promise<void> }) => void, settings?: any }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [shift, setShift] = useState<any>(null);

  useEffect(() => {
    const unsubEmployees = onSnapshot(
      query(collection(db, 'employees'), orderBy('name')),
      (snap) => {
        setEmployees(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Employee));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'employees')
    );

    const unsubVehicles = onSnapshot(
      query(collection(db, 'vehicles'), orderBy('brand')),
      (snap) => {
        setVehicles(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Vehicle));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'vehicles')
    );

    const unsubMachines = onSnapshot(
      query(collection(db, 'machines'), orderBy('type')),
      (snap) => {
        setMachines(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Machine));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'machines')
    );

    const unsubRoles = onSnapshot(
      query(collection(db, 'roles'), orderBy('name')),
      (snap) => {
        setRoles(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Role));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'roles')
    );

    return () => {
      unsubEmployees();
      unsubVehicles();
      unsubMachines();
      unsubRoles();
    };
  }, []);

  useEffect(() => {
    if (!shiftId) return;
    const unsubLogs = onSnapshot(
      query(
        collection(db, 'logs'),
        where('shift_id', '==', shiftId),
        orderBy('timestamp', 'desc')
      ),
      (snap) => {
        setLogs(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Log));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'logs')
    );

    return () => unsubLogs();
  }, [shiftId]);

  useEffect(() => {
    if (!shiftId) return;
    const unsubShift = onSnapshot(
      doc(db, 'shifts', shiftId),
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data() as any;
          if (!data.watchman_name && data.watchman_id) {
            const empSnap = await getDoc(doc(db, 'employees', data.watchman_id));
            if (empSnap.exists()) {
              setShift({ ...data, id: shiftId, watchman_name: (empSnap.data() as any).name });
            } else {
              setShift({ ...data, id: shiftId });
            }
          } else {
            setShift({ ...data, id: shiftId });
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `shifts/${shiftId}`)
    );

    return () => unsubShift();
  }, [shiftId]);

  const fetchShiftLogs = async (sId: string) => {
    const q = query(
      collection(db, 'logs'),
      where('shift_id', '==', sId)
    );
    const snap = await getDocs(q);
    const logsData = snap.docs
      .map(doc => ({ ...doc.data(), id: doc.id }) as Log)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    return await Promise.all(logsData.map(async (log) => {
      let employeeName = '';
      let visitorName = '';
      let serviceProviderName = '';
      let cpf = log.service_provider_cpf || '';
      let role = '-';
      
      if (log.employee_id) {
        const empSnap = await getDoc(doc(db, 'employees', log.employee_id));
        if (empSnap.exists()) {
          const empData = empSnap.data() as any;
          employeeName = empData.name;
          cpf = empData.cpf || '';
          role = empData.role_name || '-';
        }
      } else if (log.visitor_type === 'SERVICE_PROVIDER' || log.service_provider_id) {
        serviceProviderName = log.service_provider_name || log.employee_name || '';
      } else if (log.machine_id || log.machine_type) {
        visitorName = log.machine_type || 'Máquina';
      } else if (log.vehicle_id || log.vehicle_plate) {
        visitorName = log.vehicle_plate || 'Veículo';
      } else if (log.visitor_type === 'VISITOR' || (!log.employee_id && !log.service_provider_id)) {
        visitorName = log.employee_name || 'Visitante';
      }

      let vehicleInfo = '-';
      if (log.vehicle_id) {
        const vehSnap = await getDoc(doc(db, 'vehicles', log.vehicle_id));
        if (vehSnap.exists()) {
          const vehData = vehSnap.data() as any;
          vehicleInfo = `${vehData.brand} ${vehData.model || ''} (${vehData.plate || ''})`;
        } else if (log.vehicle_plate) vehicleInfo = log.vehicle_plate;
      } else if (log.vehicle_plate) {
        vehicleInfo = log.vehicle_plate;
      }

      let machineInfo = '-';
      if (log.machine_id) {
        const macSnap = await getDoc(doc(db, 'machines', log.machine_id));
        if (macSnap.exists()) {
          const macData = macSnap.data() as any;
          machineInfo = `${macData.type} ${macData.brand} (${macData.asset_number || ''})`;
        } else if (log.machine_type) machineInfo = log.machine_type;
      } else if (log.machine_type) {
        machineInfo = log.machine_type;
      }

      return { 
        ...log, 
        employeeName, 
        visitorName, 
        serviceProviderName, 
        cpf,
        role,
        visitorType: log.visitor_type === 'VISITOR' ? 'Visitante' : log.visitor_type === 'SERVICE_PROVIDER' ? 'Prestador' : log.employee_id ? 'Funcionário' : '-',
        vehicleInfo, 
        machineInfo 
      };
    }));
  };

  const handleGeneratePDF = async () => {
    if (!shift || !settings) return;
    try {
      const logsData = await fetchShiftLogs(shiftId);
      const groupedVisits = groupLogsIntoVisits(logsData);
      const docPDF = new jsPDF('l', 'mm', 'a4');
      const companyName = settings.company_name || 'VigiaControl';
      const clientName = settings.client_company_name ? ` - ${settings.client_company_name}` : '';
      
      docPDF.setFontSize(16);
      docPDF.text(`Relatório de Turno: ${companyName}${clientName}`, 14, 15);
      
      docPDF.setFontSize(10);
      docPDF.text(`Vigia: ${shift.watchman_name || 'N/A'}`, 14, 22);
      docPDF.text(`Início: ${new Date(shift.start_time).toLocaleString('pt-BR')}`, 14, 27);
      if (shift.end_time) {
        docPDF.text(`Fim: ${new Date(shift.end_time).toLocaleString('pt-BR')}`, 14, 32);
      } else {
        docPDF.text(`Fim: Turno em andamento`, 14, 32);
      }

      const tableData = groupedVisits.map(v => [
        v.name,
        v.cpf,
        v.role,
        v.date,
        `E: ${v.entryTime} | S: ${v.exitTime}`,
        v.machine,
        v.vehicle,
        v.km,
        v.horometer,
        v.checklist,
        v.category,
        v.destination
      ]);

      autoTable(docPDF, {
        head: [['Nome', 'CPF', 'Cargo', 'Data', 'Horários', 'Máquina', 'Veículo', 'KM', 'Hor.', 'Checklist', 'Categoria', 'Destino']],
        body: tableData,
        startY: 40,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
        styles: { fontSize: 8 }
      });

      // Add Photos Section
      const photos = groupedVisits.filter(v => v.photo);
      if (photos.length > 0) {
        docPDF.addPage();
        docPDF.setFontSize(16);
        docPDF.text('Anexo: Fotos de Veículos e Acessos', 14, 15);
        
        let yPos = 25;
        photos.forEach((p, idx) => {
          if (yPos > 240) {
            docPDF.addPage();
            yPos = 25;
          }
          
          docPDF.setFontSize(10);
          docPDF.setFont('helvetica', 'bold');
          docPDF.text(`${idx + 1}. ${p.name} - ${p.date} (${p.entryTime !== '-' ? `Entrada: ${p.entryTime}` : `Saída: ${p.exitTime}`})`, 14, yPos);
          docPDF.setFont('helvetica', 'normal');
          docPDF.text(`Veículo/Máquina: ${p.vehicle !== '-' ? p.vehicle : p.machine}`, 14, yPos + 5);
          
          try {
            docPDF.addImage(p.photo, 'JPEG', 14, yPos + 8, 80, 60);
            yPos += 75;
          } catch (e) {
            docPDF.text('[Erro ao carregar imagem]', 14, yPos + 10);
            yPos += 20;
          }
        });
      }

      docPDF.save(`Relatorio_Turno_${shiftId}.pdf`);
      if (setNotification) setNotification({ message: 'PDF gerado com sucesso!', type: 'success' });
    } catch (err) {
      console.error("Error generating PDF:", err);
      if (setNotification) setNotification({ message: 'Erro ao gerar PDF.', type: 'error' });
    }
  };

  const handleSendWhatsApp = async () => {
    if (!shift || !settings || !settings.report_whatsapp) return;
    try {
      const logsData = await fetchShiftLogs(shiftId);
      const groupedVisits = groupLogsIntoVisits(logsData);
      const shiftDate = new Date(shift.start_time).toLocaleDateString('pt-BR');
      const startTime = new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const endTime = shift.end_time ? new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Em andamento';

      let message = `*RELATÓRIO DE TURNO - ${shiftDate}*\n`;
      message += `*Início:* ${startTime}\n`;
      message += `*Fim:* ${endTime}\n\n`;
      message += `*REGISTROS:*\n`;

      groupedVisits.forEach((v, index) => {
        message += `${index + 1}. [E: ${v.entryTime} | S: ${v.exitTime}] ${v.name} (${v.role}) - ${v.vehicle !== '-' ? v.vehicle : v.machine}\n`;
      });

      const whatsappUrl = `https://wa.me/${settings.report_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      if (setNotification) setNotification({ message: 'WhatsApp aberto com sucesso!', type: 'success' });
    } catch (err) {
      console.error("Error sending WhatsApp:", err);
      if (setNotification) setNotification({ message: 'Erro ao enviar WhatsApp.', type: 'error' });
    }
  };

  const handleStartEdit = (log: Log) => {
    setEditingLogId(log.id);
    const date = new Date(log.timestamp);
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - offset).toISOString().slice(0, 16);
    setEditTime(localISOTime);
  };

  const handleUpdateLogTime = async (logId: string) => {
    if (!editTime) {
      if (setNotification) setNotification({ message: 'Selecione um horário válido.', type: 'error' });
      return;
    }
    try {
      const timestamp = new Date(editTime).toISOString();
      await updateDoc(doc(db, 'logs', logId), { timestamp });
      setEditingLogId(null);
      if (setNotification) setNotification({ message: 'Horário do registro atualizado!', type: 'success' });
    } catch (err) {
      console.error("Error updating log time:", err);
      if (setNotification) setNotification({ message: 'Erro ao atualizar horário.', type: 'error' });
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!setConfirmAction) return;
    setConfirmAction({
      message: 'Deseja realmente excluir este registro?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'logs', logId));
          if (setNotification) setNotification({ message: 'Registro excluído com sucesso.', type: 'success' });
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `logs/${logId}`);
          if (setNotification) setNotification({ message: 'Erro ao excluir registro. Verifique as permissões.', type: 'error' });
        } finally {
          setConfirmAction(null);
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {title && <h2 className="text-2xl font-bold text-gray-900">{title}</h2>}
        <div className="flex items-center gap-2">
          <button 
            onClick={handleGeneratePDF}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-700 transition-all shadow-sm"
            title="Gerar PDF"
          >
            <Download size={16} />
            PDF
          </button>
          {settings?.report_whatsapp && (
            <button 
              onClick={handleSendWhatsApp}
              className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-600 transition-all shadow-sm"
              title="Enviar via WhatsApp"
            >
              <MessageCircle size={16} />
              WhatsApp
            </button>
          )}
        </div>
      </div>
      
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">CPF</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Cargo</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Horários</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Máquina</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Veículo</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">KM</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Hor.</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Foto</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Checklist</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Categoria</th>
                <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Destino</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-400 italic">Nenhum registro neste turno.</td>
                </tr>
              ) : (
                (() => {
                  const enrichedLogs = logs.map(log => {
                    const emp = employees.find(e => e.id === log.employee_id);
                    const veh = vehicles.find(v => v.id === log.vehicle_id);
                    const mac = machines.find(m => m.id === log.machine_id);

                    const employeeName = log.employee_name && log.employee_name !== 'N/A' 
                      ? log.employee_name 
                      : (log.service_provider_name || emp?.name || (log.machine_type ? log.machine_type : (log.vehicle_plate ? log.vehicle_plate : 'N/A')));
                    const vehiclePlate = log.vehicle_plate || veh?.plate || '';
                    const vehicleAsset = log.vehicle_asset || veh?.asset_number || '';
                    const machineType = log.machine_type || mac?.type || '';
                    const machineAsset = log.machine_asset || mac?.asset_number || '';

                    return {
                      ...log,
                      employeeName,
                      cpf: emp?.cpf || log.service_provider_cpf || '-',
                      role: emp?.role_name || '-',
                      vehicleInfo: vehiclePlate ? `${vehiclePlate} ${vehicleAsset ? `(${vehicleAsset})` : ''}` : '-',
                      machineInfo: machineType ? `${machineType} ${machineAsset ? `(${machineAsset})` : ''}` : '-',
                      visitorType: log.employee_id ? 'Funcionário' : log.visitor_type === 'VISITOR' ? 'Visitante' : log.visitor_type === 'SERVICE_PROVIDER' ? 'Prestador' : '-'
                    };
                  });

                  const groupedVisits = groupLogsIntoVisits(enrichedLogs);

                  return groupedVisits.map(visit => (
                    <tr key={visit.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{visit.name}</td>
                      <td className="px-6 py-4 text-[10px] font-mono text-gray-500">{visit.cpf}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">{visit.role}</td>
                      <td className="px-6 py-4 text-xs font-mono text-gray-500">{visit.date}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <div className="flex items-center gap-1.5 group/time">
                            <span className="text-[10px] font-bold text-gray-400">E:</span>
                            <span className="text-sm font-mono text-gray-900">{visit.entryTime}</span>
                            {visit.inLog && (
                              <div className="flex gap-0.5 opacity-100 lg:opacity-0 lg:group-hover/time:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => handleStartEdit(visit.inLog)}
                                  className="p-0.5 text-blue-600 hover:bg-blue-50 rounded"
                                  title="Editar Entrada"
                                >
                                  <Edit2 size={10} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteLog(visit.inLog.id)}
                                  className="p-0.5 text-red-600 hover:bg-red-50 rounded"
                                  title="Excluir Entrada"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            )}
                            {editingLogId === visit.inLog?.id && (
                              <div className="absolute z-10 mt-8 bg-white p-2 shadow-xl border border-gray-200 rounded-lg flex items-center gap-1">
                                <input 
                                  type="datetime-local" 
                                  value={editTime}
                                  onChange={(e) => setEditTime(e.target.value)}
                                  className="text-[10px] px-1 py-0.5 rounded border border-gray-300 outline-none font-mono"
                                />
                                <button onClick={() => handleUpdateLogTime(visit.inLog.id)} className="text-emerald-600"><Check size={14}/></button>
                                <button onClick={() => setEditingLogId(null)} className="text-gray-400"><X size={14}/></button>
                              </div>
                            )}
                          </div>

                          <span className="text-gray-300">|</span>

                          <div className="flex items-center gap-1.5 group/time">
                            <span className="text-[10px] font-bold text-gray-400">S:</span>
                            <span className="text-sm font-mono text-gray-900">{visit.exitTime}</span>
                            {visit.outLog && (
                              <div className="flex gap-0.5 opacity-100 lg:opacity-0 lg:group-hover/time:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => handleStartEdit(visit.outLog)}
                                  className="p-0.5 text-blue-600 hover:bg-blue-50 rounded"
                                  title="Editar Saída"
                                >
                                  <Edit2 size={10} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteLog(visit.outLog.id)}
                                  className="p-0.5 text-red-600 hover:bg-red-50 rounded"
                                  title="Excluir Saída"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            )}
                            {editingLogId === visit.outLog?.id && (
                              <div className="absolute z-10 mt-8 bg-white p-2 shadow-xl border border-gray-200 rounded-lg flex items-center gap-1">
                                <input 
                                  type="datetime-local" 
                                  value={editTime}
                                  onChange={(e) => setEditTime(e.target.value)}
                                  className="text-[10px] px-1 py-0.5 rounded border border-gray-300 outline-none font-mono"
                                />
                                <button onClick={() => handleUpdateLogTime(visit.outLog.id)} className="text-emerald-600"><Check size={14}/></button>
                                <button onClick={() => setEditingLogId(null)} className="text-gray-400"><X size={14}/></button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{visit.machine}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{visit.vehicle}</td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-500">{visit.km}</td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-500">{visit.horometer}</td>
                      <td className="px-6 py-4">
                        {visit.photo ? (
                          <div className="relative group/photo cursor-pointer" onClick={() => window.open(visit.photo, '_blank')}>
                            <img 
                              src={visit.photo} 
                              alt="Foto do veículo" 
                              className="w-10 h-10 object-cover rounded-lg border border-gray-200 shadow-sm transition-transform hover:scale-110" 
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                              <Camera size={12} className="text-white" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {(visit.inLog || visit.outLog)?.has_uniform !== null ? (
                          <div className="flex flex-col gap-0.5 text-[9px] font-bold uppercase">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400">U:</span>
                              <span className={(visit.inLog || visit.outLog)?.has_uniform ? "text-emerald-600" : "text-red-600"}>
                                {(visit.inLog || visit.outLog)?.has_uniform ? "SIM" : "NÃO"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400">C:</span>
                              <span className={(visit.inLog || visit.outLog)?.has_badge ? "text-emerald-600" : "text-red-600"}>
                                {(visit.inLog || visit.outLog)?.has_badge ? "SIM" : "NÃO"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-gray-100 text-gray-600 border border-gray-200">
                          {visit.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-[120px]">{visit.destination}</td>
                    </tr>
                  ));
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GlobalShiftHistory({ setNotification, settings, setConfirmAction }: { setNotification: (n: any) => void, settings: any, setConfirmAction: (action: { message: string, onConfirm: () => void | Promise<void> }) => void }) {
  const [shifts, setShifts] = useState<any[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [searchDate, setSearchDate] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');

  useEffect(() => {
    const employeesUnsubscribe = onSnapshot(
      query(collection(db, 'employees'), orderBy('name')),
      (snap) => {
        setEmployees(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Employee));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'employees')
    );

    const shiftsUnsubscribe = onSnapshot(
      query(
        collection(db, 'shifts'),
        orderBy('start_time', 'desc'),
        limit(100)
      ),
      (snap) => {
        setShifts(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as any));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'shifts')
    );

    return () => {
      employeesUnsubscribe();
      shiftsUnsubscribe();
    };
  }, []);

  const handleStartEditShift = (shift: any) => {
    setEditingShiftId(shift.id);
    
    const startDate = new Date(shift.start_time);
    const startOffset = startDate.getTimezoneOffset() * 60000;
    setEditStartTime(new Date(startDate.getTime() - startOffset).toISOString().slice(0, 16));

    const endDate = new Date(shift.end_time);
    const endOffset = endDate.getTimezoneOffset() * 60000;
    setEditEndTime(new Date(endDate.getTime() - endOffset).toISOString().slice(0, 16));
  };

  const handleUpdateShiftTimes = async (shiftId: string) => {
    try {
      const start_time = new Date(editStartTime).toISOString();
      const end_time = new Date(editEndTime).toISOString();
      await updateDoc(doc(db, 'shifts', shiftId), { start_time, end_time });
      setEditingShiftId(null);
      setNotification({ message: 'Horários do turno atualizados!', type: 'success' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shifts/${shiftId}`);
      setNotification({ message: 'Erro ao atualizar horários do turno.', type: 'error' });
    }
  };

  const handleDeleteShift = async (e: React.MouseEvent, shiftId: string) => {
    e.stopPropagation();
    setConfirmAction({
      message: 'AVISO CRÍTICO: Esta ação excluirá permanentemente este turno e TODOS os registros de entrada/saída associados a ele. Deseja continuar?',
      onConfirm: async () => {
        try {
          // 1. Delete all logs associated with this shift
          const logsQuery = query(collection(db, 'logs'), where('shift_id', '==', shiftId));
          const logsSnap = await getDocs(logsQuery);
          const deletePromises = logsSnap.docs.map(logDoc => {
            return deleteDoc(doc(db, 'logs', logDoc.id));
          });
          await Promise.all(deletePromises);

          // 2. Delete the shift itself
          await deleteDoc(doc(db, 'shifts', shiftId));
          
          if (selectedShiftId === shiftId) setSelectedShiftId(null);
          setNotification({ message: 'Turno e registros excluídos com sucesso.', type: 'success' });
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `shifts/${shiftId}`);
          setNotification({ message: 'Erro ao excluir turno. Verifique as permissões.', type: 'error' });
        } finally {
          setConfirmAction(null);
        }
      }
    });
  };

  const handleSendWhatsApp = async (shiftId: string) => {
    try {
      const logsData = await fetchShiftLogs(shiftId);
      const groupedVisits = groupLogsIntoVisits(logsData);
      const shift = shifts.find(s => s.id === shiftId);
      if (!shift) return;

      const whatsappNumber = settings.report_whatsapp.replace(/\D/g, '');
      const companyName = settings.company_name || 'VigiaControl';
      const clientName = settings.client_company_name ? ` - ${settings.client_company_name}` : '';
      
      let message = `*RELATÓRIO DE TURNO - ${companyName}${clientName}*\n\n`;
      message += `*Vigia:* ${shift.watchman_name || 'N/A'}\n`;
      message += `*Início:* ${new Date(shift.start_time).toLocaleString('pt-BR')}\n`;
      message += `*Fim:* ${new Date(shift.end_time).toLocaleString('pt-BR')}\n\n`;
      message += `*REGISTROS:*\n`;
      
      groupedVisits.forEach((v, index) => {
        message += `\n${index + 1}. [${v.entryTime} | ${v.exitTime}] ${v.name}\n`;
        if (v.vehicle !== '-') message += `   Veículo: ${v.vehicle}\n`;
        if (v.machine !== '-') message += `   Máquina: ${v.machine}\n`;
        if (v.km !== '-') message += `   KM: ${v.km}\n`;
        if (v.horometer !== '-') message += `   Horímetro: ${v.horometer}\n`;
        if (v.destination !== '-') message += `   Destino: ${v.destination}\n`;
      });

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
      window.open(whatsappUrl, '_blank');
      setNotification({ message: 'WhatsApp aberto com o relatório.', type: 'success' });
    } catch (err) {
      console.error("Error sending WhatsApp:", err);
      setNotification({ message: 'Erro ao gerar relatório para WhatsApp.', type: 'error' });
    }
  };

  const fetchShiftLogs = async (shiftId: string) => {
    const q = query(
      collection(db, 'logs'),
      where('shift_id', '==', shiftId),
      orderBy('timestamp', 'asc')
    );
    const logsSnap = await getDocs(q);
    
    return await Promise.all(logsSnap.docs.map(async (logDoc) => {
      const log = logDoc.data() as Log;
      let employeeName = '';
      let visitorName = '';
      let serviceProviderName = '';
      let cpf = log.service_provider_cpf || '';
      
      if (log.employee_id) {
        const empDoc = await getDoc(doc(db, 'employees', log.employee_id));
        if (empDoc.exists()) {
          employeeName = empDoc.data().name;
          cpf = empDoc.data().cpf || '';
        }
      } else if (log.visitor_type === 'SERVICE_PROVIDER' || log.service_provider_id) {
        serviceProviderName = log.service_provider_name || log.employee_name || '';
      } else if (log.visitor_type === 'VISITOR' || (!log.employee_id && !log.service_provider_id)) {
        visitorName = log.employee_name || 'Visitante';
      }

      let vehicleInfo = '-';
      if (log.vehicle_id) {
        const vehDoc = await getDoc(doc(db, 'vehicles', log.vehicle_id));
        if (vehDoc.exists()) vehicleInfo = `${vehDoc.data().brand} ${vehDoc.data().model || ''} (${vehDoc.data().plate || ''})`;
        else if (log.vehicle_plate) vehicleInfo = log.vehicle_plate;
      } else if (log.vehicle_plate) {
        vehicleInfo = log.vehicle_plate;
      }

      let machineInfo = '-';
      if (log.machine_id) {
        const macDoc = await getDoc(doc(db, 'machines', log.machine_id));
        if (macDoc.exists()) machineInfo = `${macDoc.data().type} ${macDoc.data().brand} (${macDoc.data().asset_number || ''})`;
        else if (log.machine_type) machineInfo = log.machine_type;
      } else if (log.machine_type) {
        machineInfo = log.machine_type;
      }

      return { 
        ...log, 
        employeeName, 
        visitorName, 
        serviceProviderName, 
        cpf,
        visitorType: log.visitor_type === 'VISITOR' ? 'Visitante' : log.visitor_type === 'SERVICE_PROVIDER' ? 'Prestador' : log.employee_id ? 'Funcionário' : '-',
        vehicleInfo, 
        machineInfo 
      };
    }));
  };

  const handleGeneratePDF = async (shiftId: string) => {
    try {
      const logsData = await fetchShiftLogs(shiftId);
      const groupedVisits = groupLogsIntoVisits(logsData);
      const shift = shifts.find(s => s.id === shiftId);
      if (!shift) return;

      const doc = new jsPDF('l', 'mm', 'a4');
      const companyName = settings.company_name || 'VigiaControl';
      const clientName = settings.client_company_name ? ` - ${settings.client_company_name}` : '';
      
      doc.setFontSize(16);
      doc.text(`Relatório de Turno: ${companyName}${clientName}`, 14, 15);
      
      doc.setFontSize(10);
      doc.text(`Vigia: ${shift.watchman_name || 'N/A'}`, 14, 22);
      doc.text(`Início: ${new Date(shift.start_time).toLocaleString('pt-BR')}`, 14, 27);
      doc.text(`Fim: ${new Date(shift.end_time).toLocaleString('pt-BR')}`, 14, 32);

      const tableData = groupedVisits.map(v => [
        v.name,
        v.cpf,
        v.date,
        v.entryTime,
        v.exitTime,
        v.machine,
        v.vehicle,
        v.km,
        v.horometer,
        v.checklist,
        v.category,
        v.destination
      ]);

      autoTable(doc, {
        head: [['Nome', 'CPF', 'Data', 'Entrada', 'Saída', 'Máquina', 'Veículo', 'KM', 'Hor.', 'Checklist', 'Categoria', 'Destino']],
        body: tableData,
        startY: 40,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
        styles: { fontSize: 8 }
      });

      doc.save(`Relatorio_Turno_${shiftId}.pdf`);
      setNotification({ message: 'PDF gerado com sucesso!', type: 'success' });
    } catch (err) {
      console.error("Error generating PDF:", err);
      setNotification({ message: 'Erro ao gerar PDF.', type: 'error' });
    }
  };

  const filteredShifts = searchDate 
    ? shifts.filter(s => s.start_time?.startsWith(searchDate) || s.end_time?.startsWith(searchDate))
    : shifts;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Histórico Geral de Turnos</h2>
        <div className="relative">
          <input 
            type="date" 
            value={searchDate}
            onChange={(e) => setSearchDate(e.target.value)}
            className="pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black outline-none bg-white text-sm"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Turnos Encerrados</h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {filteredShifts.length === 0 ? (
              <p className="text-sm text-gray-400 italic p-4 bg-white rounded-2xl border border-gray-100">Nenhum turno encontrado.</p>
            ) : (
              filteredShifts.map(shift => {
                const watchman = employees.find(e => e.id === shift.watchman_id);
                const isActive = selectedShiftId === shift.id;
                const isEditing = editingShiftId === shift.id;

                return (
                  <div
                    key={shift.id}
                    onClick={() => !isEditing && setSelectedShiftId(shift.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all relative group ${
                      isActive 
                        ? 'bg-black border-black text-white shadow-lg shadow-black/10' 
                        : 'bg-white border-gray-100 text-gray-900 hover:border-gray-300'
                    } ${isEditing ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className={`text-sm font-bold ${isActive ? 'text-white' : 'text-gray-900'}`}>{watchman?.name || shift.watchman_name || 'Vigia Desconhecido'}</p>
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleUpdateShiftTimes(shift.id); }}
                              className="p-1.5 text-emerald-400 hover:bg-white/10 rounded-lg transition-colors"
                              title="Salvar"
                            >
                              <Check size={14} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingShiftId(null); }}
                              className="p-1.5 text-white/40 hover:bg-white/10 rounded-lg transition-colors"
                              title="Cancelar"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleStartEditShift(shift); }}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isActive ? 'text-white hover:text-blue-400 hover:bg-white/10' : 'text-blue-600 hover:bg-blue-50'
                              }`}
                              title="Editar Horários"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={(e) => handleDeleteShift(e, shift.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isActive ? 'text-white hover:text-red-400 hover:bg-white/10' : 'text-red-600 hover:bg-red-50'
                              }`}
                              title="Excluir Turno"
                            >
                              <Trash2 size={14} />
                            </button>
                            <ChevronRight size={16} className={isActive ? 'text-white/50' : 'text-gray-300'} />
                          </>
                        )}
                      </div>
                    </div>
                    
                    {isEditing ? (
                      <div className="space-y-2 mt-2" onClick={e => e.stopPropagation()}>
                        <div>
                          <label className="block text-[8px] uppercase font-bold text-white/50">Início</label>
                          <input 
                            type="datetime-local" 
                            value={editStartTime}
                            onChange={(e) => setEditStartTime(e.target.value)}
                            className="w-full text-[10px] bg-white/10 border border-white/20 rounded px-1 py-0.5 text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] uppercase font-bold text-white/50">Fim</label>
                          <input 
                            type="datetime-local" 
                            value={editEndTime}
                            onChange={(e) => setEditEndTime(e.target.value)}
                            className="w-full text-[10px] bg-white/10 border border-white/20 rounded px-1 py-0.5 text-white outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[10px] font-medium opacity-70">
                        <Calendar size={10} />
                        <span>{new Date(shift.start_time).toLocaleDateString('pt-BR')}</span>
                        <Clock size={10} className="ml-1" />
                        <span>
                          {new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                          {shift.status === 'ACTIVE' ? (
                            <span className="text-emerald-400 font-bold ml-1">EM ANDAMENTO</span>
                          ) : (
                            shift.end_time ? new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '?'
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedShiftId ? (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden h-fit">
              <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-900">Registros do Turno</h3>
                  <p className="text-xs text-gray-500 mt-1">ID: {selectedShiftId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleGeneratePDF(selectedShiftId)}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-700 transition-all shadow-sm"
                    title="Gerar PDF"
                  >
                    <Download size={16} />
                    PDF
                  </button>
                  {settings.report_whatsapp && (
                    <button 
                      onClick={() => handleSendWhatsApp(selectedShiftId)}
                      className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all shadow-sm"
                    >
                      <MessageCircle size={16} />
                      WhatsApp
                    </button>
                  )}
                </div>
              </div>
              <div className="p-0">
                <CurrentShiftLogs 
                  shiftId={selectedShiftId} 
                  title="" 
                  setNotification={setNotification} 
                  settings={settings}
                  setConfirmAction={setConfirmAction}
                />
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center h-full flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-2xl flex items-center justify-center mb-4">
                <ClipboardList size={32} />
              </div>
              <p className="text-gray-400 font-medium">Selecione um turno ao lado para ver os detalhes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OverdueShiftsAlert({ shifts, onClose, onReview }: { shifts: any[], onClose: () => void, onReview: (shiftId: string) => void }) {
  if (shifts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-red-100"
      >
        <div className="p-6 bg-red-50 border-b border-red-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600">
            <AlertCircle size={28} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-900">Turnos em Aberto (+24h)</h3>
            <p className="text-sm text-red-700">Existem turnos que não foram encerrados corretamente.</p>
          </div>
        </div>
        
        <div className="p-6 space-y-4 max-h-[40vh] overflow-y-auto">
          {shifts.map(shift => (
            <div key={shift.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-gray-900">Iniciado em:</p>
                <p className="text-xs text-gray-500">
                  {new Date(shift.start_time).toLocaleString('pt-BR')}
                </p>
              </div>
              <button 
                onClick={() => onReview(shift.id)}
                className="px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition-all"
              >
                Revisar
              </button>
            </div>
          ))}
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 transition-all"
          >
            Ignorar por enquanto
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default App;
