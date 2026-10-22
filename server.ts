import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  setDoc,
  addDoc,
  deleteDoc,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  increment
} from 'firebase/firestore';

let currentFilename = "";
let currentDirname = "";
try {
  currentFilename = fileURLToPath(import.meta.url);
  currentDirname = path.dirname(currentFilename);
} catch (e) {
  currentFilename = typeof __filename !== "undefined" ? __filename : "";
  currentDirname = typeof __dirname !== "undefined" ? __dirname : "";
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // Initialize Firebase
  let firestore: any = null;
  let isFirestoreHealthy = false;
  let firestoreStatusMessage = '';

  const initFirestore = () => {
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (existsSync(configPath)) {
        const firebaseConfig = JSON.parse(readFileSync(configPath, 'utf8'));
        const firebaseApp = initializeApp(firebaseConfig);
        firestore = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)')
          ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
          : getFirestore(firebaseApp);
        
        // Asynchronously check connectivity without throwing unhandled gRPC streams
        setTimeout(async () => {
          try {
            if (firestore) {
              const testDoc = await getDoc(doc(firestore, 'settings', 'global'));
              isFirestoreHealthy = true;
              firestoreStatusMessage = 'Conectado ao Cloud Firestore com sucesso';
              console.log("Firebase Firestore connected and verified healthy.");
            }
          } catch (e: any) {
            isFirestoreHealthy = false;
            if (e.message?.includes('PERMISSION_DENIED') || e.message?.includes('not been used') || e.code === 'permission-denied') {
              firestoreStatusMessage = `Cloud Firestore não está ativo ou com API desabilitada no projeto ${firebaseConfig.projectId}. O sistema está operando em Armazenamento Local Seguro.`;
              console.warn(`[Modo Seguro] ${firestoreStatusMessage}`);
            } else {
              firestoreStatusMessage = `Operando em Armazenamento Local: ${e.message}`;
            }
          }
        }, 1000);
      } else {
        console.warn("firebase-applet-config.json not found. Operating with local storage.");
      }
    } catch (err: any) {
      isFirestoreHealthy = false;
      console.warn("Firebase initialization skipped:", err.message);
    }
  };

  initFirestore();

  const isFirestoreActive = () => {
    return !!(firestore && isFirestoreHealthy);
  };

  // Seed initial data in Firestore if needed
  const seedFirestore = async () => {
    // Initialize local store defaults
    initLocalStoreDefaults();

    if (!isFirestoreActive()) return;
    try {
      // 1. Seed Roles
      const rolesRef = collection(firestore, 'roles');
      const rolesSnap = await getDocs(rolesRef).catch(() => null);
      if (rolesSnap && rolesSnap.empty) {
        const initialRoles = ["Vigia", "Motorista", "Operador", "Administrativo", "Encarregado", "Gerente", "Engenheiro"];
        for (const role of initialRoles) {
          await addDoc(rolesRef, { name: role }).catch(() => {});
        }
      }

      // 2. Seed Settings
      const settingsRef = doc(firestore, 'settings', 'global');
      const settingsSnap = await getDoc(settingsRef).catch(() => null);
      if (settingsSnap && !settingsSnap.exists()) {
        await setDoc(settingsRef, {
          company_name: "VigiaControl",
          company_logo: "",
          report_email: "",
          report_whatsapp: "",
          smtp_host: "",
          smtp_port: "587",
          smtp_user: "",
          smtp_pass: ""
        }).catch(() => {});
      }

      // 3. Seed Default Watchman
      const empRef = collection(firestore, 'employees');
      const watchmanQuery = query(empRef, where('is_watchman', '==', true), limit(1));
      const watchmanSnap = await getDocs(watchmanQuery).catch(() => null);
      if (watchmanSnap && watchmanSnap.empty) {
        await addDoc(empRef, {
          name: "Vigia Padrão",
          cpf: "12345678900",
          is_watchman: true,
          role_name: "Vigia"
        }).catch(() => {});
      }
    } catch {
      // Handled silently
    }
  };

  // Run seeding asynchronously to avoid blocking server startup
  seedFirestore().catch(() => {});

  const LOCAL_STORE_PATH = path.join(process.cwd(), 'data_store.json');

  function readLocalStore(): Record<string, Record<string, any>> {
    try {
      if (existsSync(LOCAL_STORE_PATH)) {
        return JSON.parse(readFileSync(LOCAL_STORE_PATH, 'utf8'));
      }
    } catch {}
    return {};
  }

  function writeLocalStore(store: Record<string, Record<string, any>>) {
    try {
      writeFileSync(LOCAL_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
    } catch {}
  }

  function initLocalStoreDefaults() {
    const store = readLocalStore();
    let modified = false;

    if (!store['roles'] || Object.keys(store['roles']).length === 0) {
      store['roles'] = {};
      const initialRoles = ["Vigia", "Motorista", "Operador", "Administrativo", "Encarregado", "Gerente", "Engenheiro"];
      initialRoles.forEach((name, i) => {
        const id = `role_${i + 1}`;
        store['roles'][id] = { id, name };
      });
      modified = true;
    }

    if (!store['settings'] || !store['settings']['global']) {
      if (!store['settings']) store['settings'] = {};
      store['settings']['global'] = {
        company_name: "VigiaControl",
        company_logo: "",
        report_email: "",
        report_whatsapp: "",
        smtp_host: "",
        smtp_port: "587",
        smtp_user: "",
        smtp_pass: ""
      };
      modified = true;
    }

    if (!store['employees'] || Object.keys(store['employees']).length === 0) {
      store['employees'] = {};
      store['employees']['default_watchman'] = {
        id: 'default_watchman',
        name: "Vigia Padrão",
        cpf: "12345678900",
        is_watchman: true,
        role_name: "Vigia"
      };
      modified = true;
    }

    if (modified) {
      writeLocalStore(store);
    }
  }

  function localGetDocs(collectionPath: string, constraints?: any[]) {
    const store = readLocalStore();
    const coll = store[collectionPath] || {};
    let list = Object.entries(coll).map(([id, data]) => ({
      id,
      data: { ...data }
    }));

    if (constraints && Array.isArray(constraints)) {
      for (const c of constraints) {
        if (c.type === 'where') {
          list = list.filter(item => {
            const val = item.data[c.field];
            if (c.operator === '==' || c.operator === '===') return val == c.value;
            if (c.operator === '!=') return val != c.value;
            if (c.operator === '>') return val > c.value;
            if (c.operator === '>=') return val >= c.value;
            if (c.operator === '<') return val < c.value;
            if (c.operator === '<=') return val <= c.value;
            if (c.operator === 'in') return Array.isArray(c.value) && c.value.includes(val);
            if (c.operator === 'array-contains') return Array.isArray(val) && val.includes(c.value);
            return true;
          });
        }
      }

      for (const c of constraints) {
        if (c.type === 'orderBy') {
          list.sort((a, b) => {
            const aVal = a.data[c.field] ?? '';
            const bVal = b.data[c.field] ?? '';
            const cmp = aVal < bVal ? -1 : (aVal > bVal ? 1 : 0);
            return c.direction === 'desc' ? -cmp : cmp;
          });
        }
      }

      for (const c of constraints) {
        if (c.type === 'limit') {
          list = list.slice(0, Number(c.value) || list.length);
        }
      }
    }

    return list;
  }

  function localGetDoc(docPath: string) {
    const parts = docPath.split('/').filter(Boolean);
    if (parts.length < 2) return { id: '', exists: false, data: null };
    const collectionName = parts.slice(0, -1).join('/');
    const docId = parts[parts.length - 1];
    const store = readLocalStore();
    const coll = store[collectionName] || {};
    const docData = coll[docId];
    if (docData) {
      return { id: docId, exists: true, data: { ...docData } };
    }
    return { id: docId, exists: false, data: null };
  }

  function localAddDoc(collectionPath: string, data: any) {
    const store = readLocalStore();
    if (!store[collectionPath]) store[collectionPath] = {};
    const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    store[collectionPath][id] = { ...data, id };
    writeLocalStore(store);
    return id;
  }

  function localSetDoc(docPath: string, data: any, merge: boolean = false) {
    const parts = docPath.split('/').filter(Boolean);
    if (parts.length < 2) return false;
    const collectionName = parts.slice(0, -1).join('/');
    const docId = parts[parts.length - 1];
    const store = readLocalStore();
    if (!store[collectionName]) store[collectionName] = {};
    
    if (merge && store[collectionName][docId]) {
      store[collectionName][docId] = { ...store[collectionName][docId], ...data, id: docId };
    } else {
      store[collectionName][docId] = { ...data, id: docId };
    }
    writeLocalStore(store);
    return true;
  }

  function localUpdateDoc(docPath: string, data: any) {
    return localSetDoc(docPath, data, true);
  }

  function localDeleteDoc(docPath: string) {
    const parts = docPath.split('/').filter(Boolean);
    if (parts.length < 2) return false;
    const collectionName = parts.slice(0, -1).join('/');
    const docId = parts[parts.length - 1];
    const store = readLocalStore();
    if (store[collectionName] && store[collectionName][docId]) {
      delete store[collectionName][docId];
      writeLocalStore(store);
      return true;
    }
    return false;
  }

  app.get("/test", (req, res) => {
    res.send("Server is alive and optimized for Cloud Run");
  });

  // API Routes using Firestore / Local Store
  app.post("/api/login", async (req, res) => {
    const { cpf } = req.body;
    try {
      let watchman: any = null;
      if (firestore) {
        try {
          const q = query(collection(firestore, 'employees'), where('cpf', '==', cpf), where('is_watchman', '==', true), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const watchmanDoc = snap.docs[0];
            watchman = { ...watchmanDoc.data(), id: watchmanDoc.id };
          }
        } catch {}
      }
      
      if (!watchman) {
        const localMatches = localGetDocs('employees', [
          { type: 'where', field: 'cpf', operator: '==', value: cpf },
          { type: 'where', field: 'is_watchman', operator: '==', value: true }
        ]);
        if (localMatches.length > 0) {
          watchman = { ...localMatches[0].data, id: localMatches[0].id };
        }
      }

      if (watchman) {
        // Start a new shift
        let shiftId = '';
        if (firestore) {
          try {
            const shiftRef = await addDoc(collection(firestore, 'shifts'), {
              watchman_id: watchman.id,
              start_time: new Date().toISOString(),
              status: 'ACTIVE'
            });
            shiftId = shiftRef.id;
          } catch {}
        }
        if (!shiftId) {
          shiftId = localAddDoc('shifts', {
            watchman_id: watchman.id,
            start_time: new Date().toISOString(),
            status: 'ACTIVE'
          });
        }
        res.json({ success: true, watchman, shiftId });
      } else {
        res.status(401).json({ success: false, message: "Vigia não encontrado ou CPF inválido." });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/shift/end", async (req, res) => {
    const { shiftId, logs, settings, watchmanName, startTime } = req.body;
    
    try {
      // 1. Resolve Data
      let finalLogs = logs;
      let finalSettings = settings;
      let finalWatchmanName = watchmanName;
      let finalStartTime = startTime;

      if (!finalLogs || !finalSettings || !finalWatchmanName) {
        let shiftData: any = null;
        if (firestore) {
          try {
            const shiftDoc = await getDoc(doc(firestore, 'shifts', shiftId));
            if (shiftDoc.exists()) shiftData = shiftDoc.data();
          } catch {}
        }
        if (!shiftData) {
          const localShift = localGetDoc(`shifts/${shiftId}`);
          if (localShift.exists) shiftData = localShift.data;
        }

        if (shiftData) {
          finalStartTime = shiftData.start_time || new Date().toISOString();
          if (!finalWatchmanName) {
            let wData: any = null;
            if (firestore) {
              try {
                const wDoc = await getDoc(doc(firestore, 'employees', shiftData.watchman_id));
                if (wDoc.exists()) wData = wDoc.data();
              } catch {}
            }
            if (!wData) {
              const localW = localGetDoc(`employees/${shiftData.watchman_id}`);
              if (localW.exists) wData = localW.data;
            }
            finalWatchmanName = wData?.name || 'Vigia';
          }
        }

        if (!finalSettings) {
          let sData: any = null;
          if (firestore) {
            try {
              const sDoc = await getDoc(doc(firestore, 'settings', 'global'));
              if (sDoc.exists()) sData = sDoc.data();
            } catch {}
          }
          if (!sData) {
            const localS = localGetDoc('settings/global');
            if (localS.exists) sData = localS.data;
          }
          finalSettings = sData || {};
        }

        if (!finalLogs) {
          let rawLogs: any[] = [];
          if (firestore) {
            try {
              const logsQuery = query(collection(firestore, 'logs'), where('shift_id', '==', shiftId));
              const logsSnap = await getDocs(logsQuery);
              rawLogs = logsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
            } catch {}
          }
          if (rawLogs.length === 0) {
            rawLogs = localGetDocs('logs', [{ type: 'where', field: 'shift_id', operator: '==', value: shiftId }]).map(d => ({ ...d.data, id: d.id }));
          }
          finalLogs = rawLogs;
        }
      }

      // 2. Update Shift Status (Ensuring it's closed)
      localUpdateDoc(`shifts/${shiftId}`, {
        status: 'CLOSED',
        end_time: new Date().toISOString(),
        report_sent: true
      });
      if (firestore) {
        try {
          await updateDoc(doc(firestore, 'shifts', shiftId), {
            status: 'CLOSED',
            end_time: new Date().toISOString(),
            report_sent: true
          });
        } catch {}
      }

      // 3. Send Email if SMTP configured
      if (finalSettings?.report_email && finalSettings?.smtp_host && finalSettings?.smtp_user && finalSettings?.smtp_pass) {
        try {
          const transporter = nodemailer.createTransport({
            host: finalSettings.smtp_host,
            port: parseInt(finalSettings.smtp_port) || 587,
            secure: parseInt(finalSettings.smtp_port) === 465,
            auth: {
              user: finalSettings.smtp_user,
              pass: finalSettings.smtp_pass,
            },
          });

          const logRows = (finalLogs || []).map((log: any) => `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">${new Date(log.timestamp).toLocaleTimeString('pt-BR')}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${log.type === 'IN' ? 'Entrada' : 'Saída'}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${log.employee_name || log.employeeName || 'Visitante'}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${log.vehicle_plate || log.machine_asset || log.assetName || '-'}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${log.km ? `${log.km} KM` : (log.horometer ? `${log.horometer} H` : '-')}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${log.destination || '-'}</td>
            </tr>
          `).join('');

          const mailOptions = {
            from: `"${finalSettings.company_name || 'VigiaControl'}" <${finalSettings.smtp_user}>`,
            to: finalSettings.report_email,
            subject: `Relatório de Turno - ${finalSettings.company_name || 'VigiaControl'} - ${new Date().toLocaleDateString('pt-BR')}`,
            html: `
              <div style="font-family: sans-serif; max-width: 800px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                <h2 style="color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px;">Relatório de Turno - ${finalSettings.company_name || 'VigiaControl'}</h2>
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                  <p style="margin: 5px 0;"><strong>Vigia:</strong> ${finalWatchmanName || 'Vigia'}</p>
                  <p style="margin: 5px 0;"><strong>Início:</strong> ${new Date(finalStartTime || Date.now()).toLocaleString('pt-BR')}</p>
                  <p style="margin: 5px 0;"><strong>Fim:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                  <thead>
                    <tr style="background-color: #333; color: white;">
                      <th style="padding: 12px 8px; border: 1px solid #ddd; text-align: left;">Hora</th>
                      <th style="padding: 12px 8px; border: 1px solid #ddd; text-align: left;">Tipo</th>
                      <th style="padding: 12px 8px; border: 1px solid #ddd; text-align: left;">Funcionário/Operador</th>
                      <th style="padding: 12px 8px; border: 1px solid #ddd; text-align: left;">Veículo/Máquina</th>
                      <th style="padding: 12px 8px; border: 1px solid #ddd; text-align: left;">KM/Hor</th>
                      <th style="padding: 12px 8px; border: 1px solid #ddd; text-align: left;">Destino</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${logRows || '<tr><td colspan="6" style="padding: 20px; border: 1px solid #ddd; text-align: center; color: #999;">Nenhum registro neste turno.</td></tr>'}
                  </tbody>
                </table>
                <p style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">Gerado automaticamente por VigiaControl</p>
              </div>
            `,
          };

          await transporter.sendMail(mailOptions);
          return res.json({ success: true, message: "Jornada encerrada e relatório enviado por e-mail com sucesso." });
        } catch {
          return res.json({ success: true, message: "Jornada encerrada com sucesso." });
        }
      } else {
        return res.json({ success: true, message: "Jornada encerrada com sucesso." });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Erro ao encerrar turno: " + err.message });
    }
  });

  app.post("/api/test-email", async (req, res) => {
    const { settings } = req.body;
    
    if (!settings.report_email || !settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
      return res.status(400).json({ success: false, message: "Configurações de e-mail incompletas." });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: settings.smtp_host,
        port: parseInt(settings.smtp_port) || 587,
        secure: parseInt(settings.smtp_port) === 465,
        auth: {
          user: settings.smtp_user,
          pass: settings.smtp_pass,
        },
      });

      await transporter.verify();

      const mailOptions = {
        from: `"${settings.company_name || 'VigiaControl'}" <${settings.smtp_user}>`,
        to: settings.report_email,
        subject: "Teste de Configuração - VigiaControl",
        text: "Este é um e-mail de teste para confirmar que suas configurações de SMTP estão corretas.",
        html: "<p>Este é um e-mail de teste para confirmar que suas configurações de SMTP estão corretas.</p>",
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: "E-mail de teste enviado com sucesso!" });
    } catch (err: any) {
      console.error("SMTP Test Error:", err);
      res.status(500).json({ success: false, message: "Erro na configuração SMTP: " + err.message });
    }
  });

  app.get("/api/search/employee", async (req, res) => {
    const { q } = req.query;
    try {
      let employees: any[] = [];
      if (firestore) {
        try {
          const snap = await getDocs(collection(firestore, 'employees'));
          employees = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        } catch {}
      }
      if (employees.length === 0) {
        employees = localGetDocs('employees').map(d => ({ ...d.data, id: d.id }));
      }
      const queryStr = ((q as string) || '').toLowerCase();
      const results = employees.filter((emp: any) => 
        (emp.name || '').toLowerCase().includes(queryStr) || 
        (emp.cpf && emp.cpf.includes(queryStr))
      );
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/search/vehicle", async (req, res) => {
    const { q } = req.query;
    try {
      let vehicles: any[] = [];
      if (firestore) {
        try {
          const snap = await getDocs(collection(firestore, 'vehicles'));
          vehicles = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        } catch {}
      }
      if (vehicles.length === 0) {
        vehicles = localGetDocs('vehicles').map(d => ({ ...d.data, id: d.id }));
      }
      const queryStr = ((q as string) || '').toLowerCase();
      const results = vehicles.filter((v: any) => 
        (v.brand || '').toLowerCase().includes(queryStr) || 
        (v.plate && v.plate.toLowerCase().includes(queryStr)) ||
        (v.asset_number && v.asset_number.toLowerCase().includes(queryStr))
      );
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/search/machine", async (req, res) => {
    const { q } = req.query;
    try {
      let machines: any[] = [];
      if (firestore) {
        try {
          const snap = await getDocs(collection(firestore, 'machines'));
          machines = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        } catch {}
      }
      if (machines.length === 0) {
        machines = localGetDocs('machines').map(d => ({ ...d.data, id: d.id }));
      }
      const queryStr = ((q as string) || '').toLowerCase();
      const results = machines.filter((m: any) => 
        (m.type || '').toLowerCase().includes(queryStr) || 
        (m.brand || '').toLowerCase().includes(queryStr) ||
        (m.asset_number && m.asset_number.toLowerCase().includes(queryStr))
      );
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/logs", async (req, res) => {
    try {
      const logData = {
        ...req.body,
        timestamp: req.body.timestamp || new Date().toISOString()
      };
      localAddDoc('logs', logData);
      if (firestore) {
        try {
          await addDoc(collection(firestore, 'logs'), logData);
        } catch {}
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/register/employee", async (req, res) => {
    const { name, cpf, role_id, role_name, is_watchman } = req.body;
    const cleanCpf = cpf ? cpf.replace(/\D/g, '') : null;
    
    if (is_watchman && !cleanCpf) {
      return res.status(400).json({ success: false, message: "CPF é obrigatório para Vigias." });
    }

    try {
      const empData = {
        name,
        cpf: cleanCpf,
        role_id,
        role_name,
        is_watchman: !!is_watchman
      };
      localAddDoc('employees', empData);
      if (firestore) {
        try {
          await addDoc(collection(firestore, 'employees'), empData);
        } catch {}
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/register/vehicle", async (req, res) => {
    try {
      localAddDoc('vehicles', req.body);
      if (firestore) {
        try {
          await addDoc(collection(firestore, 'vehicles'), req.body);
        } catch {}
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/register/machine", async (req, res) => {
    try {
      localAddDoc('machines', req.body);
      if (firestore) {
        try {
          await addDoc(collection(firestore, 'machines'), req.body);
        } catch {}
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/employees", async (req, res) => {
    try {
      let employees: any[] = [];
      if (firestore) {
        try {
          const snap = await getDocs(collection(firestore, 'employees'));
          employees = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        } catch {}
      }
      if (employees.length === 0) {
        employees = localGetDocs('employees').map(d => ({ ...d.data, id: d.id }));
      }
      res.json(employees);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.delete("/api/employees/:id", async (req, res) => {
    const { id } = req.params;
    try {
      localDeleteDoc(`employees/${id}`);
      if (firestore) {
        try {
          await deleteDoc(doc(firestore, 'employees', id));
        } catch {}
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/roles", async (req, res) => {
    try {
      let roles: any[] = [];
      if (firestore) {
        try {
          const snap = await getDocs(collection(firestore, 'roles'));
          roles = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        } catch {}
      }
      if (roles.length === 0) {
        roles = localGetDocs('roles').map(d => ({ ...d.data, id: d.id }));
      }
      res.json(roles);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/logs/active", async (req, res) => {
    const { shiftId } = req.query;
    try {
      let logs: any[] = [];
      if (firestore) {
        try {
          const q = query(collection(firestore, 'logs'), where('shift_id', '==', shiftId));
          const snap = await getDocs(q);
          logs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        } catch {}
      }
      if (logs.length === 0) {
        logs = localGetDocs('logs', [{ type: 'where', field: 'shift_id', operator: '==', value: shiftId }]).map(d => ({ ...d.data, id: d.id }));
      }
      logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/settings", async (req, res) => {
    try {
      let settings: any = null;
      if (firestore) {
        try {
          const snap = await getDoc(doc(firestore, 'settings', 'global'));
          if (snap.exists()) settings = snap.data();
        } catch {}
      }
      if (!settings) {
        const localS = localGetDoc('settings/global');
        if (localS.exists) settings = localS.data;
      }
      res.json(settings || {});
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      localSetDoc('settings/global', req.body, true);
      if (firestore) {
        try {
          await setDoc(doc(firestore, 'settings', 'global'), req.body, { merge: true });
        } catch {}
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

// Helper function to serialize any Firestore Timestamp to JSON-safe structure
function serializeTimestamps(obj: any): any {
  if (!obj) return obj;
  if (obj instanceof Date) {
    return { seconds: Math.floor(obj.getTime() / 1000), nanoseconds: (obj.getTime() % 1000) * 1000000, __type: 'timestamp' };
  }
  if (obj && typeof obj === 'object') {
    // Check if it's a Firestore Timestamp instance
    if (obj.seconds !== undefined && obj.nanoseconds !== undefined) {
      return { seconds: obj.seconds, nanoseconds: obj.nanoseconds, __type: 'timestamp' };
    }
    if (typeof obj.toDate === 'function') {
      const d = obj.toDate();
      return { seconds: Math.floor(d.getTime() / 1000), nanoseconds: (d.getTime() % 1000) * 1000000, __type: 'timestamp' };
    }
    
    const result: any = Array.isArray(obj) ? [] : {};
    for (const key of Object.keys(obj)) {
      result[key] = serializeTimestamps(obj[key]);
    }
    return result;
  }
  return obj;
}

// Helper function to reconstruct custom structures back to Firestore operators/values
function deserializeValues(obj: any): any {
  if (!obj) return obj;
  if (typeof obj === 'object') {
    if (obj.__type === 'serverTimestamp') {
      return serverTimestamp();
    }
    if (obj.__type === 'increment') {
      return increment(obj.value);
    }
    if (obj.__type === 'timestamp') {
      return Timestamp.fromMillis(obj.seconds * 1000 + obj.nanoseconds / 1000000);
    }
    
    const result: any = Array.isArray(obj) ? [] : {};
    for (const key of Object.keys(obj)) {
      result[key] = deserializeValues(obj[key]);
    }
    return result;
  }
  return obj;
}

  app.post("/api/save-firebase-config", (req, res) => {
    const { config } = req.body;
    try {
      if (!config || typeof config !== 'object' || !config.projectId || !config.apiKey) {
        return res.status(400).json({ success: false, message: "Configuração do Firebase inválida." });
      }

      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

      // Re-initialize firestore using the new configuration
      const firebaseApp = initializeApp(config);
      firestore = (config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)')
        ? getFirestore(firebaseApp, config.firestoreDatabaseId)
        : getFirestore(firebaseApp);

      console.log(`Firebase re-initialized successfully with project ID: ${config.projectId}`);
      return res.json({ success: true, message: "Configuração do Firebase atualizada e conectada com sucesso!" });
    } catch (err: any) {
      console.error("Error updating firebase config:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  const KNOWN_COLLECTIONS = [
    'roles', 'settings', 'employees', 'vehicles', 'machines', 
    'shifts', 'logs', 'patrol_points', 'patrol_scans', 'visitors', 'temporary_passes'
  ];

  // Export full database as JSON
  app.get("/api/export-data", async (req, res) => {
    try {
      const fullData: Record<string, any[]> = {};
      const localStore = readLocalStore();

      for (const collName of KNOWN_COLLECTIONS) {
        const itemsMap: Record<string, any> = {};

        // 1. Gather from local storage
        if (localStore[collName]) {
          Object.entries(localStore[collName]).forEach(([id, docData]) => {
            itemsMap[id] = { ...docData, id };
          });
        }

        // 2. Gather from firestore if reachable
        if (firestore) {
          try {
            const snap = await getDocs(collection(firestore, collName));
            snap.docs.forEach(d => {
              itemsMap[d.id] = { ...serializeTimestamps(d.data()), id: d.id };
            });
          } catch {}
        }

        fullData[collName] = Object.values(itemsMap);
      }

      res.json({ success: true, data: fullData, exportedAt: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Download backup file
  app.get("/api/download-db", async (req, res) => {
    try {
      const fullData: Record<string, any[]> = {};
      const localStore = readLocalStore();

      for (const collName of KNOWN_COLLECTIONS) {
        const itemsMap: Record<string, any> = {};
        if (localStore[collName]) {
          Object.entries(localStore[collName]).forEach(([id, docData]) => {
            itemsMap[id] = { ...docData, id };
          });
        }
        if (firestore) {
          try {
            const snap = await getDocs(collection(firestore, collName));
            snap.docs.forEach(d => {
              itemsMap[d.id] = { ...serializeTimestamps(d.data()), id: d.id };
            });
          } catch {}
        }
        fullData[collName] = Object.values(itemsMap);
      }

      const backupString = JSON.stringify(fullData, null, 2);
      const filename = `vigiacontrol_backup_${new Date().toISOString().slice(0, 10)}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(backupString);
    } catch (err: any) {
      res.status(500).send("Erro ao gerar backup: " + err.message);
    }
  });

  // Import JSON data into active database
  app.post("/api/import-data", async (req, res) => {
    const { data } = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, message: "Dados de importação inválidos." });
    }

    try {
      let totalImported = 0;
      for (const [collName, items] of Object.entries(data)) {
        if (!Array.isArray(items)) {
          // If it's an object mapping id -> data
          if (typeof items === 'object' && items !== null) {
            for (const [docId, docData] of Object.entries(items as Record<string, any>)) {
              localSetDoc(`${collName}/${docId}`, docData, true);
              if (firestore) {
                try {
                  await setDoc(doc(firestore, collName, docId), deserializeValues(docData), { merge: true });
                } catch {}
              }
              totalImported++;
            }
          }
          continue;
        }

        for (const item of items) {
          const docId = item.id || `imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          localSetDoc(`${collName}/${docId}`, item, true);
          if (firestore) {
            try {
              await setDoc(doc(firestore, collName, docId), deserializeValues(item), { merge: true });
            } catch {}
          }
          totalImported++;
        }
      }

      return res.json({ success: true, count: totalImported, message: `${totalImported} registros importados com sucesso!` });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Migrate data from an old Firebase project directly into the new one
  app.post("/api/migrate-from-firebase", async (req, res) => {
    const { oldConfig } = req.body;
    if (!oldConfig || !oldConfig.projectId) {
      return res.status(400).json({ success: false, message: "Configuração do Firebase antigo inválida." });
    }

    try {
      const appName = `migration_source_${Date.now()}`;
      const sourceApp = initializeApp(oldConfig, appName);
      const sourceDb = (oldConfig.firestoreDatabaseId && oldConfig.firestoreDatabaseId !== '(default)')
        ? getFirestore(sourceApp, oldConfig.firestoreDatabaseId)
        : getFirestore(sourceApp);

      let migratedCount = 0;
      const resultsByCollection: Record<string, number> = {};

      for (const collName of KNOWN_COLLECTIONS) {
        try {
          const snap = await getDocs(collection(sourceDb, collName));
          resultsByCollection[collName] = snap.size;

          for (const d of snap.docs) {
            const docData = serializeTimestamps(d.data());
            const docId = d.id;

            // Save to local store
            localSetDoc(`${collName}/${docId}`, { ...docData, id: docId }, true);

            // Save to active firestore
            if (firestore) {
              try {
                await setDoc(doc(firestore, collName, docId), deserializeValues(docData), { merge: true });
              } catch {}
            }
            migratedCount++;
          }
        } catch (e: any) {
          console.warn(`Could not read collection ${collName} from source:`, e.message);
        }
      }

      return res.json({
        success: true,
        migratedCount,
        resultsByCollection,
        message: `${migratedCount} documentos migrados com sucesso para o novo banco!`
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Falha na migração: " + err.message });
    }
  });

  app.get("/api/db-status", (req, res) => {
    res.json({
      healthy: true,
      cloudFirestoreActive: isFirestoreActive(),
      storageType: isFirestoreActive() ? "Cloud Firestore" : "Armazenamento Local Seguro (JSON)",
      message: firestoreStatusMessage || (isFirestoreActive() ? "Conectado ao Cloud Firestore" : "Operando em Armazenamento Local Seguro"),
      projectId: "vigiacontrolcontroledeportaria"
    });
  });

  app.post("/api/firestore-proxy", async (req, res) => {
    const { action, path: docOrCollPath, data, constraints } = req.body;
    
    try {
      if (action === 'getDocs') {
        if (isFirestoreActive()) {
          try {
            let q = collection(firestore, docOrCollPath);
            let queryRef: any = q;
            
            if (constraints && Array.isArray(constraints)) {
              for (const constraint of constraints) {
                if (constraint.type === 'where') {
                  queryRef = query(queryRef, where(constraint.field, constraint.operator, constraint.value));
                } else if (constraint.type === 'orderBy') {
                  queryRef = query(queryRef, orderBy(constraint.field, constraint.direction));
                } else if (constraint.type === 'limit') {
                  queryRef = query(queryRef, limit(constraint.value));
                }
              }
            }
            
            const snap = await getDocs(queryRef);
            const docs = snap.docs.map(document => {
              return {
                id: document.id,
                data: serializeTimestamps(document.data())
              };
            });
            // Also cache into local storage
            docs.forEach(d => localSetDoc(`${docOrCollPath}/${d.id}`, d.data, true));
            return res.json({ docs });
          } catch (err: any) {
            if (err.message?.includes('PERMISSION_DENIED') || err.message?.includes('not been used')) {
              isFirestoreHealthy = false;
            }
            const docs = localGetDocs(docOrCollPath, constraints);
            return res.json({ docs });
          }
        } else {
          const docs = localGetDocs(docOrCollPath, constraints);
          return res.json({ docs });
        }
        
      } else if (action === 'getDoc') {
        if (isFirestoreActive()) {
          try {
            const docRef = doc(firestore, docOrCollPath);
            const snap = await getDoc(docRef) as any;
            if (snap.exists()) {
              const docData = serializeTimestamps(snap.data());
              localSetDoc(docOrCollPath, docData, true);
              return res.json({
                id: snap.id,
                exists: true,
                data: docData
              });
            } else {
              return res.json({ id: snap.id, exists: false, data: null });
            }
          } catch (err: any) {
            if (err.message?.includes('PERMISSION_DENIED') || err.message?.includes('not been used')) {
              isFirestoreHealthy = false;
            }
            const docResult = localGetDoc(docOrCollPath);
            return res.json(docResult);
          }
        } else {
          const docResult = localGetDoc(docOrCollPath);
          return res.json(docResult);
        }
        
      } else if (action === 'addDoc') {
        const processedData = deserializeValues(data);
        let createdId = '';
        if (isFirestoreActive()) {
          try {
            const ref = await addDoc(collection(firestore, docOrCollPath), processedData) as any;
            createdId = ref.id;
          } catch (err: any) {
            if (err.message?.includes('PERMISSION_DENIED') || err.message?.includes('not been used')) {
              isFirestoreHealthy = false;
            }
            createdId = localAddDoc(docOrCollPath, data);
            return res.json({ id: createdId });
          }
        }
        if (!createdId) {
          createdId = localAddDoc(docOrCollPath, data);
        } else {
          localSetDoc(`${docOrCollPath}/${createdId}`, data, true);
        }
        return res.json({ id: createdId });
        
      } else if (action === 'updateDoc') {
        const processedData = deserializeValues(data);
        localUpdateDoc(docOrCollPath, data);
        if (isFirestoreActive()) {
          try {
            await updateDoc(doc(firestore, docOrCollPath), processedData);
          } catch (err: any) {
            if (err.message?.includes('PERMISSION_DENIED') || err.message?.includes('not been used')) {
              isFirestoreHealthy = false;
            }
          }
        }
        return res.json({ success: true });
        
      } else if (action === 'setDoc') {
        const processedData = deserializeValues(data);
        localSetDoc(docOrCollPath, data);
        if (isFirestoreActive()) {
          try {
            await setDoc(doc(firestore, docOrCollPath), processedData);
          } catch (err: any) {
            if (err.message?.includes('PERMISSION_DENIED') || err.message?.includes('not been used')) {
              isFirestoreHealthy = false;
            }
          }
        }
        return res.json({ success: true });
        
      } else if (action === 'deleteDoc') {
        localDeleteDoc(docOrCollPath);
        if (isFirestoreActive()) {
          try {
            await deleteDoc(doc(firestore, docOrCollPath));
          } catch (err: any) {
            if (err.message?.includes('PERMISSION_DENIED') || err.message?.includes('not been used')) {
              isFirestoreHealthy = false;
            }
          }
        }
        return res.json({ success: true });
      }
      
      return res.status(400).json({ message: `Unknown action: ${action}` });
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/debug", (req, res) => {
    res.json({
      node_env: process.env.NODE_ENV,
      cwd: process.cwd(),
      dirname: currentDirname,
      firestore_ready: !!firestore
    });
  });

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode`);

  // Vite middleware for development
  const isProduction = process.env.NODE_ENV === "production";
  console.log(`Environment: ${process.env.NODE_ENV}, isProduction: ${isProduction}`);

  if (!isProduction) {
    console.log("Using Vite middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    console.log(`Serving static files from: ${distPath}`);
    
    // Serve static assets first
    app.use(express.static(distPath));

    // Catch-all route for SPA
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        console.error(`index.html not found at ${indexPath}`);
        res.status(404).send("Application not built correctly. Please contact support.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
