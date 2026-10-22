export interface Employee {
  id: string;
  name: string;
  cpf: string;
  role_id: string;
  is_watchman: boolean;
  is_admin?: boolean;
  is_authorized?: boolean;
  role_name?: string;
  photo?: string | null;
  email?: string;
  password?: string;
}

export interface Role {
  id: string;
  name: string;
}

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  plate: string;
  color?: string;
  asset_number?: string;
  responsible_employee_id?: string | null;
  responsible_name?: string | null;
}

export interface Machine {
  id: string;
  type: string;
  brand: string;
  model: string;
  asset_number?: string;
  responsible_employee_id?: string | null;
  responsible_name?: string | null;
}

export interface ServiceProvider {
  id: string;
  name: string;
  cpf: string;
  company?: string;
  vehicle_plate?: string;
}

export interface Log {
  id: string;
  employee_id: string | null;
  vehicle_id: string | null;
  machine_id: string | null;
  service_provider_id: string | null;
  type: 'IN' | 'OUT';
  timestamp: string;
  km: number | null;
  horometer: number | null;
  transport_mode: 'RODANDO' | 'PRANCHA' | null;
  destination: string;
  watchman_id: string;
  shift_id: string;
  has_uniform: boolean | null;
  has_badge: boolean | null;
  visitor_type?: 'VISITOR' | 'SERVICE_PROVIDER' | null;
  employee_name?: string;
  vehicle_plate?: string;
  vehicle_asset?: string;
  machine_type?: string;
  machine_asset?: string;
  service_provider_name?: string;
  service_provider_cpf?: string;
  photo?: string | null;
}

export const VEHICLE_BRANDS = [
  "Agrale", "Aston Martin", "Audi", "BMW", "BYD", "Caminhão Basculante", "Caminhão Caçamba", "Caminhão DAF", "Caminhão Iveco", "Caminhão MAN", "Caminhão Mercedes-Benz", "Caminhão Pipa", "Caminhão Scania", "Caminhão Volkswagen", "Caminhão Volvo", "Carreta", "Carreta Prancha", "Changan", "Chery", "Chevrolet", "Chrysler", "Citroën", 
  "Dodge", "Effa", "Ferrari", "Fiat", "Ford", "Foton", "GWM", "Geely", "Honda", "Hyundai", "Iveco", "JAC", 
  "Jaguar", "Jeep", "Kia", "Lamborghini", "Land Rover", "Lexus", "Lifan", "Maserati", "Mazda", "McLaren", 
  "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan", "Peugeot", "Porsche", "Prancha", "Ram", "Renault", "Rolls-Royce", 
  "Shineray", "Smart", "Subaru", "Suzuki", "Toyota", "Troller", "Volkswagen", "Volvo"
];

export const MACHINE_TYPES = [
  "Empilhadeira", "Escavadeira Hidráulica", "Guindaste", "Mini Carregadeira", "Mini Escavadeira", "Moedor de Madeira", "Motoniveladora", "Pá Carregadeira", "Retroescavadeira", "Rolo Compactador", "Trator de Esteira", "Trator de Pneus", "Trator de Pneu Grande"
];

export const MACHINE_TYPE_SIGLAS: Record<string, string> = {
  "Empilhadeira": "EMP",
  "Escavadeira Hidráulica": "EH",
  "Guindaste": "GUI",
  "Mini Carregadeira": "MC",
  "Mini Escavadeira": "ME",
  "Moedor de Madeira": "MM",
  "Motoniveladora": "MN",
  "Pá Carregadeira": "PC",
  "Retroescavadeira": "RE",
  "Rolo Compactador": "RC",
  "Trator de Esteira": "TE",
  "Trator de Pneus": "TP",
  "Trator de Pneu Grande": "TPG"
};

export const MACHINE_BRANDS = [
  "Bobcat", "Case", "Caterpillar (CAT)", "Doosan", "Hyundai", "JCB", "John Deere", "Komatsu", "LiuGong", "Massey Ferguson", "New Holland", "Sany", "Valtra", "Volvo", "XCMG"
];
