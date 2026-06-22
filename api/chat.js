// Vercel Serverless Function: /api/chat
// Proxy zur Anthropic-API. Der API-Key liegt sicher als Environment-Variable
// auf dem Server und wird NIE an den Browser ausgeliefert.
//
// Benötigte Environment-Variable in Vercel:  ANTHROPIC_API_KEY

const MODEL = "claude-sonnet-4-5"; // bei Bedarf anpassbar

function systemPrompt(personaBrief) {
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
    const { persona = null, isStart = false, messages = [] } = body;

    // Konversation aufbauen
    const convo = Array.isArray(messages)
      ? messages
          .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .map(m => ({ role: m.role, content: m.content }))
      : [];

    // Beim Start gibt es noch keine echte Coach-Nachricht.
    // Wir geben dem Klienten einen verdeckten Auftrag, sein Anliegen zu schildern.
    if (isStart || convo.length === 0) {
      convo.push({
        role: "user",
        content:
          "[Der Coach hat dich gerade begrüßt und fragt offen, was dich heute herführt. Schildere jetzt mit eigenen Worten dein Anliegen – kurz, persönlich und so, wie ein Mensch zu Beginn eines Coachings davon erzählen würde. Stelle dich kurz mit Vornamen vor.]"
      });
    }

    // Anthropic erwartet, dass die erste Nachricht von 'user' kommt – ist hier gegeben.
    const anthropicReq = {
      model: MODEL,
      max_tokens: 400,
      system: systemPrompt(persona),
      messages: convo
    };

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(anthropicReq)
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("Anthropic error:", r.status, txt);
      res.status(502).json({ error: "KI-Dienst antwortet nicht (" + r.status + ")." });
      return;
    }

    const data = await r.json();
    const reply = Array.isArray(data.content)
      ? data.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim()
      : "";

    res.status(200).json({ reply: reply || "(keine Antwort)" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Interner Serverfehler." });
  }
}
