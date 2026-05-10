# OmniDash - Advanced AI-Powered Team Dashboard

OmniDash ist ein hochmodernes, kollaboratives Dashboard, das speziell für die Anforderungen moderner Teams entwickelt wurde. Es kombiniert Projektmanagement, Echtzeit-Kommunikation, Finanz-Tracking und KI-gestützte Assistenz in einer nahtlosen, performanten Benutzeroberfläche.

## 🚀 Hauptfunktionen

### 1. Personalisierbares Dashboard
*   **Widget-System**: Nutzer können ihre Startseite per Drag-and-Drop aus verschiedenen Modulen (Statistiken, Performance, Aktien, News, Aufgaben) zusammenstellen.
*   **Individuelle Layouts**: Jedes Teammitglied speichert seine eigene bevorzugte Ansicht direkt in seinem Profil.

### 2. Echtzeit-Kollaboration
*   **Team-Chat**: Globaler Chat für den schnellen Austausch zwischen allen Mitgliedern.
*   **Präsenz-Anzeige**: Dank Heartbeat-System siehst du sofort, wer gerade online ist oder wann ein Mitglied zuletzt aktiv war.

### 3. Finanz-Tracker & Budgeting
*   **Budgetverwaltung**: Erstelle projektspezifische Budgets und überwache die Auslastung.
*   **Ausgabenerfassung**: Dokumentiere jede Ausgabe und ordne sie Kategorien wie Software, Marketing oder Hardware zu.
*   **Visualisierungen**: Integrierte Charts zeigen dir auf einen Blick, wie viel vom Budget noch übrig ist.

### 4. Intelligente KI-Assistenz
*   **Gemini Integration**: Nutze die Power von Googles Gemini AI, um Aufgaben zu planen, Code-Snippets zu optimieren oder Zusammenfassungen zu erstellen.

### 5. Task & Projektmanagement
*   **Erweitertes Kanban**: Verwalte Aufgaben mit Checklisten, Prioritäten und detaillierten Beschreibungen.
*   **Projektübersicht**: Behalte den Fortschritt all deiner Projekte im Blick.

### 6. Dokumentenverwaltung
*   **Zentrales Repository**: Speichere und organisiere Projektdokumente, Bilder und Texte mit Filterfunktionen und verschiedenen Ansichtsmodi (Grid/Liste).

---

## 🛠 Tech Stack

*   **Frontend**: React 18, Vite, Tailwind CSS
*   **State & Database**: Firebase (Authentication & Cloud Firestore)
*   **Animationen**: Framer Motion (`motion/react`)
*   **Charts**: Recharts (D3-basiert)
*   **Icons**: Lucide React
*   **Backend**: Node.js / Express (Proxy für System-Dienste)

---

## 💻 Installation & Entwicklung

### Voraussetzungen
*   Node.js (v18 oder höher)
*   npm oder yarn

### Setup
1. Repository klonen:
   ```bash
   git clone <repository-url>
   ```
2. Abhängigkeiten installieren:
   ```bash
   npm install
   ```
3. Umgebungsvariablen konfigurieren:
   Erstelle eine `.env` Datei basierend auf `.env.example` und trage deine Firebase-Zugangsdaten sowie den Gemini API Key ein.

4. Entwicklungsserver starten:
   ```bash
   npm run dev
   ```

### Build für Produktion
```bash
npm run build
```

---

## 🔒 Sicherheit
Das System nutzt ein striktes **Attribute-Based Access Control (ABAC)** System über Firebase Security Rules, um Daten auf Nutzer- und Rollenebene zu schützen (Owner, Admin, User).

---

## 📄 Lizenz
Dieses Projekt ist unter der MIT-Lizenz lizenziert.
