import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import { tenantAuth } from '../middleware/tenantAuth.js';
import dbManager from '../utils/DatabaseManager.js';

dotenv.config();
if (!process.env.GEMINI_API_KEY && fs.existsSync('.env.example')) {
  dotenv.config({ path: '.env.example' });
}

const router = express.Router();
router.use(tenantAuth);

/**
 * Initialize server-side Google GenAI instance with telemetry User-Agent
 */
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const SYSTEM_INSTRUCTION = `You are Study AI, an advanced, world-class academic tutor and institutional learning assistant embedded in an Educational Institution CRM.
You serve faculty and students across disciplines, including Computer Science, Software Engineering, Discrete Mathematics, Linear Algebra, Calculus, Physics, Electrical Engineering, and general STEM academia.

Core Academic Principles:
1. RELEVANCE & ACCURACY:
   - Carefully read and parse the user's complete prompt and any attached study material or problem images before answering.
   - Answer the exact question asked without generic filler or evasive answers.
   - For concise questions, give direct, focused answers.
   - For complex, mathematical, or algorithmic questions, provide step-by-step reasoning, formula derivations, code implementations with time/space complexities, and edge cases.
   - If information is insufficient or ambiguous, state what is known and clarify what is missing. Never invent facts, formulas, or academic citations.

2. HOMEWORK & ATTACHMENT SOLVING:
   - When an image or document (PDF, DOCX, text) is attached, analyze the actual content carefully.
   - Transcribe or reference the specific problem, numbers, equations, and diagrams from the user's attachment.
   - Walk through the solution step-by-step so the student can learn the methodology.

3. CONVERSATIONAL MEMORY:
   - Maintain context across follow-up queries. If the student asks "can you explain step 2 in more detail?" or "write tests for that", refer directly to the prior solution.

4. FORMATTING:
   - Use clean, readable Markdown with structured headers (##, ###), bulleted highlights, and bold terminology.
   - Render mathematical equations cleanly using LaTeX notation or clear mathematical typesetting.
   - Write code blocks with language identifiers (\`\`\`python, \`\`\`typescript, \`\`\`java, \`\`\`cpp).

5. INSTITUTIONAL BOUNDARY:
   - Remind users when relevant that official grades, course enrollment, and attendance records are stored authoritatively in the institution CRM database.
`;

function isImageGenerationPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') return false;
  const p = prompt.trim().toLowerCase();
  const patterns = [
    /\b(generate|create|draw|make|render|illustrate|produce|show me)\b.*\b(an?\s+)?(image|illustration|diagram|picture|drawing|sketch|infographic|visual|figure)\b/i,
    /\b(image|illustration|diagram|picture|drawing|figure)\s+of\b/i,
    /^(can you |please )?(draw|illustrate|render)\b/i,
  ];
  return patterns.some((rx) => rx.test(p));
}

async function generateEducationalImage(ai, prompt) {
  let imageUrl = null;
  let explanation = '';
  let modelUsed = 'gemini-3.1-flash-lite-image';

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: {
        parts: [
          {
            text: `Generate a clear, accurate, high-quality educational illustration/diagram for: "${prompt}". Clean textbook diagram style with distinct labels.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: '1:1',
        },
      },
    });

    if (res.candidates?.[0]?.content?.parts) {
      for (const part of res.candidates[0].content.parts) {
        if (part.inlineData) {
          const mime = part.inlineData.mimeType || 'image/png';
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          explanation += part.text;
        }
      }
    }
  } catch (err) {
    console.warn('[Study AI] gemini-3.1-flash-lite-image attempt:', err.message);
  }

  return { imageUrl, explanation, modelUsed };
}

function buildGeminiContents(history, prompt, attachment) {
  const contents = [];

  // Add prior conversation history (limited to last 10 turns)
  if (Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-10);
    for (const turn of recentHistory) {
      if (!turn.content) continue;
      contents.push({
        role: turn.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(turn.content) }],
      });
    }
  }

  // Current turn parts
  const currentParts = [];

  if (attachment && attachment.data) {
    const mime = attachment.mimeType || 'text/plain';
    if (mime.startsWith('image/')) {
      const cleanBase64 = attachment.data.includes(',')
        ? attachment.data.split(',')[1]
        : attachment.data;
      currentParts.push({
        inlineData: {
          mimeType: mime,
          data: cleanBase64,
        },
      });
    } else if (mime === 'application/pdf') {
      const cleanBase64 = attachment.data.includes(',')
        ? attachment.data.split(',')[1]
        : attachment.data;
      currentParts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: cleanBase64,
        },
      });
    } else {
      const textContent = attachment.textContent || attachment.data;
      currentParts.push({
        text: `[Attached Study Material: ${attachment.name || 'document'}]\n${textContent.slice(0, 35000)}`,
      });
    }
  }

  currentParts.push({ text: prompt.trim() });

  contents.push({
    role: 'user',
    parts: currentParts,
  });

  return contents;
}

/**
 * POST /api/ai/stream
 * Server-Sent Events (SSE) streaming endpoint for near-instant perceived latency.
 * Restricted to Teacher and Student roles only.
 */
router.post('/stream', async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (userRole === 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Study AI is reserved for educators and students. Institutional administrators monitor academic analytics via the Admin Dashboard.',
      });
    }

    const prompt = req.body.prompt || req.body.message || req.body.question;
    const { history, attachment } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        error: 'MissingPrompt',
        message: 'Please provide a question or topic for Study AI.',
      });
    }

    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'ApiKeyMissing',
        message: 'Study AI service is ready, but the server GEMINI_API_KEY environment variable is not configured.',
      });
    }

    // Explicit Image Generation Request
    if (isImageGenerationPrompt(prompt) && (!attachment || !attachment.data)) {
      const { imageUrl, explanation, modelUsed } = await generateEducationalImage(ai, prompt);
      if (imageUrl) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        if (res.flushHeaders) res.flushHeaders();
        res.write(
          `data: ${JSON.stringify({
            event: 'image',
            image: imageUrl,
            text: explanation || `Here is the generated educational illustration for: "${prompt.trim()}".`,
            model: modelUsed,
          })}\n\n`
        );
        res.write('data: [DONE]\n\n');
        return res.end();
      }
    }

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (res.flushHeaders) res.flushHeaders();

    const contents = buildGeminiContents(history, prompt, attachment);

    // Call Gemini with resilient model fallback (gemini-3.1-flash-lite -> gemini-3.8-flash)
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    let streamSuccess = false;
    let usedModel = candidateModels[0];

    for (const modelCandidate of candidateModels) {
      try {
        usedModel = modelCandidate;
        const streamResponse = await ai.models.generateContentStream({
          model: modelCandidate,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.7,
          },
        });

        for await (const chunk of streamResponse) {
          if (chunk.text) {
            res.write(`data: ${JSON.stringify({ event: 'chunk', text: chunk.text })}\n\n`);
          }
        }
        streamSuccess = true;
        break;
      } catch (streamErr) {
        console.warn(`[Study AI Stream] Model ${modelCandidate} stream error:`, streamErr.message);
      }
    }

    if (!streamSuccess) {
      // Direct generateContent fallback if streaming suffered a demand spike or network interruption
      try {
        const directRes = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.7,
          },
        });
        const replyText = directRes.text || directRes.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (replyText) {
          res.write(`data: ${JSON.stringify({ event: 'chunk', text: replyText })}\n\n`);
          streamSuccess = true;
        }
      } catch (fallbackErr) {
        console.error('[Study AI Stream] Direct fallback failed:', fallbackErr.message);
        throw fallbackErr;
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

    // Log query in background
    dbManager
      .logActivity({
        databaseName: req.databaseName,
        institutionName: req.user?.institutionName || '',
        actorName: req.user?.fullName || req.user?.username,
        actorRole: req.user?.role,
        actionCategory: 'STUDY_AI',
        description: `Study AI query (${usedModel}): "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"`,
      })
      .catch(() => null);
  } catch (err) {
    console.error('[Study AI Stream] Error generating response:', err.message);
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'AiGenerationFailed',
        message: err.message || 'An error occurred while contacting Study AI.',
      });
    }
    res.write(`data: ${JSON.stringify({ event: 'error', message: err.message || 'Stream generation failed.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

/**
 * POST /api/ai/chat
 * Standard JSON endpoint for single-turn or batch requests.
 * Restricted to Teacher and Student roles only.
 */
router.post('/chat', async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (userRole === 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Study AI is reserved for educators and students. Institutional administrators monitor academic analytics via the Admin Dashboard.',
      });
    }

    const prompt = req.body.prompt || req.body.message || req.body.question;
    const { history, attachment } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        error: 'MissingPrompt',
        message: 'Please provide a question or topic for Study AI.',
      });
    }

    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'ApiKeyMissing',
        message: 'Study AI service is ready, but the server GEMINI_API_KEY environment variable is not configured.',
      });
    }

    // Explicit Image Generation Request
    if (isImageGenerationPrompt(prompt) && (!attachment || !attachment.data)) {
      const { imageUrl, explanation, modelUsed } = await generateEducationalImage(ai, prompt);
      if (imageUrl) {
        return res.json({
          success: true,
          text: explanation || `Here is the requested educational illustration for: "${prompt.trim()}".`,
          image: imageUrl,
          model: modelUsed,
        });
      }
    }

    const contents = buildGeminiContents(history, prompt, attachment);

    let response;
    let usedModel = 'gemini-3.1-flash-lite';
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7,
        },
      });
    } catch (primaryErr) {
      console.warn('[Study AI Chat] Primary model attempt failed, falling back:', primaryErr.message);
      usedModel = 'gemini-3.8-flash';
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7,
        },
      });
    }

    const responseText = response.text || 'I could not generate an answer. Please try rephrasing your question.';

    // Log query in activity log
    await dbManager
      .logActivity({
        databaseName: req.databaseName,
        institutionName: req.user?.institutionName || '',
        actorName: req.user?.fullName || req.user?.username,
        actorRole: req.user?.role,
        actionCategory: 'STUDY_AI',
        description: `Study AI consultation (${usedModel}): "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"`,
      })
      .catch(() => null);

    res.json({
      success: true,
      text: responseText,
      model: usedModel,
    });
  } catch (err) {
    console.error('[Study AI] Error generating response:', err.message);
    const isServiceUnavailable = Boolean(
      err.status === 503 ||
      err.status === 429 ||
      (err.message && (
        err.message.includes('503') ||
        err.message.includes('high demand') ||
        err.message.includes('UNAVAILABLE') ||
        err.message.includes('RESOURCE_EXHAUSTED') ||
        err.message.includes('temporarily')
      ))
    );
    const isApiKeyError = Boolean(
      err.status === 400 ||
      err.status === 403 ||
      (err.message && (
        err.message.includes('API key') ||
        err.message.includes('API_KEY') ||
        err.message.includes('not valid') ||
        err.message.includes('unregistered')
      ))
    );

    if (isServiceUnavailable) {
      return res.status(503).json({
        error: 'ServiceUnavailable',
        message: 'The AI model is currently experiencing high demand. Please try again in a few moments.',
      });
    }

    if (isApiKeyError) {
      return res.status(503).json({
        error: 'InvalidApiKey',
        message: 'Study AI requires a valid Google Gemini API key. Please configure GEMINI_API_KEY in your hosting environment.',
      });
    }

    res.status(500).json({
      error: 'AiGenerationFailed',
      message: err.message || 'An error occurred while contacting Study AI. Please try again.',
    });
  }
});

export default router;

