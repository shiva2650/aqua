# 🌊 AquaPulse AI

Futuristic smart aquarium monitor with AI-powered health analysis, automatic maintenance, and real-time sensor tracking.

![AquaPulse AI Banner](https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&q=80&w=1200)

## ✨ Features

-   **Real-time Monitoring**: Track pH levels, temperature, and other vital aquarium metrics in real-time.
-   **AI Analysis**: Powered by Google Gemini to analyze water quality and provide actionable health recommendations for your aquatic life.
-   **Dynamic Visualizations**: Beautiful, interactive charts showing historical trends using Recharts.
-   **Device Control**: Remotely manage aquarium hardware like filters, heaters, and lighting.
-   **Smart Maintenance**: AI-suggested maintenance tasks that you can add to your schedule with a single click.
-   **Modern UI**: High-performance, glassmorphic design built with React, Tailwind CSS, and Framer Motion.

## 🛠️ Tech Stack

-   **Frontend**: React 19, Vite, Tailwind CSS
-   **Animations**: Framer Motion
-   **Charts**: Recharts
-   **Icons**: Lucide React
-   **Backend/Database**: Firebase (Firestore)
-   **AI Engine**: Google Gemini AI (@google/generative-ai)

## 🚀 Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or higher)
-   [npm](https://www.npmjs.com/)
-   A Firebase Project
-   A Google AI Studio API Key (for Gemini)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/shiva2650/aqua-pulse.git
    cd aqua-pulse
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Setup**:
    Create a `.env` file in the root directory and add your credentials:
    ```env
    # Firebase Configuration
    VITE_FIREBASE_API_KEY=your_api_key
    VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
    VITE_FIREBASE_APP_ID=your_app_id

    # Gemini AI Configuration
    VITE_GEMINI_API_KEY=your_gemini_api_key
    ```

4.  **Run the development server**:
    ```bash
    npm run dev
    ```
    Open `http://localhost:3000` to see the app.

## 📦 Build & Deployment

### Build for Production
```bash
npm run build
```

### GitHub Pages Deployment
This project is configured to be deployed to GitHub Pages.
1.  Ensure `base` in `vite.config.ts` matches your repository name:
    ```ts
    base: '/aqua-pulse/',
    ```
2.  Deploy using the following command (if `gh-pages` is configured):
    ```bash
    npm run build
    # Then push the contents of the dist/ folder to your gh-pages branch
    ```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
