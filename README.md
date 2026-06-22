# Coaching-Trainer 🎧

Eine Web-App, mit der Teilnehmer deines Coaching-Lehrgangs das **Führen eines vollständigen Coaching-Gesprächs** üben können. Die App spielt einen **virtuellen Klienten**: Er schildert ein Anliegen und reagiert wie ein echter Coachee auf die Fragen des angehenden Coaches – von der Problemschilderung über Zieldefinition, Auftragsklärung und Lösungsbild bis zu konkreten Maßnahmen.

Eingabe per **Tastatur** oder **Mikrofon** (Smartphone/Browser-Spracheingabe).

---

## Wichtig zum API-Key (bitte lesen)

Der KI-Schlüssel liegt **auf dem Server** (als Environment-Variable bei Vercel), nicht im HTML. Teilnehmer bekommen ihn dadurch **nie** zu sehen. Genau dafür gibt es den kleinen Proxy in `api/chat.js`. Lade den Key niemals direkt ins `index.html` – dort wäre er für jeden sichtbar.

Die Nutzung läuft über **dein** Anthropic-Konto, d. h. die Kosten der Gespräche trägst du. Sonnet ist günstig; ein komplettes Übungsgespräch kostet typischerweise nur wenige Cent.

---

## Was liegt hier?

```
index.html      → die App (Oberfläche, Chat, Mikrofon)
api/chat.js     → Backend-Proxy zur Anthropic-API (versteckt den Key)
package.json    → minimale Projektdatei
README.md       → diese Anleitung
```

---

## Deployment auf Vercel (empfohlen, kostenlos)

### 1. Anthropic API-Key holen
1. Konto anlegen / einloggen auf https://console.anthropic.com
2. Unter **API Keys** einen neuen Key erstellen und kopieren (beginnt mit `sk-ant-...`).
3. Unter **Billing** ein kleines Guthaben aufladen (z. B. 5 €).

### 2. Projekt zu Vercel bringen
Am einfachsten ohne Git:
1. Konto anlegen auf https://vercel.com (z. B. mit Google-Login).
2. Installiere einmalig das Vercel-Tool und deploye den Ordner:
   ```bash
   npm i -g vercel
   cd <dieser-ordner>
   vercel
   ```
   Folge den Fragen (Projektname bestätigen, Rest mit Enter).

   *Alternative ohne Terminal:* Lege die Dateien in ein GitHub-Repository und klicke auf vercel.com „Add New… → Project → Import“.

### 3. Den API-Key als Environment-Variable hinterlegen
1. Im Vercel-Dashboard das Projekt öffnen → **Settings → Environment Variables**.
2. Neue Variable anlegen:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** dein Key (`sk-ant-...`)
   - Für **Production** (und gern auch Preview/Development) aktivieren.
3. Speichern.

### 4. Neu deployen
Damit der Key wirksam wird, einmal erneut deployen:
```bash
vercel --prod
```
(oder im Dashboard unter **Deployments → … → Redeploy**)

### 5. Fertig
Du bekommst eine URL wie `https://coaching-trainer-xyz.vercel.app`. Diesen Link gibst du den Teilnehmern. Sie öffnen ihn am Handy oder PC, wählen einen Klienten und starten.

---

## Lokal testen (optional, für dich)

```bash
npm i -g vercel
cd <dieser-ordner>
# Key lokal setzen:
echo "ANTHROPIC_API_KEY=sk-ant-DEIN-KEY" > .env.local
vercel dev
```
Dann im Browser http://localhost:3000 öffnen.

> Hinweis: Wenn du `index.html` einfach per Doppelklick öffnest (ohne Server), funktioniert die KI **nicht**, weil der Proxy `/api/chat` fehlt. Du siehst dann nur die Oberfläche.

---

## Mikrofon / Spracheingabe

- Funktioniert über die Web Speech API des Browsers (Sprache: Deutsch, `de-DE`).
- Am besten unterstützt in **Chrome** (Android/Desktop) und **Safari** (iPhone/iPad).
- Beim ersten Tippen auf das Mikrofon fragt der Browser nach Mikrofon-Erlaubnis.
- Voraussetzung: Die App läuft über **HTTPS** (bei Vercel automatisch gegeben).
- Wenn ein Browser keine Spracheingabe unterstützt, wird das Mikrofon-Symbol automatisch ausgeblendet; Tastatur funktioniert immer.

---

## Anpassen

**Klienten-Beispiele ändern/ergänzen:** in `index.html` das Array `PERSONAS` bearbeiten. Jede Persona hat `name`, `tag`, `short` (Karten-Text) und `brief` (verdeckte Rollenanweisung an die KI).

**Verhalten des Klienten anpassen:** in `api/chat.js` die Funktion `systemPrompt(...)` bearbeiten – dort steht, wie der Klient reagiert.

**Modell wechseln:** in `api/chat.js` die Konstante `MODEL` oben anpassen.

**Texte/Design:** alles in `index.html` (CSS oben im `<style>`-Block).
