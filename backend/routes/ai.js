import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { tenantAuth } from '../middleware/tenantAuth.js';
import dbManager from '../utils/DatabaseManager.js';

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

const SYSTEM_INSTRUCTION = `You are Study AI, a world-class academic tutor and learning assistant embedded within an educational institution CRM.
You serve students and faculty across disciplines including Computer Science, Software Engineering, Mathematics, Data Science, Electrical Engineering, Physics, and General STEM.

Core Responsibilities:
1. Provide accurate, clear, and comprehensive explanations of concepts, formulas, algorithms, and theory.
2. Provide step-by-step solutions to mathematical, algorithmic, and engineering problems.
3. Structure your responses with clean Markdown, clear headings, code blocks with syntax highlighting where applicable, and bulleted takeaways.
4. Help students prepare for exams, revise core topics, generate practice questions, and clarify assignment doubts.
5. If analyzing uploaded documents or notes (PDF, DOCX, TXT, or images), extract key definitions, summarize chapters, and answer questions grounded directly in the provided material.
6. Clearly distinguish AI conceptual guidance from official institutional records: remind users that official marks, attendance status, and degree evaluations are recorded in the university database.
`;

/**
 * POST /api/ai/chat
 * Conversational learning assistant for Teacher and Student roles only.
 * Admins are strictly prohibited from Study AI to maintain role segregation.
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

    const { prompt, history, attachment } = req.body;

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
        message: 'Study AI service is ready, but the server GEMINI_API_KEY environment variable is not configured. Please configure GEMINI_API_KEY in your hosting environment (Settings > Secrets or Vercel Environment Variables).',
      });
    }

    // Build contents structure
    const contents = [];

    // Add prior conversation history (limited to last 10 turns to avoid token overflow)
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

    // Process optional attachment
    if (attachment && attachment.data) {
      const mime = attachment.mimeType || 'text/plain';
      if (mime.startsWith('image/')) {
        // Base64 inline image data
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
        // Text / DOCX raw extracted text
        const textContent = attachment.textContent || attachment.data;
        currentParts.push({
          text: `[Attached Document: ${attachment.name || 'document'}]\n${textContent.slice(0, 30000)}`,
        });
      }
    }

    currentParts.push({ text: prompt.trim() });

    contents.push({
      role: 'user',
      parts: currentParts,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    const responseText = response.text || 'I could not generate an answer. Please try rephrasing your question.';

    // Log query in activity log
    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user?.institutionName || '',
      actorName: req.user?.fullName || req.user?.username,
      actorRole: req.user?.role,
      actionCategory: 'STUDY_AI',
      description: `Study AI consultation on: "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"`,
    }).catch(() => null);

    res.json({
      success: true,
      text: responseText,
      model: 'gemini-3.8-flash',
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
        message: 'Study AI requires a valid Google Gemini API key. Please configure a valid GEMINI_API_KEY in your hosting environment (Settings > Secrets or Vercel Environment Variables).',
      });
    }

    res.status(500).json({
      error: 'AiGenerationFailed',
      message: err.message || 'An error occurred while contacting Study AI. Please try again.',
    });
  }
});

export default router;
