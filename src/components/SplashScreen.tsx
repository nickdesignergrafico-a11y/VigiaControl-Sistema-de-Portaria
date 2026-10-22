import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Shield, ChevronRight, Lock } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number; // duration in ms, default 6000 (6 seconds)
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  duration = 6000
}) => {
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(Math.ceil(duration / 1000));

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const startTimeRef = useRef<number>(Date.now());
  const completedRef = useRef(false);

  useEffect(() => {
    // Keep reference to timer
    const interval = setInterval(() => {
      if (completedRef.current) {
        clearInterval(interval);
        return;
      }

      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, (elapsed / duration) * 100);
      const remainingSeconds = Math.max(0, Math.ceil((duration - elapsed) / 1000));
      
      setProgress(pct);
      setTimeLeft(remainingSeconds);

      if (elapsed >= duration) {
        completedRef.current = true;
        clearInterval(interval);
        setProgress(100);
        setTimeLeft(0);
        onCompleteRef.current();
      }
    }, 40);

    return () => clearInterval(interval);
  }, [duration]);

  const handleSkip = () => {
    if (!completedRef.current) {
      completedRef.current = true;
      setProgress(100);
      setTimeLeft(0);
      onCompleteRef.current();
    }
  };

  // Dynamic system status message during the 6 seconds
  const getStatusMessage = () => {
    if (progress < 25) return 'Iniciando sistema de segurança...';
    if (progress < 50) return 'Carregando banco de dados e credenciais...';
    if (progress < 75) return 'Verificando permissões e registros...';
    if (progress < 95) return 'Sincronizando ambiente de portaria...';
    return 'Acesso pronto! Abrindo...';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      className="fixed inset-0 z-[999999] flex flex-col justify-between items-center bg-[#0B0F17] text-white px-6 py-8 select-none overflow-hidden"
    >
      {/* Background radial effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[90px]" />
        {/* Subtle dot matrix grid */}
        <div 
          className="absolute inset-0 opacity-[0.04]" 
          style={{ 
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', 
            backgroundSize: '24px 24px' 
          }} 
        />
      </div>

      {/* Top Header / Skip Button */}
      <div className="w-full max-w-md flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-gray-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
          <img src="/icon.png" alt="Ícone" className="w-4 h-4 object-contain rounded-xs" />
          <span>Vigia Control</span>
        </div>

        <button
          onClick={handleSkip}
          className="text-xs font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1 active:scale-95 cursor-pointer backdrop-blur-md"
          title="Pular apresentação"
        >
          <span>Pular</span>
          <span className="text-[10px] text-gray-400 font-mono">({timeLeft}s)</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Center: Main Logo and Presentation */}
      <div className="flex flex-col items-center justify-center text-center relative z-10 max-w-sm my-auto">
        {/* Logo Card with Glow */}
        <div className="relative mb-8">
          {/* Animated Glow Halo */}
          <motion.div
            animate={{
              scale: [1, 1.08, 1],
              opacity: [0.35, 0.6, 0.35]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            className="absolute -inset-2 bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 rounded-3xl blur-xl"
          />

          {/* Logo Frame */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-3xl bg-[#141A26] border border-white/15 p-4 shadow-2xl flex items-center justify-center overflow-hidden"
          >
            <img
              src="/logo.png"
              alt="Logo Vigia Control"
              className="w-full h-full object-contain filter drop-shadow-md select-none"
              onError={(e) => {
                // Fallback to icon.png if logo.png fails
                const target = e.target as HTMLImageElement;
                if (!target.src.includes('icon.png')) {
                  target.src = '/icon.png';
                }
              }}
            />
          </motion.div>
        </div>

        {/* Title & Tagline */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="space-y-2"
        >
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            <span>Vigia Control</span>
          </h1>
          <p className="text-xs sm:text-sm font-medium text-gray-400 tracking-wide">
            Controle de Portaria & Gestão de Acessos
          </p>
        </motion.div>
      </div>

      {/* Bottom: Progress Bar & Timer */}
      <div className="w-full max-w-md flex flex-col items-center gap-3 relative z-10 pb-2">
        {/* Status text */}
        <div className="flex items-center justify-between w-full px-1 text-xs text-gray-400">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            {getStatusMessage()}
          </span>
          <span className="font-mono font-semibold text-gray-400">{Math.round(progress)}%</span>
        </div>

        {/* Progress Track */}
        <div className="w-full h-2 bg-gray-800/80 rounded-full overflow-hidden p-0.5 border border-white/10 backdrop-blur-sm">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ ease: 'linear' }}
          />
        </div>

        {/* Security watermark footer */}
        <div className="flex items-center justify-between w-full text-[11px] text-gray-400 px-1 pt-1">
          <span className="flex items-center gap-1">
            <Lock size={11} className="text-emerald-400" /> Sistema Protegido
          </span>
          <span className="font-mono">Carregando (6s)</span>
        </div>
      </div>
    </motion.div>
  );
};

export default SplashScreen;
