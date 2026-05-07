import { Priority, AquariumConfig } from './types';

export const DEFAULT_CONFIG: AquariumConfig = {
  fishCount: 5,
  fishSpecies: ['Neon Tetra', 'Guppy'],
  tankSize: 40,
  waterType: 'Freshwater',
  aiSensitivity: 'medium',
  thresholds: {
    ph: { min: 6.5, max: 7.5 },
    temperature: { min: 24, max: 28 },
    turbidity: { max: 10 },
    waterLevel: { min: 80 },
  },
  reminderSettings: {
    enabled: true,
    frequency: 'daily',
    sound: 'techno',
  },
};

export const INITIAL_TASKS = [
  {
    id: '1',
    title: 'Water Change',
    description: 'Replace 20% of the aquarium water with treated fresh water.',
    priority: Priority.HIGH,
    dueDate: Date.now() + 1000 * 60 * 60 * 24 * 2, // 2 days from now
    isRecurring: true,
    frequencyDays: 7,
  },
  {
    id: '2',
    title: 'Filter Cleaning',
    description: 'Rinse the filter sponges in aquarium water to remove debris.',
    priority: Priority.MEDIUM,
    dueDate: Date.now() + 1000 * 60 * 60 * 24 * 5,
    isRecurring: true,
    frequencyDays: 30,
  },
];

export const FISH_SPECIES_DATA: Record<string, { ph: [number, number], temp: [number, number], type: string }> = {
  'Neon Tetra': { ph: [6.0, 7.0], temp: [20, 26], type: 'Freshwater' },
  'Guppy': { ph: [7.0, 8.0], temp: [22, 28], type: 'Freshwater' },
  'Betta': { ph: [6.5, 7.5], temp: [24, 30], type: 'Freshwater' },
  'Goldfish': { ph: [7.0, 7.5], temp: [18, 24], type: 'Freshwater' },
  'Angelfish': { ph: [6.0, 7.5], temp: [24, 29], type: 'Freshwater' },
  'Clownfish': { ph: [8.1, 8.4], temp: [24, 27], type: 'Saltwater' },
};
