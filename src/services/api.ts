/**
 * Centralized API Service for Smart Institutional CRM
 * Interfaces with Express backend on /api/* (proxied to port 5001)
 * with JWT token and x-tenant-database header propagation.
 */

const BASE_URL = (import.meta.env.VITE_API_URL ? String(import.meta.env.VITE_API_URL).replace(/\/+$/, '') : '') + '/api';

function getAuthHeaders(databaseName?: string): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('smart_crm_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (databaseName) {
    headers['x-tenant-database'] = databaseName;
  }

  return headers;
}

async function safeJson<T = any>(res: Response, fallback: T): Promise<T> {
  try {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return (data ?? fallback) as T;
    }
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      console.warn(`[api] Expected JSON but received ${contentType || 'non-JSON'}:`, text.slice(0, 100));
      return fallback;
    }
  } catch (err) {
    console.warn('[api] Failed to parse JSON response:', err);
    return fallback;
  }
}

export const api = {
  // Health
  async getHealth() {
    const res = await fetch(`${BASE_URL}/health`);
    return safeJson(res, { status: 'offline' });
  },

  // Auth
  async login(username: string, password: string, databaseName?: string) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, databaseName }),
    });
    const data = await res.json();
    if (data.token && typeof window !== 'undefined') {
      localStorage.setItem('smart_crm_token', data.token);
    }
    return data;
  },

  async registerInstitution(payload: {
    institutionName: string;
    adminUsername: string;
    adminName: string;
    adminEmail: string;
    password: string;
    campusCode?: string;
  }) {
    const res = await fetch(`${BASE_URL}/auth/register-institution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.token && typeof window !== 'undefined') {
      localStorage.setItem('smart_crm_token', data.token);
    }
    return data;
  },

  async getCurrentUser(databaseName?: string) {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('smart_crm_token');
    }
  },

  // Users
  async getUsers(databaseName: string, role?: string) {
    const params = new URLSearchParams();
    if (role && role !== 'all') params.append('role', role);

    const res = await fetch(`${BASE_URL}/users?${params.toString()}`, {
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  async createUser(databaseName: string, userPayload: any) {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify(userPayload),
    });
    return res.json();
  },

  async updateUser(databaseName: string, userId: string, updates: any) {
    const res = await fetch(`${BASE_URL}/users/${userId}`, {
      method: 'PUT',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async deleteUser(databaseName: string, userId: string) {
    const res = await fetch(`${BASE_URL}/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  async batchCreateUsers(
    databaseName: string,
    users: any[]
  ): Promise<{
    success: boolean;
    message?: string;
    createdCount?: number;
    failedCount?: number;
    createdUsers?: any[];
    errors?: any[];
  }> {
    const res = await fetch(`${BASE_URL}/users/batch`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify({ users }),
    });
    return safeJson(res, { success: false, message: 'Batch user creation request failed.' });
  },

  async resetUserPassword(
    databaseName: string,
    userId: string,
    payload: { newPassword?: string; requirePasswordChange?: boolean }
  ): Promise<{
    success: boolean;
    message?: string;
    temporaryPassword?: string;
    user?: any;
    error?: string;
  }> {
    const res = await fetch(`${BASE_URL}/users/${userId}/reset-password`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify(payload),
    });
    return safeJson(res, { success: false, message: 'Password reset request failed.' });
  },

  // Study AI
  async askStudyAI(
    databaseName: string,
    prompt: string,
    history?: { role: 'user' | 'model'; content: string }[],
    attachment?: { name: string; mimeType: string; data: string; textContent?: string }
  ): Promise<{
    success: boolean;
    message?: string;
    text?: string;
    image?: string;
    model?: string;
  }> {
    const res = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify({ prompt, history, attachment }),
    });
    return safeJson(res, {
      success: false,
      message: 'Failed to communicate with Study AI service.',
    });
  },

  async streamStudyAI(
    databaseName: string,
    prompt: string,
    history: { role: 'user' | 'model'; content: string }[],
    attachment: { name: string; mimeType: string; data: string; textContent?: string } | undefined,
    onChunk: (accumulatedText: string) => void,
    onImage: (imageUrl: string, caption?: string) => void,
    signal?: AbortSignal
  ): Promise<{ success: boolean; message?: string; text?: string; image?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/ai/stream`, {
        method: 'POST',
        headers: getAuthHeaders(databaseName),
        body: JSON.stringify({ prompt, history, attachment }),
        signal,
      });

      if (!res.ok) {
        const errJson = await safeJson(res, { message: `Request failed with status ${res.status}` });
        return { success: false, message: errJson.message || `Request failed with status ${res.status}` };
      }

      if (!res.body) {
        return { success: false, message: 'Response body stream is not available.' };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';
      let receivedImage = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') {
            return { success: true, text: fullText, image: receivedImage };
          }
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.event === 'chunk' && parsed.text) {
              fullText += parsed.text;
              onChunk(fullText);
            } else if (parsed.event === 'image') {
              if (parsed.image) {
                receivedImage = parsed.image;
                onImage(parsed.image, parsed.text);
              }
              if (parsed.text) {
                fullText = parsed.text;
                onChunk(fullText);
              }
            } else if (parsed.event === 'error') {
              return { success: false, message: parsed.message || 'Stream generation failed.' };
            }
          } catch {
            // Ignore non-JSON stream chunks
          }
        }
      }

      return { success: true, text: fullText, image: receivedImage };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: true, message: 'Generation stopped.' };
      }
      return { success: false, message: err.message || 'Streaming communication error' };
    }
  },

  // Classes
  async getClasses(databaseName: string) {
    const res = await fetch(`${BASE_URL}/classes`, {
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  async createClass(databaseName: string, classPayload: any) {
    const res = await fetch(`${BASE_URL}/classes`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify(classPayload),
    });
    return res.json();
  },

  async allotStudent(databaseName: string, classId: string, studentId: string) {
    const res = await fetch(`${BASE_URL}/classes/${classId}/allot-student`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify({ studentId }),
    });
    return res.json();
  },

  async bulkAllotStudents(
    databaseName: string,
    classId: string,
    studentIds: string[]
  ): Promise<{
    success: boolean;
    message?: string;
    allottedCount?: number;
    class?: any;
    error?: string;
  }> {
    const res = await fetch(`${BASE_URL}/classes/${classId}/bulk-allot`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify({ studentIds }),
    });
    return safeJson(res, { success: false, message: 'Bulk class allotment request failed.' });
  },

  async deleteClass(databaseName: string, classId: string) {
    const res = await fetch(`${BASE_URL}/classes/${classId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  // Assignments
  async getAssignments(databaseName: string) {
    const res = await fetch(`${BASE_URL}/assignments`, {
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  async createAssignment(databaseName: string, payload: any) {
    const res = await fetch(`${BASE_URL}/assignments`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async submitAssignment(databaseName: string, assignmentId: string, payload: any) {
    const res = await fetch(`${BASE_URL}/assignments/${assignmentId}/submit`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async reviewSubmission(
    databaseName: string,
    assignmentId: string,
    studentId: string,
    action: 'accept' | 'reject' | 'reassign' | 'grade',
    marksObtained?: number,
    feedback?: string
  ) {
    const res = await fetch(`${BASE_URL}/assignments/${assignmentId}/submissions/${studentId}/review`, {
      method: 'PUT',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify({ action, marksObtained, feedback }),
    });
    return res.json();
  },

  async updateAssignment(databaseName: string, assignmentId: string, payload: any) {
    const res = await fetch(`${BASE_URL}/assignments/${assignmentId}`, {
      method: 'PUT',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async deleteAssignment(databaseName: string, assignmentId: string) {
    const res = await fetch(`${BASE_URL}/assignments/${assignmentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  // Quizzes
  async getQuizzes(databaseName: string) {
    const res = await fetch(`${BASE_URL}/quizzes`, {
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  async createQuiz(databaseName: string, payload: any) {
    const res = await fetch(`${BASE_URL}/quizzes`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async submitQuiz(databaseName: string, quizId: string, answers: any[]) {
    const res = await fetch(`${BASE_URL}/quizzes/${quizId}/submit`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify({ answers }),
    });
    return res.json();
  },

  async togglePublishQuiz(databaseName: string, quizId: string, isPublished: boolean) {
    const res = await fetch(`${BASE_URL}/quizzes/${quizId}/publish`, {
      method: 'PUT',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify({ isPublished }),
    });
    return res.json();
  },

  // Chat
  async getChatContacts(databaseName: string) {
    try {
      const res = await fetch(`${BASE_URL}/chat/contacts`, {
        headers: getAuthHeaders(databaseName),
      });
      return await safeJson(res, { contacts: [] });
    } catch (e: any) {
      console.warn('[api] getChatContacts error:', e.message);
      return { contacts: [] };
    }
  },

  async getChatMessages(databaseName: string, recipientId: string) {
    if (!recipientId || recipientId === 'undefined' || recipientId === 'null') {
      return { messages: [] };
    }
    try {
      const res = await fetch(`${BASE_URL}/chat/messages/${encodeURIComponent(recipientId)}`, {
        headers: getAuthHeaders(databaseName),
      });
      return await safeJson(res, { messages: [] });
    } catch (e: any) {
      console.warn('[api] getChatMessages error:', e.message);
      return { messages: [] };
    }
  },

  async sendChatMessage(
    databaseName: string,
    recipientId: string,
    textOrPayload: string | { text?: string; content?: string; message?: string; attachments?: any[]; callData?: any },
    attachments?: any[]
  ) {
    if (!recipientId || recipientId === 'undefined' || recipientId === 'null') {
      return { success: false, error: 'InvalidRecipient', message: 'Recipient is required.' };
    }
    let payload: any = {};
    if (typeof textOrPayload === 'string') {
      payload = { recipientId, text: textOrPayload, content: textOrPayload, message: textOrPayload, attachments };
    } else {
      payload = {
        recipientId,
        text: textOrPayload.text || textOrPayload.content || textOrPayload.message || '',
        content: textOrPayload.content || textOrPayload.text || textOrPayload.message || '',
        message: textOrPayload.message || textOrPayload.content || textOrPayload.text || '',
        ...textOrPayload,
      };
    }
    try {
      const res = await fetch(`${BASE_URL}/chat/messages`, {
        method: 'POST',
        headers: getAuthHeaders(databaseName),
        body: JSON.stringify(payload),
      });
      return await safeJson(res, { success: false, message: 'Server communication error' });
    } catch (e: any) {
      console.warn('[api] sendChatMessage error:', e.message);
      return { success: false, message: e.message || 'Failed to send message' };
    }
  },

  // Schedule
  async getSchedule(databaseName: string, filter?: { classId?: string; teacherId?: string }) {
    const params = new URLSearchParams();
    if (filter?.classId) params.append('classId', filter.classId);
    if (filter?.teacherId) params.append('teacherId', filter.teacherId);

    const res = await fetch(`${BASE_URL}/schedule?${params.toString()}`, {
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  async addScheduleSlot(databaseName: string, slotPayload: any) {
    const res = await fetch(`${BASE_URL}/schedule`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify(slotPayload),
    });
    return res.json();
  },

  async updateScheduleSlot(databaseName: string, slotId: string, slotPayload: any) {
    const res = await fetch(`${BASE_URL}/schedule/${slotId}`, {
      method: 'PUT',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify(slotPayload),
    });
    return res.json();
  },

  async deleteScheduleSlot(databaseName: string, slotId: string) {
    const res = await fetch(`${BASE_URL}/schedule/${slotId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  // Notices
  async getNotices(databaseName: string) {
    const res = await fetch(`${BASE_URL}/notices`, {
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  async createNotice(databaseName: string, payload: any) {
    const res = await fetch(`${BASE_URL}/notices`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async markNoticeRead(databaseName: string, noticeId: string) {
    const res = await fetch(`${BASE_URL}/notices/${noticeId}/read`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  async deleteNotice(databaseName: string, noticeId: string) {
    const res = await fetch(`${BASE_URL}/notices/${noticeId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  // Tenants & Audit
  async getTenants() {
    const res = await fetch(`${BASE_URL}/tenants`);
    return res.json();
  },

  async deleteTenant(databaseName: string) {
    const res = await fetch(`${BASE_URL}/tenants/${databaseName}`, {
      method: 'DELETE',
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  async getAuditLogs(databaseName: string, scope: 'tenant' | 'master' = 'tenant') {
    const res = await fetch(`${BASE_URL}/audit?scope=${scope}`, {
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  async getAnalytics(databaseName: string) {
    const res = await fetch(`${BASE_URL}/analytics`, {
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  // Academic Calendar
  async getCalendarEvents(
    databaseName: string,
    filter?: { category?: string; month?: string; classId?: string }
  ) {
    const params = new URLSearchParams();
    if (filter?.category) params.append('category', filter.category);
    if (filter?.month) params.append('month', filter.month);
    if (filter?.classId) params.append('classId', filter.classId);

    const res = await fetch(`${BASE_URL}/calendar?${params.toString()}`, {
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  async createCalendarEvent(databaseName: string, payload: any) {
    const res = await fetch(`${BASE_URL}/calendar`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async updateCalendarEvent(databaseName: string, eventId: string, payload: any) {
    const res = await fetch(`${BASE_URL}/calendar/${eventId}`, {
      method: 'PUT',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async deleteCalendarEvent(databaseName: string, eventId: string) {
    const res = await fetch(`${BASE_URL}/calendar/${eventId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  // Attendance
  async getAttendance(
    databaseName: string,
    filter?: { classId?: string; date?: string; month?: string }
  ) {
    const params = new URLSearchParams();
    if (filter?.classId) params.append('classId', filter.classId);
    if (filter?.date) params.append('date', filter.date);
    if (filter?.month) params.append('month', filter.month);

    const res = await fetch(`${BASE_URL}/attendance?${params.toString()}`, {
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  async getAttendanceSummary(databaseName: string) {
    const res = await fetch(`${BASE_URL}/attendance/summary`, {
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  async markAttendance(
    databaseName: string,
    payload: { classId: string; date: string; records: any[] }
  ) {
    const res = await fetch(`${BASE_URL}/attendance`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async getTeacherAttendance(databaseName: string, date?: string) {
    const url = date ? `${BASE_URL}/attendance/teachers?date=${encodeURIComponent(date)}` : `${BASE_URL}/attendance/teachers`;
    const res = await fetch(url, {
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  async saveTeacherAttendance(
    databaseName: string,
    payload: { teacherId: string; date: string; status: string; checkInTime?: string; notes?: string }
  ) {
    const res = await fetch(`${BASE_URL}/attendance/teachers`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  // Marks & Gradebook Spreadsheet
  async getMarks(
    databaseName: string,
    filter?: { classId?: string; subject?: string; assessmentTitle?: string }
  ) {
    const params = new URLSearchParams();
    if (filter?.classId) params.append('classId', filter.classId);
    if (filter?.subject) params.append('subject', filter.subject);
    if (filter?.assessmentTitle) params.append('assessmentTitle', filter.assessmentTitle);

    const res = await fetch(`${BASE_URL}/marks?${params.toString()}`, {
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  async saveMarksBatch(databaseName: string, payload: any) {
    const res = await fetch(`${BASE_URL}/marks/batch`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify(payload),
    });
    const cType = res.headers.get('content-type') || '';
    if (!cType.includes('application/json')) {
      const text = await res.text();
      return { success: false, ok: false, message: `Server error (${res.status}): ${text.slice(0, 150)}` };
    }
    return res.json();
  },

  async publishMarks(
    databaseName: string,
    payload: { classId: string; subject?: string; assessmentTitle?: string; isPublished?: boolean }
  ) {
    const res = await fetch(`${BASE_URL}/marks/publish`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify(payload),
    });
    const cType = res.headers.get('content-type') || '';
    if (!cType.includes('application/json')) {
      const text = await res.text();
      return { success: false, ok: false, message: `Server error (${res.status}): ${text.slice(0, 150)}` };
    }
    return res.json();
  },

  async getStudentMarksSummary(databaseName: string) {
    const res = await fetch(`${BASE_URL}/marks/student-summary`, {
      headers: getAuthHeaders(databaseName),
    });
    return res.json();
  },

  // Class Roster Import
  async importClassRoster(databaseName: string, classId: string, students: any[]): Promise<{
    success: boolean;
    message: string;
    importedCount?: number;
    createdCount?: number;
    updatedCount?: number;
    skippedCount?: number;
    errors?: any[];
  }> {
    const res = await fetch(`${BASE_URL}/classes/${classId}/import-roster`, {
      method: 'POST',
      headers: getAuthHeaders(databaseName),
      body: JSON.stringify({ students }),
    });
    return await safeJson(res, { success: false, message: 'Server communication error during roster import.' });
  },

  // Calling & WebRTC Signaling
  async getActiveCall(databaseName: string): Promise<{ call: any }> {
    try {
      const res = await fetch(`${BASE_URL}/calls/active`, {
        headers: getAuthHeaders(databaseName),
      });
      return await safeJson(res, { call: null });
    } catch {
      return { call: null };
    }
  },

  async initiateCall(
    databaseName: string,
    payload: { recipientId: string; callType: 'audio' | 'video'; offerSdp?: any }
  ): Promise<{ success: boolean; message?: string; call?: any }> {
    try {
      const res = await fetch(`${BASE_URL}/calls/initiate`, {
        method: 'POST',
        headers: getAuthHeaders(databaseName),
        body: JSON.stringify(payload),
      });
      return await safeJson(res, { success: false, message: 'Failed to initiate call.' });
    } catch (err: any) {
      return { success: false, message: err.message || 'Call initiation failed.' };
    }
  },

  async respondCall(
    databaseName: string,
    callId: string,
    payload: { action: 'answer' | 'decline'; answerSdp?: any }
  ) {
    try {
      const res = await fetch(`${BASE_URL}/calls/${callId}/respond`, {
        method: 'POST',
        headers: getAuthHeaders(databaseName),
        body: JSON.stringify(payload),
      });
      return await safeJson(res, { success: false, message: 'Failed to respond to call.' });
    } catch (err: any) {
      return { success: false, message: err.message || 'Call response failed.' };
    }
  },

  async sendCallSignal(databaseName: string, callId: string, signal: any) {
    try {
      const res = await fetch(`${BASE_URL}/calls/${callId}/signal`, {
        method: 'POST',
        headers: getAuthHeaders(databaseName),
        body: JSON.stringify({ signal }),
      });
      return await safeJson(res, { success: false });
    } catch {
      return { success: false };
    }
  },

  async endCall(databaseName: string, callId: string) {
    try {
      const res = await fetch(`${BASE_URL}/calls/${callId}/end`, {
        method: 'POST',
        headers: getAuthHeaders(databaseName),
      });
      return await safeJson(res, { success: false, message: 'Failed to terminate call.' });
    } catch (err: any) {
      return { success: false, message: err.message || 'Call termination failed.' };
    }
  },
};

export default api;

