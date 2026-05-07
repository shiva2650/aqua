import { GoogleGenerativeAI } from "@google/generative-ai";
import { Sensors, AquariumConfig, HealthAnalysis, MaintenanceTask, Priority } from "../types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function analyzeAquariumHealth(
  sensors: Sensors,
  config: AquariumConfig,
  history: Sensors[],
  sensitivity: 'low' | 'medium' | 'high' = 'medium'
): Promise<HealthAnalysis> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `
    You are an AI Aquarium Health Assistant.
    Analyze the current sensor data and history for this aquarium setup:
    
    Current Sensors:
    - pH: ${sensors.ph}
    - Temperature: ${sensors.temperature}°C
    - Turbidity: ${sensors.turbidity} NTU
    - Water Level: ${sensors.waterLevel}%
    
    Aquarium Config:
    - Fish Count: ${config.fishCount}
    - Fish Species: ${config.fishSpecies.join(", ")}
    - Tank Size: ${config.tankSize}L
    - Water Type: ${config.waterType}
    - Thresholds: ${JSON.stringify(config.thresholds)}
    - AI Sensitivity: ${sensitivity}
    
    Historical Trends (last few readings):
    ${history.map(h => `- pH: ${h.ph}, Temp: ${h.temperature}, Turb: ${h.turbidity}`).join("\n")}

    Identify health status (Healthy, Warning, Critical), risk level, providing a summary, recommendations, and predictions.
    Detect possible diseases or stress conditions (Fin rot, Ich, Oxygen stress, Ammonia poisoning).
    
    Return the response strictly in JSON format matching this interface:
    interface HealthAnalysis {
      score: number; // 0-100
      status: 'Healthy' | 'Warning' | 'Critical';
      riskLevel: 'Low' | 'Medium' | 'High';
      summary: string;
      recommendations: string[];
      predictions: string[];
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return {
      score: 75,
      status: 'Healthy',
      riskLevel: 'Low',
      summary: "AI analysis unavailable. Manual monitoring recommended.",
      recommendations: ["Check water parameters manually", "Verify sensor calibration"],
      predictions: ["Stability predicted if values remain in range"],
      lastUpdated: Date.now()
    };
  }
}

export async function getChatResponse(
  message: string,
  sensors: Sensors,
  config: AquariumConfig,
  chatHistory: { role: string, content: string }[]
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const systemPrompt = `
    You are AquaPulse AI, a futuristic smart aquarium assistant.
    Current Sensor Status:
    - pH: ${sensors.ph} (Range: ${config.thresholds.ph.min}-${config.thresholds.ph.max})
    - Temp: ${sensors.temperature}°C (Range: ${config.thresholds.temperature.min}-${config.thresholds.temperature.max})
    - Turbidity: ${sensors.turbidity} NTU (Safe < ${config.thresholds.turbidity.max})
    - Water Level: ${sensors.waterLevel}%
    
    Context:
    - Species: ${config.fishSpecies.join(", ")}
    - Count: ${config.fishCount}
    
    Provide helpful, natural language advice. Use the live data provided above to answer specific questions about the aquarium's status.
    Be concise but thorough.
  `.replace(/\s+/g, ' ');

  try {
    const chat = model.startChat({
      history: chatHistory.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    });

    const result = await chat.sendMessage(`Context: ${systemPrompt}\nUser: ${message}`);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Chat Error:", error);
    return "I'm having trouble connecting to my neural network. Please check your data manually.";
  }
}

export async function generateMaintenancePlan(
  config: AquariumConfig,
  sensors: Sensors
): Promise<MaintenanceTask[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `
    Based on the following aquarium setup, generate a maintenance plan for the next 7 days.
    - Species: ${config.fishSpecies.join(", ")}
    - Count: ${config.fishCount}
    - Current pH: ${sensors.ph}
    - Current Temp: ${sensors.temperature}
    - Current Turbidity: ${sensors.turbidity}
    
    Return a JSON array of tasks matching this interface:
    interface MaintenanceTask {
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high';
      dueDate: number; // timestamp
      isRecurring: boolean;
      frequencyDays?: number;
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const tasks = JSON.parse(cleanedText);
    return tasks.map((t: any, i: number) => ({ ...t, id: `ai-${Date.now()}-${i}` }));
  } catch (error) {
    console.error("Maintenance Plan Generation Error:", error);
    return [];
  }
}
