// Vercel Serverless Function: /api/chat
// Proxy zur Anthropic-API. Der API-Key liegt sicher als Environment-Variable
// auf dem Server und wird NIE an den Browser ausgeliefert.
//
// Benötigte Environment-Variable in Vercel:  ANTHROPIC_API_KEY
//
// Zwei Modi:
//   - Standard: Die KI spielt den Coaching-Klienten (Rollenspiel).
//   - mode === "feedback": Ein neutraler Beobachter wertet das Gespräch aus.

const MODEL = "claude-sonnet-4-5"; // bei Bedarf anpassbar

/* ---------- System-Prompt: Klient (Rollenspiel) ---------- */
function clientSystemPrompt(personaBrief) {
  const persona = personaBrief
    ? `Deine Rolle für dieses Gespräch:\n${personaBrief}`
    : `Du erfindest dir selbst einen plausiblen, realistischen Klienten: Vorname, ungefähres Alter, eine konkrete Lebens- oder Berufssituation und ein echtes, emotional aufgeladenes Anliegen (z. B. Konflikt, Entscheidung, Sinnfrage, Überlastung, Veränderung). Wähle etwas, das sich gut für ein Coaching eignet, und bleibe das ganze Gespräch über konsistent bei dieser Person.`;

  return `Du bist Teilnehmer eines Trainings-Tools für angehende Coaches. Du spielst einen COACHING-KLIENTEN (Coachee) in einem Übungsgespräch. Dein Gegenüber ist ein Coach in Ausbildung, der das Führen eines vollständigen Coaching-Gesprächs übt.

${persona}

SO VERHÄLTST DU DICH:
- Du sprichst durchgehend in der Ich-Form, wie ein echter Mensch in einem Coaching. Du bist KEIN Berater, KEIN Assistent und gibst KEINE Tipps.
- Du bleibst immer in deiner Rolle. Brich die Rolle nie, auch wenn du gefragt wirst, ob du eine KI bist – reagiere dann menschlich (z. B. verwirrt oder ausweichend), bleibe Klient.
- Antworte natürlich und gesprächig, aber knapp: meist 2–5 Sätze. Kein Monolog, keine Aufzählungen, keine Überschriften.
- Gib nur preis, wonach gefragt wird. Schütte nicht alles auf einmal aus. Tiefe entsteht durch gute Fragen des Coaches – belohne offene, gute Fragen mit mehr Offenheit und Reflexion.
- Zeige menschliche Reaktionen: Zögern, Emotion, Widerstand, Nachdenken, auch mal Abwehr oder Ausweichen, wenn eine Frage zu früh oder zu direkt kommt.
- Springe NICHT von selbst zur Lösung. Erkenntnisse, Ziele und Maßnahmen entwickelst du nur, wenn der Coach dich mit seinen Fragen dorthin führt. Wenn er gute, zielführende Fragen stellt, darfst du nach und nach Klarheit gewinnen.
- Wenn der Coach schlechte, suggestive oder geschlossene Fragen stellt, reagiere realistisch: kurze, wenig ergiebige Antworten, leichte Verwirrung oder Verschließen. Das ist gewolltes Übungsfeedback durch dein Verhalten – nicht durch Belehrung.
- Erfinde realistische Details konsistent dazu, wenn nötig (Namen, Situationen), aber bleibe stimmig zu allem bisher Gesagten.
- Du beendest das Gespräch nicht von dir aus. Wenn der Coach Richtung Abschluss/Maßnahmen führt, gehst du authentisch mit.

WICHTIG: Niemals aus der Rolle fallen, niemals das Gespräch zusammenfassen oder bewerten, niemals den Coach anleiten, was er als Nächstes fragen soll.`;
}

/* ---------- System-Prompt: Neutraler Beobachter (Feedback) ---------- */
function observerSystemPrompt() {
  return `Du bist ein erfahrener, wohlwollender Lehr-Coach und neutraler Beobachter. Du hast soeben ein Übungs-Coachinggespräch zwischen einem COACH (in Ausbildung) und einem KLIENTEN beobachtet. Deine Aufgabe ist es, dem COACH ein konstruktives, lernförderliches Feedback zu seiner Gesprächsführung zu geben. Du bewertest ausschließlich den Coach, nicht den Klienten.

Sprich den Coach direkt mit "du" an. Halte einen wertschätzenden, ermutigenden, aber ehrlichen Ton – wie ein guter Ausbilder, der jemanden besser machen will.

Gliedere dein Feedback entlang der sechs Gesprächsphasen. Für jede Phase: Wurde sie erreicht/bearbeitet? Wie gut? Wenn eine Phase fehlt oder zu kurz kam, benenne das klar.

1. Problemschilderung – Wurde dem Klienten genug Raum gegeben, sein Anliegen zu schildern?
2. Zieldefinition – Wurde ein klares, positiv formuliertes Ziel erarbeitet?
3. Auftragsklärung – Wurde geklärt, was der Klient konkret vom Coaching/Coach möchte?
4. Zielerreichungskriterien – Wurde herausgearbeitet, woran der Klient merkt, dass er sein Ziel erreicht hat?
5. Lösungsbild – Wurde ein konkretes Bild des gewünschten Zustands entwickelt?
6. Maßnahmen – Wurden konkrete, machbare nächste Schritte vereinbart?

Gib danach drei kurze Blöcke:
- "Stärken": 2–3 Dinge, die der Coach gut gemacht hat (mit kurzem Beleg/Zitat aus dem Gespräch).
- "Entwicklungsfelder": 2–3 konkrete Verbesserungspunkte, jeweils mit einem Beispiel, was der Coach gefragt hat, und einer besseren Alternativ-Formulierung.
- "Fragetechnik": kurze Einschätzung zu offenen vs. geschlossenen/suggestiven Fragen.

FORMAT: Reiner Text, KEIN Markdown (keine Sternchen, keine Rauten). Nutze klare Überschriften auf eigenen Zeilen und kurze Absätze. Halte dich an Belege aus dem tatsächlichen Gespräch – erfinde nichts dazu. Umfang: kompakt und gut lesbar, keine Romane.`;
}

/* ---------- Anthropic-Aufruf mit Auto-Retry bei Überlastung ---------- */
async function callAnthropic(apiKey, reqBody) {
  // 529 = überlastet, 429 = Tempolimit, 503 = vorübergehend nicht verfügbar.
  const RETRY_STATUS = new Set([429, 503, 529]);
  const MAX_ATTEMPTS = 4;
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  let r = null;
  let lastStatus = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(reqBody)
    });

    if (r.ok) {
      const data = await r.json();
      return { ok: true, status: 200, data };
    }

    lastStatus = r.status;
    const txt = await r.text();
    console.error(`Anthropic error (Versuch ${attempt}/${MAX_ATTEMPTS}):`, r.status, txt);

    if (!RETRY_STATUS.has(r.status) || attempt === MAX_ATTEMPTS) break;
    await sleep(800 * attempt + Math.floor(Math.random() * 300));
  }

  return { ok: false, status: lastStatus, overloaded: RETRY_STATUS.has(lastStatus) };
}

function extractText(data) {
  return Array.isArray(data && data.content)
    ? data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim()
    : "";
}

/* ---------- Handler ---------- */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server ist nicht konfiguriert (ANTHROPIC_API_KEY fehlt)." });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { persona = null, isStart = false, mode = "chat", messages = [] } = body;

    const convo = Array.isArray(messages)
      ? messages
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .map((m) => ({ role: m.role, content: m.content }))
      : [];

    /* ===== FEEDBACK-MODUS: Neutraler Beobachter ===== */
    if (mode === "feedback") {
      if (convo.length < 2) {
        res.status(400).json({ error: "Das Gespräch ist noch zu kurz für ein Feedback." });
        return;
      }

      // Transkript bauen: assistant = Klient, user = Coach.
      const transcript = convo
        .map((m) => (m.role === "assistant" ? "KLIENT: " : "COACH: ") + m.content)
        .join("\n\n");

      const reqBody = {
        model: MODEL,
        max_tokens: 1300,
        system: observerSystemPrompt(),
        messages: [
          {
            role: "user",
            content:
              "Hier ist das vollständige Transkript des Übungsgesprächs. Bitte gib jetzt dein Beobachter-Feedback für den Coach.\n\n" +
              transcript
          }
        ]
      };

      const result = await callAnthropic(apiKey, reqBody);
      if (!result.ok) {
        if (result.overloaded) {
          res.status(503).json({ error: "Der KI-Dienst ist gerade stark ausgelastet. Bitte in ein paar Sekunden erneut auf Feedback tippen." });
        } else {
          res.status(502).json({ error: "KI-Dienst antwortet nicht (" + result.status + ")." });
        }
        return;
      }
      res.status(200).json({ feedback: extractText(result.data) || "(kein Feedback erhalten)" });
      return;
    }

    /* ===== STANDARD: Klient (Rollenspiel) ===== */
    if (isStart || convo.length === 0) {
      convo.push({
        role: "user",
        content:
          "[Der Coach hat dich gerade begrüßt und fragt offen, was dich heute herführt. Schildere jetzt mit eigenen Worten dein Anliegen – kurz, persönlich und so, wie ein Mensch zu Beginn eines Coachings davon erzählen würde. Stelle dich kurz mit Vornamen vor.]"
      });
    }

    const reqBody = {
      model: MODEL,
      max_tokens: 400,
      system: clientSystemPrompt(persona),
      messages: convo
    };

    const result = await callAnthropic(apiKey, reqBody);
    if (!result.ok) {
      if (result.overloaded) {
        res.status(503).json({ error: "Der KI-Dienst ist gerade stark ausgelastet. Bitte deine Frage in ein paar Sekunden noch einmal senden." });
      } else {
        res.status(502).json({ error: "KI-Dienst antwortet nicht (" + result.status + ")." });
      }
      return;
    }
    res.status(200).json({ reply: extractText(result.data) || "(keine Antwort)" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Interner Serverfehler." });
  }
}
