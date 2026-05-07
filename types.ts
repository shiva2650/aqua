export interface Sensors {
  ph: number;
  temperature: number;
  turbidity: number;
  waterLevel: number;
  distance: number;
  timestamp: number;
}

export interface Thresholds {
  ph: { min: number; max: number };
  temperature: { min: number; max: number };
  turbidity: { max: number };
  waterLevel: { min: number };
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface MaintenanceTask {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  dueDate: number;
  completedAt?: number;
  isRecurring: boolean;
  frequencyDays?: number;
}

export interface DeviceStates {
  pump: boolean;
  heater: boolean;
  lights: boolean;
  filter: boolean;
  autoMode: boolean;
}

export interface HealthAnalysis {
  score: number;
  status: 'Healthy' | 'Warning' | 'Critical';
  riskLevel: 'Low' | 'Medium' | 'High';
  summary: string;
  recommendations: string[];
  predictions: string[];
  lastUpdated: number;
}

export interface ReminderSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'as-needed';
  sound: 'subtle' | 'techno' | 'nature';
}

export interface AquariumConfig {
  fishCount: number;
  fishSpecies: string[];
  tankSize: number; // in liters
  waterType: 'Freshwater' | 'Saltwater' | 'Brackish';
  aiSensitivity: 'low' | 'medium' | 'high';
  thresholds: Thresholds;
  reminderSettings: ReminderSettings;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
